#!/usr/bin/env node
/**
 * HLS/m3u8 proxy for streams that require Referer/Origin or CORS.
 *
 * Background:
 * - m3u8 is a playlist of .ts segment URLs. Players fetch the playlist then each segment.
 * - Many CDNs (9anime, AnimePahe, GogoAnime, lightningspark77, haildrop77) block direct requests:
 *   - CORS: browser can't fetch .ts from another origin → infinite buffering.
 *   - Referer/Origin: CDN returns 403 unless request looks like it came from their site.
 * - Fix: proxy on the server fetches with correct headers and rewrites the playlist so segment
 *   URLs point back through the proxy; the app only talks to the proxy (same origin / no CORS).
 *
 * Usage: node scripts/stream-proxy.js
 * App uses STREAM_PROXY_URL (e.g. http://localhost:3333/proxy) so all m3u8 and .ts go via this.
 *
 * Env: STREAM_PROXY_PORT, STREAM_REFERER, STREAM_ORIGIN, STREAM_USER_AGENT
 * Refs: github.com/Eltik/M3U8-Proxy, github.com/shashstormer/m3u8_proxy-cors, github.com/Gratenes/m3u8CloudflareWorkerProxy
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = parseInt(process.env.STREAM_PROXY_PORT || '3333', 10);
// If set, use these exact headers (copy from browser Network tab when playing on the CDN site). Otherwise use dynamic same-origin headers.
const REFERER = process.env.STREAM_REFERER || '';
const ORIGIN = process.env.STREAM_ORIGIN || '';
const USER_AGENT =
  process.env.STREAM_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0';

function fetchWithHeaders(targetUrl, redirectCount = 0) {
  const maxRedirects = 5;
  if (redirectCount > maxRedirects) {
    return Promise.reject(new Error('Too many redirects'));
  }
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const referer = REFERER || u.origin + u.pathname.replace(/\/[^/]*$/, '/');
    const origin = ORIGIN || u.origin;
    const req = lib.get(
      targetUrl,
      {
        headers: {
          Referer: referer,
          Origin: origin,
          Host: u.host,
          'User-Agent': USER_AGENT,
          Accept: '*/*',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, targetUrl).href;
          return fetchWithHeaders(next, redirectCount + 1).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }
    );
    req.on('error', reject);
  });
}

function resolveUrl(baseUrl, line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return trimmed;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

function rewriteM3u8(playlistBody, baseUrl, proxyBase) {
  const base = baseUrl.replace(/\/[^/]*$/, '/');
  const lines = playlistBody.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const absolute = resolveUrl(base, trimmed);
    out.push(proxyBase + encodeURIComponent(absolute));
  }
  return out.join('\n');
}

// CORS: allow app (e.g. localhost:8081 or Expo) to load stream from this proxy
function corsHeaders(origin) {
  const o = origin || '*';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const parsed = url.parse(req.url, true);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (parsed.pathname !== '/proxy' || !parsed.query.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...corsHeaders(origin) });
    res.end('Use /proxy?url=<encoded-stream-url>');
    return;
  }

  const targetUrl = decodeURIComponent(parsed.query.url);
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    res.writeHead(400, { 'Content-Type': 'text/plain', ...corsHeaders(origin) });
    res.end('Invalid url');
    return;
  }

  try {
    const { status, headers, body } = await fetchWithHeaders(targetUrl);
    if (status !== 200) {
      console.log(`[stream-proxy] Upstream ${targetUrl.slice(0, 60)}... -> ${status} (often = expired URL or CDN blocking; try a fresh link from the API or set STREAM_REFERER/STREAM_ORIGIN from browser)`);
      res.writeHead(status || 502, { 'Content-Type': 'text/plain', ...corsHeaders(origin) });
      res.end(`Upstream returned ${status}`);
      return;
    }

    const contentType = (headers['content-type'] || '').toLowerCase();
    const isM3u8 =
      targetUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8');

    if (isM3u8) {
      const baseUrl = targetUrl.replace(/\/[^/]*$/, '/');
      const host = req.headers.host || `127.0.0.1:${PORT}`;
      const proxyBase = `http://${host}/proxy?url=`;
      const rewritten = rewriteM3u8(body.toString('utf8'), baseUrl, proxyBase);
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', ...corsHeaders(origin) });
      res.end(rewritten);
    } else {
      res.writeHead(200, {
        'Content-Type': headers['content-type'] || 'application/octet-stream',
        ...corsHeaders(origin),
      });
      res.end(body);
    }
  } catch (err) {
    console.error('[stream-proxy]', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain', ...corsHeaders(origin) });
    res.end('Proxy fetch failed: ' + err.message);
  }
});

const host = process.env.STREAM_PROXY_HOST || '0.0.0.0';
server.listen(PORT, host, () => {
  console.log(`[stream-proxy] Listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${PORT}/proxy?url=...`);
  console.log(`[stream-proxy] Referer/Origin: ${REFERER || '(dynamic from URL)'} / ${ORIGIN || '(dynamic from URL)'}`);
  if (host === '0.0.0.0') console.log('[stream-proxy] On device/Expo: set STREAM_PROXY_URL to http://<your-pc-ip>:3333/proxy in .env');
  if (!REFERER && !ORIGIN) console.log('[stream-proxy] To fix 403: set STREAM_REFERER and STREAM_ORIGIN (e.g. from browser when playing on the CDN site), or use a fresh stream URL from the API.');
});
