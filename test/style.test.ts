import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { styleGet, wordAnalyze, wordList, wordLookup, wordStatus } from "../src/style.js";
import type { FetchFn, StyleDeps } from "../src/types.js";

/**
 * Every test runs against an injected fake fetch: no live
 * network, no live call is made.
 */

type Reply = { status?: number; body: unknown };
type Handler = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Reply;

interface Captured {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

function makeFetch(handler: Handler, captured: Captured[] = []): FetchFn {
  return async (url, init) => {
    captured.push({ url, init });
    const r = handler(url, init);
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)),
    };
  };
}

const throwingFetch: FetchFn = async () => {
  throw new Error("connection refused");
};

function deps(fetchFn: FetchFn, extra: Partial<StyleDeps> = {}): StyleDeps {
  return { fetchFn, ...extra };
}

async function expectError(promise: Promise<unknown>, message: string): Promise<void> {
  await assert.rejects(promise, (err: unknown) => {
    assert.equal(err instanceof Error ? err.message : String(err), message);
    return true;
  });
}

const ANALYZE_BODY = {
  ok: true,
  input: { text: "rainy neon streets at night", lang: "en", chars: 27 },
  words: [{ w: "melancholy", score: 0.9, share: 0.4, styles: ["synthwave"] }],
  styles: [{ id: "synthwave", name: "Synthwave", score: 0.9, hits: 3, matched: ["melancholy"], def: "Neon retro." }],
  excluded: 0,
  meta: { version: "0.3", engine: "v2", matched_words: 1, latency_ms: 12 },
};

const DICTIONARY = {
  ok: true,
  words: [
    { w: "melancholy", def: "A quiet sadness." },
    { w: "neon glow", def: "Bright electric light." },
    { w: "serene", def: "Calm and clear." },
  ],
  styles: [
    { id: "synthwave", name: "Synthwave", def: "Neon retro." },
    { id: "neon-noir", name: "Neon Noir", def: "Dark neon." },
    { id: "cottagecore", name: "Cottagecore", def: "Rural calm." },
  ],
  counts: { words: 762, styles: 598 },
};

describe("word_analyze", () => {
  it("posts the text and returns the upstream JSON verbatim", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }), captured);
    const out = await wordAnalyze({ text: "rainy neon streets at night" }, deps(fetchFn));
    assert.equal(out, JSON.stringify(ANALYZE_BODY));
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, "https://xiximm.cloud/v2/analyze");
    assert.equal(captured[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(captured[0].init?.body ?? ""), {
      text: "rainy neon streets at night",
    });
  });

  it("includes words and styles in the body only when given", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }), captured);
    await wordAnalyze({ text: "calm morning", words: 4, styles: 20 }, deps(fetchFn));
    assert.deepEqual(JSON.parse(captured[0].init?.body ?? ""), {
      text: "calm morning",
      words: 4,
      styles: 20,
    });
  });

  it("accepts the boundary values (500 chars, words 1 and 12, styles 1 and 30)", async () => {
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }));
    await wordAnalyze({ text: "x".repeat(500), words: 1, styles: 30 }, deps(fetchFn));
    await wordAnalyze({ text: "ok", words: 12, styles: 1 }, deps(fetchFn));
  });

  it("honours an injected base URL with trailing slashes trimmed", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }), captured);
    await wordAnalyze({ text: "hi" }, deps(fetchFn, { baseUrl: "https://example.test/api/" }));
    assert.equal(captured[0].url, "https://example.test/api/v2/analyze");
  });

  it("honours the FEELING_API_BASE env var when no base is injected", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }), captured);
    const prev = process.env.FEELING_API_BASE;
    process.env.FEELING_API_BASE = "https://env.test";
    try {
      await wordAnalyze({ text: "hi" }, { fetchFn });
    } finally {
      if (prev === undefined) delete process.env.FEELING_API_BASE;
      else process.env.FEELING_API_BASE = prev;
    }
    assert.equal(captured[0].url, "https://env.test/v2/analyze");
  });

  it("sends no payment or quota headers", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }), captured);
    await wordAnalyze({ text: "hi" }, deps(fetchFn));
    const headers = captured[0].init?.headers ?? {};
    assert.deepEqual(Object.keys(headers), ["Content-Type"]);
    assert.ok(!captured[0].url.includes("/v2/images"));
  });

  it("rejects an empty text before any request", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }), captured);
    await expectError(
      wordAnalyze({ text: "" }, deps(fetchFn)),
      "text must be a non-empty string of at most 500 characters",
    );
    assert.deepEqual(captured, []);
  });

  it("rejects a text over 500 characters", async () => {
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }));
    await expectError(
      wordAnalyze({ text: "x".repeat(501) }, deps(fetchFn)),
      "text must be a non-empty string of at most 500 characters",
    );
  });

  it("rejects a non-string text", async () => {
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }));
    await expectError(
      wordAnalyze({ text: 42 } as never, deps(fetchFn)),
      "text must be a non-empty string of at most 500 characters",
    );
  });

  it("rejects words outside 1-12", async () => {
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }));
    await expectError(
      wordAnalyze({ text: "hi", words: 0 }, deps(fetchFn)),
      "words must be an integer between 1 and 12",
    );
    await expectError(
      wordAnalyze({ text: "hi", words: 13 }, deps(fetchFn)),
      "words must be an integer between 1 and 12",
    );
  });

  it("rejects a non-integer words", async () => {
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }));
    await expectError(
      wordAnalyze({ text: "hi", words: 2.5 }, deps(fetchFn)),
      "words must be an integer between 1 and 12",
    );
  });

  it("rejects styles outside 1-30", async () => {
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }));
    await expectError(
      wordAnalyze({ text: "hi", styles: 0 }, deps(fetchFn)),
      "styles must be an integer between 1 and 30",
    );
    await expectError(
      wordAnalyze({ text: "hi", styles: 31 }, deps(fetchFn)),
      "styles must be an integer between 1 and 30",
    );
  });

  it("rejects a non-integer styles", async () => {
    const fetchFn = makeFetch(() => ({ body: ANALYZE_BODY }));
    await expectError(
      wordAnalyze({ text: "hi", styles: 1.5 }, deps(fetchFn)),
      "styles must be an integer between 1 and 30",
    );
  });

  it("maps HTTP 402 to the paid-path error text", async () => {
    const fetchFn = makeFetch(() => ({ status: 402, body: "payment required" }));
    await expectError(
      wordAnalyze({ text: "hi" }, deps(fetchFn)),
      "feeling-search error: HTTP 402 (the paid cloud path is not used by this rebuild)",
    );
  });

  it("maps other non-2xx replies to feeling-search error: HTTP <status>", async () => {
    const fetchFn = makeFetch(() => ({ status: 503, body: "down" }));
    await expectError(
      wordAnalyze({ text: "hi" }, deps(fetchFn)),
      "feeling-search error: HTTP 503",
    );
  });

  it("maps a throwing fetch to feeling-search unreachable", async () => {
    await expectError(wordAnalyze({ text: "hi" }, deps(throwingFetch)), "feeling-search unreachable");
  });
});

