/**
 * Tests for frontier page logic.
 */

import {
  isFrontierEpisodePage,
  getEpisodePageCacheContext,
} from "../utils/frontierPage";

describe("isFrontierEpisodePage", () => {
  it("returns false for finished anime", () => {
    expect(
      isFrontierEpisodePage({
        animeStatus: "FINISHED",
        totalPages: 5,
        currentPage: 5,
        episodesPerPage: 10,
      })
    ).toBe(false);
  });

  it("returns true for airing anime last page", () => {
    expect(
      isFrontierEpisodePage({
        animeStatus: "RELEASING",
        totalPages: 5,
        currentPage: 5,
        episodesPerPage: 10,
      })
    ).toBe(true);
  });

  it("returns false for airing anime older page", () => {
    expect(
      isFrontierEpisodePage({
        animeStatus: "RELEASING",
        totalPages: 5,
        currentPage: 2,
        episodesPerPage: 10,
      })
    ).toBe(false);
  });
});

describe("getEpisodePageCacheContext", () => {
  it("completed anime is not frontier", () => {
    const { isCompleted, isFrontier } = getEpisodePageCacheContext(
      5114,
      5,
      10,
      50,
      "FINISHED"
    );
    expect(isCompleted).toBe(true);
    expect(isFrontier).toBe(false);
  });

  it("airing anime last page is frontier", () => {
    const { isCompleted, isFrontier } = getEpisodePageCacheContext(
      5114,
      5,
      10,
      48,
      "RELEASING"
    );
    expect(isCompleted).toBe(false);
    expect(isFrontier).toBe(true);
  });

  it("airing anime older page is not frontier", () => {
    const { isCompleted, isFrontier } = getEpisodePageCacheContext(
      5114,
      2,
      10,
      48,
      "RELEASING"
    );
    expect(isCompleted).toBe(false);
    expect(isFrontier).toBe(false);
  });
});
