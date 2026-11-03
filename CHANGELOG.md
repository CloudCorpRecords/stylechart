# Changelog

## 0.1.0 (2026-10-27)

- Initial release: five MCP tools and matching CLI subcommands
  over the documented free feeling-search API — `word_analyze`
  (a sentence matched to visual styles and feeling words),
  `word_lookup` (one feeling word in full), `word_list` (browse
  or locally filter the full lexicon), `style_get` (one style
  in full), and `word_status` (lexicon coverage counts).
- Free endpoints only by design: no payment machinery, no
  quota-token header, and no calls to the metered images
  endpoint; an HTTP 402 from the paid cloud path is reported
  as an error, never paid.
