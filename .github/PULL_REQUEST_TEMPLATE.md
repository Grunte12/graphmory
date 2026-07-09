## Summary

Describe the change in one or two sentences.

## Human Review

- [ ] This PR is intentionally scoped and ready for human review
- [ ] The author/maintainer approved the change direction before merge
- [ ] No automatic paid/credit-based code review is required for this PR

## Type

- [ ] Contract/schema change
- [ ] Skill or adapter change
- [ ] Eval or fixture change
- [ ] Documentation change
- [ ] Bug fix
- [ ] Optional integration
- [ ] CI/release hygiene

## Evidence

- [ ] `npm run check` passes
- [ ] `npm pack --dry-run` passes
- [ ] New or changed behavior has an eval, test, or fixture
- [ ] Claims in docs are supported by sources or marked as hypotheses

## Memory Safety

- [ ] No secrets, raw private transcripts, or real vault dumps are included
- [ ] No personal machine paths or project-private names are included
- [ ] Derived outputs are not treated as canonical memory
- [ ] Curator behavior does not invent unsupported facts

## Package Safety

- [ ] Public package files are intentional
- [ ] Runtime scratch folders such as `.opencode/`, `tmp/`, logs, and local env files are excluded
- [ ] Install/agent instructions still work for a fresh machine

## Notes

Add tradeoffs, limitations, or follow-up work.
