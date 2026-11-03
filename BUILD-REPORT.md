# stylechart — build report

Rebuild of `feeling-search-mcp` as `@reneturcios/stylechart`
(MCP name `io.github.CloudCorpRecords/stylechart`), version
0.1.0, built 2026-10-27 from
`specs-batch22/stylechart.md`. All work is inside
`builds/stylechart/`; the spec and fixture were not modified.

## Tools built (5)

- `word_analyze` — POST `{base}/v2/analyze` with
  `{text, words?, styles?}` (optional fields omitted when not
  given); upstream JSON returned verbatim. Validation:
  text non-empty, ≤500 chars; words integer 1–12; styles
  integer 1–30, all with the spec's exact messages, checked
  before any request.
- `word_lookup` — GET `{base}/v2/links?word=<urlencoded>`;
  upstream JSON verbatim.
- `word_list` — GET `{base}/v2/dictionary`; verbatim with no
  `query`, otherwise the spec's local composition: words
  whose `w` contains the query and styles whose `name` or
  `id` contains it, returned as `{ok: true, query, words,
  styles, counts: {words, styles, total_words,
  total_styles}}` with totals from the upstream counts
  (falling back to array lengths when counts are absent).
- `style_get` — GET `{base}/v2/styles/<urlencoded id>`;
  upstream JSON verbatim.
- `word_status` — GET `{base}/v2/dictionary`, projected to
  only `{ok, counts}`.

Base URL: `FEELING_API_BASE` env var, default
`https://xiximm.cloud`, injectable in the core (`StyleDeps`).
All upstream access goes through an injectable fetch; tests
use fake fetch only — no live network call anywhere.

Errors: non-2xx → `feeling-search error: HTTP <status>`;
HTTP 402 → `feeling-search error: HTTP 402 (the paid cloud
path is not used by this rebuild)`; fetch throw →
`feeling-search unreachable`.

MCP server uses the low-level `Server` API with explicit
JSON-schema literals copied verbatim from the parity
fixture. CLI subcommands mirror the tools (`word_status`
takes no argument); `--version` prints `0.1.0`; unknown
subcommand → usage, exit 2; error results exit 1 (both
verified against the built CLI).

## Safety note

No payment machinery is implemented: no x402/Alipay payment
material, no `X-FS-Quota` quota header (a test asserts the
only header sent is `Content-Type`), and no calls to the
metered `/v2/images` endpoint. The original's purchased
quota token is not supported. The strings "x402" /
"X-FS-Quota" / "/v2/images" appear only in prose (code
comments, README, CHANGELOG) stating they are not used.

## Verification (all run locally, 2026-10-27)

- `npm run build` — exit 0.
- `npx tsc --noEmit` — exit 0.
- `npm test` — 35 tests, 35 pass, 0 fail (5 suites:
  word_analyze, word_lookup, word_list, style_get,
  word_status; fake fetch + fake env only).
- `node dist/cli.js --version` — prints `0.1.0`.
- Unknown subcommand exits 2 with usage; a validation error
  exits 1 with the spec's exact message.
- Parity: `harness/parity.py` against
  `feeling-search-mcp-tools-original.json` →
  **PASS, parity 100.0, identical_tools 5 / total 5**, no
  missing/extra tools, no schema diffs (report in
  `parity-out/`).

## Lockfile verification (Route 3, clean from birth)

Generated in a temp dir containing only `package.json` via
`npm install --package-lock-only --ignore-scripts --offline`,
then copied in and verified: parses as JSON, `name` ==
`@reneturcios/stylechart`, **128 package entries**. Build-dir
dependencies installed with `npm install --offline
--ignore-scripts`.

## Consistency

Version `0.1.0` agrees across `package.json`, `server.json`
(top-level + npm entry + OCI tag
`ghcr.io/cloudcorprecords/stylechart:0.1.0`), core `VERSION`,
and the CHANGELOG heading. The OCI entry in `server.json`
carries no `version` field; the `server.json` description is
exactly the spec's 91-character string; the Dockerfile
carries the label
`io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/stylechart"`.
File count: 19 factory files + this report (20), plus build
artifacts (`dist/`, `node_modules/`, `parity-out/`).