describe("word_lookup", () => {
  const LINKS_BODY = {
    ok: true,
    word: "melancholy",
    share: 0.4,
    marker: "m",
    gloss: "quiet sadness",
    explain: "A slow, reflective sadness.",
    english: "melancholy",
    styles: [{ id: "synthwave", name: "Synthwave", en: "Synthwave", def: "Neon retro." }],
    opposite: "euphoria",
    co_occurs: ["nostalgia"],
  };

  it("gets /v2/links with the urlencoded word and returns verbatim JSON", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: LINKS_BODY }), captured);
    const out = await wordLookup({ word: "neon glow" }, deps(fetchFn));
    assert.equal(out, JSON.stringify(LINKS_BODY));
    assert.equal(captured[0].url, "https://xiximm.cloud/v2/links?word=neon%20glow");
  });

  it("rejects an empty word before any request", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: LINKS_BODY }), captured);
    await expectError(wordLookup({ word: "" }, deps(fetchFn)), "word must be a non-empty string");
    assert.deepEqual(captured, []);
  });

  it("rejects a missing word", async () => {
    const fetchFn = makeFetch(() => ({ body: LINKS_BODY }));
    await expectError(wordLookup({} as never, deps(fetchFn)), "word must be a non-empty string");
  });

  it("maps a non-2xx reply to feeling-search error: HTTP <status>", async () => {
    const fetchFn = makeFetch(() => ({ status: 404, body: "unknown word" }));
    await expectError(wordLookup({ word: "zzz" }, deps(fetchFn)), "feeling-search error: HTTP 404");
  });

  it("maps a throwing fetch to feeling-search unreachable", async () => {
    await expectError(wordLookup({ word: "zzz" }, deps(throwingFetch)), "feeling-search unreachable");
  });
});

