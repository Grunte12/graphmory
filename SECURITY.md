# Security Policy

Memory Patch Harness is a local-first developer tool. It does not run a hosted service, but it may be used near private notes, code, prompts, logs, and agent transcripts.

## Supported Versions

This project is pre-1.0. Security fixes target the latest `main` branch until versioned releases begin.

## Reporting A Vulnerability

Please do not open a public issue for secrets, prompt-injection exploits, vault traversal problems, or data exposure bugs.

Report privately by opening a GitHub Security Advisory for this repository when available, or contact the maintainer through the GitHub profile linked from the repository.

Include:

- affected commit or release,
- operating system and Node.js version,
- minimal reproduction steps,
- what private data may be exposed or modified,
- whether the issue requires a malicious note, prompt, patch, or repository file.

## Security Boundaries

The harness should never require:

- API keys in examples,
- raw private transcripts in committed fixtures,
- broad vault dumps,
- generated indexes treated as canonical truth,
- curator writes without provenance.

If a proposed change weakens one of these boundaries, document the risk and add a regression test.

