/**
 * stylechart core: a direct client of the documented free
 * feeling-search REST API (v2) at https://xiximm.cloud.
 *
 * Wires (documented free endpoints only):
 *   word_analyze  POST {base}/v2/analyze            {text, words?, styles?}
 *   word_lookup   GET  {base}/v2/links?word=<word>
 *   word_list     GET  {base}/v2/dictionary
 *   style_get     GET  {base}/v2/styles/<id>
 *   word_status   GET  {base}/v2/dictionary  (projected to {ok, counts})
 *
 * Success returns the upstream JSON verbatim as the result
 * text, except for two labelled local compositions:
 *   - word_list with a `query` filters the dictionary locally:
 *     words whose `w` contains the query and styles whose
 *     `name` or `id` contains it, returned as
 *     {ok: true, query, words, styles, counts: {words, styles,
 *     total_words, total_styles}} where the totals are the
 *     upstream counts.
 *   - word_status returns only {ok, counts} from the
 *     dictionary response.
 *
 * Safety: this client implements NO payment machinery. It
 * never sends x402/Alipay payment material, never sends the
 * X-FS-Quota purchased-credit header, and never calls the
 * metered /v2/images endpoint. An HTTP 402 from the paid
 * cloud path is surfaced as an error, never paid.
 *
 * All argument validation happens before any request, with
 * the documented error strings. A non-2xx reply is
 * `feeling-search error: HTTP <status>` (402 carries the
 * paid-path note) and a throwing fetch is
 * `feeling-search unreachable`.
 */
import type {
  FetchFn,
  StyleDeps,
  StyleGetArgs,
  WordAnalyzeArgs,
  WordListArgs,
  WordLookupArgs,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "https://xiximm.cloud";

function resolveBase(deps: StyleDeps): string {
  const raw = deps.baseUrl ?? process.env.FEELING_API_BASE ?? DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

const defaultFetch: FetchFn = async (url, init) => {
  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status, text: () => res.text() };
};

interface UpstreamReply {
  status: number;
  text: string;
}

async function request(
  deps: StyleDeps,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<UpstreamReply> {
  const fetchFn = deps.fetchFn ?? defaultFetch;
  const base = resolveBase(deps);
  let res;
  try {
    res = await fetchFn(`${base}${path}`, init);
  } catch {
    throw new Error("feeling-search unreachable");
  }
  if (res.status === 402) {
    throw new Error(
      "feeling-search error: HTTP 402 (the paid cloud path is not used by this rebuild)",
    );
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`feeling-search error: HTTP ${res.status}`);
  }
  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new Error("feeling-search unreachable");
  }
  return { status: res.status, text };
}

async function requestJson(
  deps: StyleDeps,
  path: string,
): Promise<Record<string, unknown>> {
  const { text } = await request(deps, path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("feeling-search unreachable");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("feeling-search unreachable");
  }
  return parsed as Record<string, unknown>;
}

function validateText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) {
    throw new Error("text must be a non-empty string of at most 500 characters");
  }
  return value;
}

function validateWords(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 12) {
    throw new Error("words must be an integer between 1 and 12");
  }
  return value;
}

function validateStyles(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 30) {
    throw new Error("styles must be an integer between 1 and 30");
  }
  return value;
}

function validateWord(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("word must be a non-empty string");
  }
  return value;
}

function validateId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("id must be a non-empty string");
  }
  return value;
}

/** One sentence → the best-matching visual styles + the feeling words behind them. */
export async function wordAnalyze(
  args: WordAnalyzeArgs,
  deps: StyleDeps = {},
): Promise<string> {
  const raw = (args ?? {}) as unknown as Record<string, unknown>;
  const text = validateText(raw.text);
  const words = validateWords(raw.words);
  const styles = validateStyles(raw.styles);
  const body: Record<string, unknown> = { text };
  if (words !== undefined) body.words = words;
  if (styles !== undefined) body.styles = styles;
  const { text: out } = await request(deps, "/v2/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return out;
}

/** Look up a single feeling word: definition, near-synonyms, landing styles. */
export async function wordLookup(
  args: WordLookupArgs,
  deps: StyleDeps = {},
): Promise<string> {
  const raw = (args ?? {}) as unknown as Record<string, unknown>;
  const word = validateWord(raw.word);
  const { text } = await request(deps, `/v2/links?word=${encodeURIComponent(word)}`);
  return text;
}

function wordKey(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null) {
    const w = (entry as Record<string, unknown>).w;
    if (typeof w === "string") return w;
  }
  return undefined;
}

function styleMatches(entry: unknown, query: string): boolean {
  if (typeof entry === "string") return entry.includes(query);
  if (typeof entry === "object" && entry !== null) {
    const rec = entry as Record<string, unknown>;
    const name = rec.name;
    const id = rec.id;
    return (
      (typeof name === "string" && name.includes(query)) ||
      (typeof id === "string" && id.includes(query))
    );
  }
  return false;
}

/** Browse / search the full feeling-word lexicon. */
export async function wordList(
  args: WordListArgs = {},
  deps: StyleDeps = {},
): Promise<string> {
  const raw = (args ?? {}) as unknown as Record<string, unknown>;
  const query = raw.query;
  if (query !== undefined && typeof query !== "string") {
    throw new Error("query must be a string");
  }
  if (query === undefined || query === "") {
    const { text } = await request(deps, "/v2/dictionary");
    return text;
  }
  const dict = await requestJson(deps, "/v2/dictionary");
  const allWords = Array.isArray(dict.words) ? dict.words : [];
  const allStyles = Array.isArray(dict.styles) ? dict.styles : [];
  const words = allWords.filter((entry) => {
    const key = wordKey(entry);
    return typeof key === "string" && key.includes(query);
  });
  const styles = allStyles.filter((entry) => styleMatches(entry, query));
  const counts =
    typeof dict.counts === "object" && dict.counts !== null
      ? (dict.counts as Record<string, unknown>)
      : {};
  const totalWords = typeof counts.words === "number" ? counts.words : allWords.length;
  const totalStyles = typeof counts.styles === "number" ? counts.styles : allStyles.length;
  return JSON.stringify({
    ok: true,
    query,
    words,
    styles,
    counts: {
      words: words.length,
      styles: styles.length,
      total_words: totalWords,
      total_styles: totalStyles,
    },
  });
}

/** One style in full: definition, parent style, member words, reference images. */
export async function styleGet(
  args: StyleGetArgs,
  deps: StyleDeps = {},
): Promise<string> {
  const raw = (args ?? {}) as unknown as Record<string, unknown>;
  const id = validateId(raw.id);
  const { text } = await request(deps, `/v2/styles/${encodeURIComponent(id)}`);
  return text;
}

/** Lexicon coverage — use it to check the data is fresh. */
export async function wordStatus(deps: StyleDeps = {}): Promise<string> {
  const dict = await requestJson(deps, "/v2/dictionary");
  return JSON.stringify({ ok: dict.ok, counts: dict.counts });
}
