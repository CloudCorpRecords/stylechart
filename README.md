# stylechart

Describe a mood in one ordinary sentence and stylechart tells
you which visual styles it points at. Under the hood is a
two-layer lexicon: feeling words on one side, visual styles on
the other, and links between them. One colloquial sentence
goes in; the best-matching styles come back, together with
the feeling words that carried the match, so you can see
*why* a style was chosen rather than just its name.

stylechart is a direct client of the documented public
feeling-search REST API (v2) hosted at `https://xiximm.cloud`.
The lexicon and the matching live server-side; this package
validates arguments, calls the free endpoints, and hands the
JSON back.

The five tools:

- `word_analyze` — one sentence (up to 500 characters) →
  the best-matching visual styles plus the feeling words
  behind them. Optional `words` (1–12) and `styles` (1–30)
  cap how many of each come back. A phrasing outside the
  lexicon returns an empty word list; that is expected, not
  an error.
- `word_lookup` — a single feeling word in full: definition,
  near-synonyms, and the styles it lands on.
- `word_list` — the whole lexicon in one response. With a
  `query`, the dictionary is filtered locally: words whose
  text contains the query and styles whose name or id does,
  with filtered and total counts reported side by side.
- `style_get` — one style by id (for example `synthwave`):
  definition, parent style, member words, reference images.
- `word_status` — lexicon coverage only: the `{ok, counts}`
  slice of the dictionary response, for checking the data is
  fresh without downloading the full tables.

## Free endpoints only

This rebuild talks exclusively to the documented free
endpoints (`POST /v2/analyze`, `GET /v2/links`,
`GET /v2/dictionary`, `GET /v2/styles/<id>`). The paid cloud
path is **not supported**: there is no payment machinery of
any kind, no support for purchased quota tokens (the
`X-FS-Quota` header is never sent), and the metered images
endpoint is never called. If the upstream ever answers
`/v2/analyze` with HTTP 402, stylechart reports it as an
error naming the paid path instead of paying.

## Configuration

- `FEELING_API_BASE` — API base URL. Defaults to
  `https://xiximm.cloud`. No API key is needed or accepted.

## CLI

Each tool is a subcommand taking one JSON argument string
(`word_status` takes none, `word_list`'s argument is
optional):

```bash
npx @reneturcios/stylechart word_analyze '{"text":"rainy neon streets at night","styles":5}'
npx @reneturcios/stylechart word_lookup '{"word":"melancholy"}'
npx @reneturcios/stylechart word_list '{"query":"neon"}'
npx @reneturcios/stylechart word_list
npx @reneturcios/stylechart style_get '{"id":"synthwave"}'
npx @reneturcios/stylechart word_status
npx @reneturcios/stylechart --version
```

Output is the tool's result JSON. Exit codes: `0` on
success, `1` on a runtime error (including a validation or
upstream failure), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/stylechart mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "stylechart": {
      "command": "npx",
      "args": ["-y", "@reneturcios/stylechart", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/stylechart
docker run --rm ghcr.io/cloudcorprecords/stylechart word_status
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (fake fetch only, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
