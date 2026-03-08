/**
 * Tests for AniList media stable/volatile split.
 */

import {
  splitAnilistMedia,
  recomposeAnilistMedia,
  type AnilistMediaFull,
} from "../utils/anilistMediaSplit";

describe("splitAnilistMedia", () => {
  it("splits stable fields into stable segment", () => {
    const media: AnilistMediaFull = {
      id: 1,
      idMal: 5114,
      title: { romaji: "Foo", english: "Bar" },
      coverImage: { large: "url" },
      genres: ["Action"],
    };
    const { stable } = splitAnilistMedia(media);
    expect(stable.id).toBe(1);
    expect(stable.idMal).toBe(5114);
    expect(stable.title).toEqual({ romaji: "Foo", english: "Bar" });
    expect(stable.coverImage).toEqual({ large: "url" });
    expect(stable.genres).toEqual(["Action"]);
  });

  it("splits volatile fields into volatile segment", () => {
    const media: AnilistMediaFull = {
      id: 1,
      averageScore: 85,
      meanScore: 84,
      popularity: 1000,
      nextAiringEpisode: { episode: 5 },
    };
    const { volatile } = splitAnilistMedia(media);
    expect(volatile.averageScore).toBe(85);
    expect(volatile.popularity).toBe(1000);
    expect(volatile.nextAiringEpisode?.episode).toBe(5);
  });

  it("recompose merges stable and volatile", () => {
    const stable = { id: 1, idMal: 5114, title: { romaji: "Foo" } };
    const volatile = { averageScore: 90, popularity: 500 };
    const merged = recomposeAnilistMedia(stable, volatile);
    expect(merged.id).toBe(1);
    expect(merged.idMal).toBe(5114);
    expect(merged.title?.romaji).toBe("Foo");
    expect(merged.averageScore).toBe(90);
    expect(merged.popularity).toBe(500);
  });
});
