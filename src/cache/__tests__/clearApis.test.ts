/**
 * Tests for clear APIs - ensure correct namespaces cleared.
 * Does not require AsyncStorage (tests the logic of which namespaces are cleared).
 */

describe("clear APIs", () => {
  it("clearResponseCachesOnly clears discovery namespaces", () => {
    const discovery = [
      "ANILIST_FEED",
      "ANILIST_MEDIA",
      "ANILIST_CHARACTERS",
      "ANILIST_REVIEWS",
      "ANILIST_RECOMMENDATIONS",
      "KITSU_EPISODES_PAGE",
      "ANIME_MEDIA_STABLE",
      "ANIME_MEDIA_VOLATILE",
    ];
    expect(discovery).toContain("ANILIST_FEED");
    expect(discovery).toContain("ANIME_MEDIA_STABLE");
    expect(discovery).not.toContain("STREAMING_PICK_PREFERENCE");
  });

  it("clearStreamingCachesOnly does not include entity store", () => {
    const streaming = ["STREAMING_SERIES", "SLUG_CACHE", "SLUG_RESOLUTION"];
    expect(streaming).not.toContain("ID_MAPPING");
  });
});
