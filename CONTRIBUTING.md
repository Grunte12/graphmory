# Contributing

Contributions should preserve the harness boundaries:

- the lead agent owns new semantic meaning,
- the curator cannot invent unsupported memory,
- canonical Markdown remains separate from derived indexes,
- and measurable behavior matters more than prompt length.

Before opening a pull request:

```sh
npm run check
```

For architecture changes, include:

- the failure mode being addressed,
- the expected effect on accuracy, token use, or latency,
- a baseline comparison,
- and any new provenance or licensing requirements.

## Pull Request Expectations

- Keep core contracts small and provider-neutral.
- Put platform-specific instructions under `adapters/`.
- Put optional integrations behind derived contracts rather than adding required services.
- Update `CHANGELOG.md` for user-visible changes.
- Update schemas, examples, and tests together when a contract changes.
- Do not include private vault content, raw transcripts, secrets, or generated data that cannot be redistributed.

## Licensing And Attribution

This repository is MIT licensed. Do not copy large text blocks, code, prompts, or datasets from other projects unless their license permits redistribution and the attribution is added to `THIRD_PARTY_NOTICES.md`.

Research links and architectural inspiration are welcome, but docs should distinguish:

- adopted implementation,
- inspiration,
- excluded alternatives,
- and unproven hypotheses.
