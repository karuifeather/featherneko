/**
 * Frontier page logic for airing anime episode caching.
 * Completed anime: all pages immutable.
 * Airing anime: older pages long-lived; latest/frontier page shorter TTL.
 */

export interface FrontierPageContext {
  animeStatus?: "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS" | string;
  totalEpisodes?: number | null;
  totalPages?: number;
  currentPage: number;
  episodesPerPage: number;
  latestAiredEpisode?: number | null;
}

/**
 * Returns true if this episode page is the "frontier" (last/latest) page for airing anime.
 * Frontier pages need shorter TTL since new episodes may appear.
 */
export function isFrontierEpisodePage(ctx: FrontierPageContext): boolean {
  if (
    ctx.animeStatus === "FINISHED" ||
    ctx.animeStatus === "CANCELLED" ||
    ctx.animeStatus === "NOT_YET_RELEASED"
  ) {
    return false;
  }

  const totalPages = ctx.totalPages ?? (ctx.totalEpisodes != null && ctx.episodesPerPage > 0
    ? Math.ceil(ctx.totalEpisodes / ctx.episodesPerPage)
    : 1);

  return ctx.currentPage >= totalPages;
}

/**
 * Returns context for policy resolution when caching episode pages.
 */
export function getEpisodePageCacheContext(
  malId: number,
  page: number,
  episodesPerPage: number,
  totalEpisodesCount: number,
  animeStatus?: string
): { isCompleted: boolean; isFrontier: boolean; context: FrontierPageContext } {
  const totalPages = Math.ceil(totalEpisodesCount / episodesPerPage) || 1;
  const isCompleted =
    animeStatus === "FINISHED" ||
    animeStatus === "CANCELLED" ||
    animeStatus === "NOT_YET_RELEASED";

  const ctx: FrontierPageContext = {
    animeStatus,
    totalEpisodes: totalEpisodesCount,
    totalPages,
    currentPage: page,
    episodesPerPage,
  };

  const isFrontier = !isCompleted && isFrontierEpisodePage(ctx);

  return { isCompleted, isFrontier, context: ctx };
}
