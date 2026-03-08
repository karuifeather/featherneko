/**
 * Timezone-aware date/time formatting using the device's local timezone.
 * All API timestamps (e.g. AniList airingAt) are Unix seconds UTC;
 * we convert to the user's local time for display and for "today" boundaries.
 */

function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

const timeZone = getLocalTimeZone();

/**
 * Format a Unix timestamp (seconds) as local time, e.g. "2:30 PM"
 */
export function formatLocalTime(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
}

/**
 * Format a Unix timestamp (seconds) as local date string for grouping (Yesterday/Today/Tomorrow)
 */
export function formatLocalDateString(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString([], { timeZone });
}

/**
 * Format an ISO date string or Date as local date (e.g. "Mon Dec 2, 2024")
 */
export function formatLocalDate(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return date.toLocaleDateString([], { timeZone });
}

/**
 * Same as new Date().toDateString() but explicitly in local timezone (for "today" boundaries)
 */
export function getTodayDateString(): string {
  const date = new Date();
  return date.toLocaleDateString([], { timeZone });
}

/**
 * Get date string for a day offset from today (e.g. -1 = yesterday, +1 = tomorrow)
 */
export function getDateStringForOffset(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return date.toLocaleDateString([], { timeZone });
}

/**
 * Human-readable timezone label for the device, e.g. "EST" or "America/New_York"
 */
export function getTimeZoneLabel(): string {
  try {
    const formatter = new Intl.DateTimeFormat([], {
      timeZone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export { timeZone };