describe("word_list", () => {
  it("returns the dictionary JSON verbatim with no query", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: DICTIONARY }), captured);
    const out = await wordList({}, deps(fetchFn));
    assert.equal(out, JSON.stringify(DICTIONARY));
    assert.equal(captured[0].url, "https://xiximm.cloud/v2/dictionary");
  });

  it("filters words by w and styles by name or id when a query is given", async () => {
    const fetchFn = makeFetch(() => ({ body: DICTIONARY }));
    const out = JSON.parse(await wordList({ query: "neon" }, deps(fetchFn))) as Record<string, unknown>;
    assert.equal(out.ok, true);
    assert.equal(out.query, "neon");
    assert.deepEqual(out.words, [{ w: "neon glow", def: "Bright electric light." }]);
    // synthwave matches neither name nor id for "neon"; only
    // neon-noir does (via its id).
    assert.deepEqual(out.styles, [{ id: "neon-noir", name: "Neon Noir", def: "Dark neon." }]);
    assert.deepEqual(out.counts, { words: 1, styles: 1, total_words: 762, total_styles: 598 });
  });

  it("matches a style by its name as well as its id", async () => {
    const fetchFn = makeFetch(() => ({ body: DICTIONARY }));
    const out = JSON.parse(await wordList({ query: "Cottage" }, deps(fetchFn))) as {
      words: unknown[];
      styles: unknown[];
      counts: Record<string, number>;
    };
    assert.deepEqual(out.words, []);
    assert.deepEqual(out.styles, [{ id: "cottagecore", name: "Cottagecore", def: "Rural calm." }]);
    assert.deepEqual(out.counts, { words: 0, styles: 1, total_words: 762, total_styles: 598 });
  });

  it("falls back to array lengths for totals when counts are absent", async () => {
    const bare = { ok: true, words: DICTIONARY.words, styles: DICTIONARY.styles };
    const fetchFn = makeFetch(() => ({ body: bare }));
    const out = JSON.parse(await wordList({ query: "serene" }, deps(fetchFn))) as {
      counts: Record<string, number>;
    };
    assert.deepEqual(out.counts, { words: 1, styles: 0, total_words: 3, total_styles: 3 });
  });

  it("maps a non-2xx dictionary reply to feeling-search error: HTTP <status>", async () => {
    const fetchFn = makeFetch(() => ({ status: 500, body: "boom" }));
    await expectError(wordList({}, deps(fetchFn)), "feeling-search error: HTTP 500");
  });

  it("maps a throwing fetch to feeling-search unreachable", async () => {
    await expectError(wordList({ query: "x" }, deps(throwingFetch)), "feeling-search unreachable");
  });
});

describe("style_get", () => {
  const STYLE_BODY = {
    ok: true,
    style: {
      id: "synthwave",
      name: "Synthwave",
      def: "Neon retro futurism.",
      defGen: "Generated definition.",
      terms: ["neon", "retro"],
      origins: ["1980s"],
      images: ["https://example.test/a.png"],
    },
  };

  it("gets /v2/styles/<id> and returns verbatim JSON", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: STYLE_BODY }), captured);
    const out = await styleGet({ id: "synthwave" }, deps(fetchFn));
    assert.equal(out, JSON.stringify(STYLE_BODY));
    assert.equal(captured[0].url, "https://xiximm.cloud/v2/styles/synthwave");
  });

  it("urlencodes the style id", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: STYLE_BODY }), captured);
    await styleGet({ id: "neo tokyo" }, deps(fetchFn));
    assert.equal(captured[0].url, "https://xiximm.cloud/v2/styles/neo%20tokyo");
  });

  it("rejects an empty id before any request", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: STYLE_BODY }), captured);
    await expectError(styleGet({ id: "" }, deps(fetchFn)), "id must be a non-empty string");
    assert.deepEqual(captured, []);
  });

  it("maps a non-2xx reply to feeling-search error: HTTP <status>", async () => {
    const fetchFn = makeFetch(() => ({ status: 404, body: "unknown style" }));
    await expectError(styleGet({ id: "nope" }, deps(fetchFn)), "feeling-search error: HTTP 404");
  });

  it("maps HTTP 402 to the paid-path error text", async () => {
    const fetchFn = makeFetch(() => ({ status: 402, body: "payment required" }));
    await expectError(
      styleGet({ id: "synthwave" }, deps(fetchFn)),
      "feeling-search error: HTTP 402 (the paid cloud path is not used by this rebuild)",
    );
  });
});

describe("word_status", () => {
  it("returns only {ok, counts} from the dictionary response", async () => {
    const captured: Captured[] = [];
    const fetchFn = makeFetch(() => ({ body: DICTIONARY }), captured);
    const out = await wordStatus(deps(fetchFn));
    assert.equal(captured[0].url, "https://xiximm.cloud/v2/dictionary");
    assert.deepEqual(JSON.parse(out), { ok: true, counts: { words: 762, styles: 598 } });
  });

  it("maps a non-2xx reply to feeling-search error: HTTP <status>", async () => {
    const fetchFn = makeFetch(() => ({ status: 429, body: "slow down" }));
    await expectError(wordStatus(deps(fetchFn)), "feeling-search error: HTTP 429");
  });

  it("maps a throwing fetch to feeling-search unreachable", async () => {
    await expectError(wordStatus(deps(throwingFetch)), "feeling-search unreachable");
  });
});
