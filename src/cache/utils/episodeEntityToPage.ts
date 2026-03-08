/**
 * Build episode page from entity store when page cache misses.
 * Makes entity store a first-class fallback for the episode list.
 */

import type { LocalEpisode } from "@/utils/localDb";
import type { Episode } from "@/types";

/** Convert LocalEpisode to Kitsu Episode shape for list display. */
function localToEpisode(local: LocalEpisode): Episode {
  return {
    id: local.kitsuId ?? `local-${local.malId}-${local.number}`,
    type: "episodes",
    links: { self: "" },
    attributes: {
      createdAt: "",
      updatedAt: local.updatedAt ?? "",
      synopsis: local.synopsis ?? "",
      description: local.description ?? "",
      titles: {},
      canonicalTitle: local.canonicalTitle ?? local.title ?? "",
      seasonNumber: 0,
      number: local.number,
      relativeNumber: local.number,
      airdate: local.airdate ?? "",
      length: local.length ?? 0,
      thumbnail: local.thumbnail
        ? { original: local.thumbnail, meta: { dimensions: {} } }
        : ({ original: "" } as Episode["attributes"]["thumbnail"]),
    },
    relationships: { media: { links: { self: "" } }, videos: { links: { self: "" } } },
  };
}

/**
 * Build a page payload from entity store when page cache misses.
 * Returns null if we don't have enough entities for the requested page.
 */
export function buildPageFromEntities(
  entities: LocalEpisode[],
  page: number,
  episodesPerPage: number
): { episodes: Episode[]; totalEpisodesCount: number; totalTabs: number } | null {
  const start = (page - 1) * episodesPerPage + 1;
  const end = start + episodesPerPage - 1;
  const sorted = [...entities].sort((a, b) => a.number - b.number);
  const pageEntities = sorted.filter((e) => e.number >= start && e.number <= end);
  if (pageEntities.length === 0) return null;

  const totalCount = Math.max(...sorted.map((e) => e.number), entities.length);
  return {
    episodes: pageEntities.map(localToEpisode),
    totalEpisodesCount: totalCount,
    totalTabs: Math.ceil(totalCount / episodesPerPage) || 1,
  };
}
