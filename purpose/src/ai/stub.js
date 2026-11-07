/**
 * Deterministic stub model for local dry runs and tests.
 *
 * This is NOT a Hive client. It never performs network I/O and never reads a key.
 * It exists so the full owner workflow can be exercised end to end without spending
 * money or contacting any external service.
 */

export const STUB_MODEL = "purpose-stub-readonly-1";

export function createStubFetch({ reply, inputTokens = 640, outputTokens = 220 } = {}) {
  const calls = [];

  async function stubFetch(url, init) {
    calls.push({ url, body: JSON.parse(init.body ?? "{}") });
    const text =
      reply ??
      [
        "DRY-RUN READ-ONLY FINDINGS",
        "",
        "1. The homepage has no canonical link, so search engines may index duplicate URLs.",
        "2. og:image is a relative path and will not resolve for social scrapers.",
        "3. There is no robots.txt or sitemap.xml.",
        "",
        "RECOMMENDATION",
        "The owner must approve the canonical host, the social preview image, and the",
        "crawl policy before any change is drafted. No content was written.",
        "",
        "MISSING INFORMATION (owner must supply)",
        "- Canonical URL policy",
        "- Approved social preview image asset",
      ].join("\n");

    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: "stub-completion",
        model: STUB_MODEL,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          prompt_tokens_details: { cached_tokens: 0 },
        },
      }),
    };
  }

  return { fetch: stubFetch, calls };
}
