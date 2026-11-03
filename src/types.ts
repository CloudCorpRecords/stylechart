/**
 * stylechart types.
 *
 * Five read-only tools over the documented free feeling-search
 * REST API (v2) at https://xiximm.cloud. Every tool answers
 * with a single text string holding JSON: the upstream response
 * verbatim, except for the two labelled local compositions in
 * `word_list` (query filter) and `word_status` ({ok, counts}
 * projection).
 */

export interface WordAnalyzeArgs {
  text: string;
  words?: number;
  styles?: number;
}

export interface WordLookupArgs {
  word: string;
}

export interface WordListArgs {
  query?: string;
}

export interface StyleGetArgs {
  id: string;
}

/** The minimal slice of a fetch Response this client relies on. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

/** Injectable fetch, so tests never touch the live network. */
export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

/** Runtime dependencies for the core, all injectable in tests. */
export interface StyleDeps {
  /** Fetch implementation. Defaults to the global fetch. */
  fetchFn?: FetchFn;
  /**
   * feeling-search API base URL. Defaults to the
   * FEELING_API_BASE env var, then https://xiximm.cloud.
   */
  baseUrl?: string;
}
