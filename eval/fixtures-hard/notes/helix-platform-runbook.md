---
project: helix
type: workflow
status: active
updated: 2026-05-10
---

# Helix Platform Operations Runbook

## Overview

The Helix platform runbook documents the standard operating procedures used by the on-call rotation to keep the production environment healthy. It covers the full lifecycle of a routine day: how deployments happen, how the team is alerted to problems, how incidents are triaged and resolved, how data is protected through backups, and how access to production systems is granted and revoked. Every engineer joining the on-call rotation is expected to read this document end to end before taking a shift, and every section is kept current by the platform team as procedures change. The intent of this runbook is not to replace judgment during an incident but to remove ambiguity about the mechanical steps so responders can spend their attention on the actual problem rather than remembering where things are.

## Deployment Process

Deployments to Helix production happen through the standard release pipeline, which builds an immutable artifact from a tagged commit, runs the full automated test suite against a staging replica, and then promotes the artifact through a canary stage that receives five percent of production traffic for fifteen minutes before a full rollout. Engineers trigger a deploy by opening a release ticket and tagging the on-call lead as a reviewer; the pipeline will not proceed to the canary stage without that approval. If the canary stage shows an elevated error rate or latency regression compared to the baseline window, the pipeline automatically halts and pages the deploying engineer. Manual deploys outside the pipeline are not permitted except during a declared emergency, and any such deploy must be logged in the incident channel with a justification.

## Monitoring & Alerts

Helix exposes service health through a set of dashboards covering request latency, error rate, queue depth, and resource saturation for every service in the fleet. Alerting thresholds are tuned to page only on conditions that require human judgment within minutes, while informational anomalies are routed to a low-priority channel that the team reviews each morning. Every alert links directly to a relevant dashboard and, where one exists, to a specific section of this runbook describing the expected response. The team periodically reviews alert noise and removes or retunes any alert that pages without leading to action, because an alert that is routinely ignored trains responders to ignore real problems too.

## Incident Response

When an alert pages, the responding engineer acknowledges within five minutes and begins triage by checking the relevant dashboard, recent deploys, and any ongoing maintenance. If the responder cannot form a mitigation plan within fifteen minutes, they escalate to the secondary responder and open an incident channel. Severity is assigned using the standard rubric: Sev1 for full outage or data loss risk, Sev2 for significant degraded functionality, and Sev3 for minor or cosmetic issues. Sev1 and Sev2 incidents require a live incident commander who coordinates communication and delegates investigation tasks, keeping the responding engineers focused on mitigation rather than status updates. Once the immediate impact is resolved, the incident is downgraded and a postmortem is scheduled according to the separate postmortem timing rule maintained by the incident management team.

## Backup & Restore

Database backups run nightly at 02:00 UTC and are retained for forty-five days in cold storage, with a weekly backup additionally retained for one year to support long-horizon audits and compliance requests. Backups are encrypted at rest and validated automatically each week by restoring into an isolated verification environment and running a checksum comparison against a known-good snapshot; any validation failure pages the platform team immediately rather than waiting for a real restore to discover corruption. A full restore from cold storage typically takes between forty and ninety minutes depending on database size, and partial point-in-time restores of a single table can usually be completed within fifteen minutes using the write-ahead log replay tooling. Engineers should never attempt an ad hoc restore against production without platform team sign-off, since an uncoordinated restore can silently overwrite newer data.

## Access Control

Production access is granted through the identity system on a least-privilege basis and expires automatically after ninety days unless renewed with a documented business justification. Break-glass access for emergencies bypasses the normal approval queue but is logged in full and reviewed by security the following business day. Every production credential is scoped to a specific service or database rather than issued broadly, and shared credentials are not permitted under any circumstances. Access reviews happen quarterly, and any account that has not been used in sixty days is automatically revoked and must be re-requested if needed again.

## FAQ

Common questions from new on-call engineers include how to request temporary elevated access during an incident, how to tell whether a canary deploy has actually started, and where to find the historical dashboard for a service that no longer exists in the current fleet topology. Answers to these and other recurring questions are collected here and updated whenever a new question comes up often enough in the incident channel to be worth documenting for the next responder.

## Provenance

- Platform operations workflow record, maintained by the platform team.
