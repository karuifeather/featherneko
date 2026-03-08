/**
 * Tests for in-flight request coalescing.
 */

import { coalesce } from "../revalidation/requestCoalescer";

describe("requestCoalescer", () => {
  it("concurrent getOrFetch for same key share same Promise", async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { value: 42 };
    };

    const [a, b, c] = await Promise.all([
      coalesce("TEST", "k1", fetcher),
      coalesce("TEST", "k1", fetcher),
      coalesce("TEST", "k1", fetcher),
    ]);

    expect(a).toEqual({ value: 42 });
    expect(b).toEqual({ value: 42 });
    expect(c).toEqual({ value: 42 });
    expect(fetchCount).toBe(1);
  });

  it("different keys execute separately", async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return fetchCount;
    };

    const [a, b] = await Promise.all([
      coalesce("NS", "k1", fetcher),
      coalesce("NS", "k2", fetcher),
    ]);

    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});
