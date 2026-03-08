import { AnimeClient, AnimeEpisode, JikanResponse } from '@tutkli/jikan-ts';

const animeClient = new AnimeClient();

// Future: if per-episode lookups are costly, fetch Jikan episodes in batches (e.g. full
// anime episode list per MAL id), cache episode number -> topic id per series (e.g. in
// AsyncStorage or a small in-memory cache keyed by malId), and reuse when opening
// episode discussions or the Comments tab.

const EPISODES_PER_PAGE = 100;

/**
 * Parse MAL forum topic ID from a forum URL.
 * e.g. "https://myanimelist.net/forum/?topicid=123456" -> 123456
 */
export function parseTopicIdFromForumUrl(forumUrl: string): number | null {
  if (!forumUrl || typeof forumUrl !== 'string') return null;
  try {
    const url = new URL(forumUrl);
    const topicid = url.searchParams.get('topicid');
    if (topicid != null) {
      const n = parseInt(topicid, 10);
      if (!Number.isNaN(n)) return n;
    }
  } catch {
    const match = forumUrl.match(/topicid=(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Get the MAL forum topic ID for a specific episode of an anime.
 * Uses Jikan's episodes endpoint; each episode has a forum_url linking to its discussion thread.
 *
 * @param malId - MyAnimeList anime ID
 * @param episodeNumber - 1-based episode number
 * @returns The MAL forum topic ID for that episode, or null if not found / no discussion
 */
export async function getEpisodeForumTopicId(
  malId: number,
  episodeNumber: number
): Promise<number | null> {
  if (!malId || episodeNumber < 1) return null;
  const page = Math.ceil(episodeNumber / EPISODES_PER_PAGE);
  const indexInPage = (episodeNumber - 1) % EPISODES_PER_PAGE;
  try {
    const response: JikanResponse<AnimeEpisode[]> = await animeClient.getAnimeEpisodes(
      malId,
      page
    );
    const list = response.data ?? [];
    const episode = list[indexInPage];
    if (!episode?.forum_url) return null;
    return parseTopicIdFromForumUrl(episode.forum_url);
  } catch {
    return null;
  }
}
