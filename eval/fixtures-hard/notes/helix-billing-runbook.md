---
project: helix
type: source-map
status: active
updated: 2026-05-12
---

# Helix Billing System Reference

## Overview

The Helix billing system reference describes how invoices are generated, how failed payments are retried, how tax is calculated across jurisdictions, how refunds are issued, and how customer disputes are escalated internally. Support and finance staff use this document as the primary reference when a customer asks a billing question that cannot be answered from the account dashboard alone. It is kept in sync with the billing engine's actual behavior rather than the originally designed behavior, because the two have diverged in small ways over several years of incremental changes, and this document exists specifically to capture the current truth.

## Invoice Generation

Invoices are generated automatically on each customer's billing anniversary date, calculated from the day their subscription first became active, and cover usage for the preceding billing period. Usage-based line items are calculated from metered records aggregated hourly, while flat subscription fees are calculated from the plan's list price at the start of the billing period regardless of any mid-period plan change, which is instead reflected as a prorated adjustment line on the following invoice. Draft invoices are available for internal review twenty-four hours before they are finalized and sent, giving finance a window to catch anomalies such as duplicate metering records or obviously incorrect usage spikes before a customer ever sees the invoice.

## Payment Retry Logic

When a payment attempt fails, the billing system retries automatically on a schedule of one day, three days, and seven days after the original failure, using the customer's default payment method each time unless they have updated it in the interim. If all three retries fail, the account is marked past due and the customer receives an email with a self-service link to update payment information; access to premium features is suspended after fourteen days past due, though core account access and data export always remain available regardless of payment status. Support agents can manually trigger an out-of-cycle retry attempt if a customer reports having just fixed their payment method, rather than making them wait for the next scheduled retry.

## Tax Calculation

Tax is calculated per invoice based on the customer's registered billing address and the applicable tax rules for that jurisdiction, using a third-party tax determination service that is updated automatically as tax rules change. Customers with a valid tax exemption certificate on file have tax calculation suppressed entirely for their account, and the exemption is re-verified annually by the finance team to ensure it has not expired. Cross-border transactions apply the destination jurisdiction's rules rather than the origin jurisdiction's rules, which occasionally surprises customers who expect their own local tax treatment to apply regardless of where the seller is registered.

## Refund Handling

Approved refunds are issued to the original payment method within seven business days, capped at the original transaction amount, meaning a refund can never exceed what the customer actually paid even if a manual adjustment would otherwise suggest a larger amount. Partial refunds are supported for usage-based line items when a customer disputes specific metered records, and the refunded amount is deducted from that customer's future usage calculations to avoid double-crediting them. Refunds initiated more than one hundred eighty days after the original charge require finance director approval because the originating payment processor may no longer support a refund to the original method that far out, and an alternate method such as account credit may need to be used instead.

## Dispute Escalation

When a customer formally disputes a charge with their card issuer rather than requesting a refund directly, the billing system automatically flags the account and notifies the finance team, since a formal dispute carries a processing fee regardless of outcome and finance tracks dispute rates as a compliance metric with the payment processor. Support agents are instructed to resolve billing complaints proactively before they escalate to a formal dispute whenever possible, since a resolved refund costs the company nothing beyond the refunded amount while a lost dispute carries the fee on top of the refunded amount. Repeated disputes from the same customer are reviewed manually and may result in a required prepayment arrangement going forward.

## FAQ

Frequently asked billing questions include what happens to unused subscription time when a customer downgrades mid-cycle, whether taxes are refunded proportionally when a partial refund is issued, and how long a suspended account can remain past due before it is permanently canceled and its data scheduled for deletion under the separate data retention policy.

## Provenance

- Billing systems reference, maintained by the finance engineering team.
