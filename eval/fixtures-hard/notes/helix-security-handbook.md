---
project: helix
type: decision
status: active
updated: 2026-05-14
---

# Helix Security Handbook

## Overview

The Helix security handbook is the canonical reference for how the platform authenticates users, authorizes actions, protects data at rest and in transit, handles externally reported vulnerabilities, and logs security-relevant activity for audit purposes. Every engineer is expected to be familiar with the sections relevant to their area, and the security team reviews this handbook quarterly to ensure it still reflects the deployed system rather than an aspirational design that was never fully implemented.

## Authentication

User authentication uses short-lived session tokens issued after a successful credential check, refreshed automatically while a session remains active, and invalidated immediately on logout or after twelve hours of inactivity. Multi-factor authentication is required for all accounts with administrative privileges and optional but strongly encouraged for standard accounts, with adoption tracked as a security metric reported to leadership monthly. Failed login attempts are rate limited per account and per source address independently, so an attacker cannot bypass the per-account limit simply by rotating through many source addresses.

## Authorization

Authorization decisions are made through a centralized policy service rather than being scattered across individual services, so that a single audited policy definition governs what any given role can do across the entire platform. Roles are additive rather than hierarchical, meaning a user's effective permissions are the union of every role assigned to them, which keeps the mental model simple at the cost of occasionally requiring more explicit role assignments than a hierarchical model would need. Any change to a production authorization policy requires review from a second security engineer before it takes effect, recorded in the policy service's own audit trail.

## Data Encryption

All data at rest is encrypted using platform-managed keys rotated automatically on a schedule, and all data in transit between services, and between clients and the platform, is encrypted using current transport-layer security with older protocol versions disabled fleet-wide. Particularly sensitive fields, such as payment tokens and government identifiers, receive an additional layer of field-level encryption with keys managed separately from the general data-at-rest keys, so that a compromise of the general encryption key alone would not expose those fields. Key rotation events are logged and monitored, and any service that fails to pick up a rotated key within the expected window pages the security team.

## Vulnerability Disclosure

External researchers should report vulnerabilities to security@helix.example and will receive an acknowledgment within two business days; a bounty is paid for confirmed critical findings within thirty days of the fix shipping. The security team triages every report within five business days of acknowledgment, assigns a severity using an industry-standard scoring framework, and coordinates a fix timeline with the owning engineering team based on that severity. Researchers are asked not to publicly disclose a finding until either a fix has shipped or ninety days have passed since the initial report, whichever comes first, and the security team commits to keeping the researcher informed of progress throughout that window rather than going silent after the initial acknowledgment.

## Audit Logging

Every security-relevant action, including authentication events, authorization policy changes, and access to sensitive data fields, is written to an append-only audit log that cannot be modified or deleted by any service account, including the accounts used by the logging pipeline itself. Audit logs are retained for two years to support compliance investigations and are queryable by the security team through a dedicated interface that itself generates its own audit entries, so that even queries against the audit log are themselves auditable. Automated anomaly detection over the audit log flags unusual access patterns, such as a service account suddenly reading records far outside its normal usage pattern, for manual security review.

## FAQ

Common questions include how long a researcher should wait before treating an unacknowledged report as lost and re-sending it, whether internal employees are eligible for the same bounty program as external researchers, and how a team should request a policy service review when they believe an authorization change is time-sensitive and cannot wait for the standard second-reviewer queue.

## Provenance

- Security handbook, maintained by the security team as a decision record.
