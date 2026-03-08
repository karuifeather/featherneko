/**
 * Tests for source health.
 */

import {
  markSuccess,
  markFailure,
  markRateLimited,
  getSourceHealth,
} from "../source/sourceHealth";

describe("sourceHealth", () => {
  beforeEach(() => {
    markSuccess("anilist");
    markSuccess("kitsu");
  });

  it("markSuccess resets to healthy", () => {
    for (let i = 0; i < 3; i++) markFailure("anilist");
    expect(getSourceHealth("anilist")).toBe("degraded");
    markSuccess("anilist");
    expect(getSourceHealth("anilist")).toBe("healthy");
  });

  it("markFailure degrades source after threshold", () => {
    for (let i = 0; i < 3; i++) markFailure("anilist");
    expect(getSourceHealth("anilist")).toBe("degraded");
  });

  it("markRateLimited moves to rate_limited", () => {
    markRateLimited("anilist", 60000);
    expect(getSourceHealth("anilist")).toBe("rate_limited");
  });
});
