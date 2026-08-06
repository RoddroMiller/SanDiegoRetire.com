# Data Retention Policy — moved

This policy is **firm-level** and is no longer maintained separately in this repository.

**Canonical location:** `the-one-process/docs/security/DATA_RETENTION_POLICY.md`

Portfolio Architect's retention table is **§2.2** of that document. Three things found
during consolidation apply to this system specifically:

- **§3.3 — the copy here asserted a control that does not exist.** It described an
  `archiveOldAuditLogs` Cloud Function running weekly and deleting audit logs older than
  seven years. This project has **no scheduled functions at all**. Audit logs and
  security records accumulate here with no automated disposal, and closing that is a
  High action item in the canonical policy.
- **§1.2 — the recordkeeping basis was wrong.** Both copies cited SEC Rule 17a-4, which
  governs broker-dealers. The applicable rule for a registered investment adviser is
  Advisers Act Rule 204-2, with a five-year minimum.
- **§2.3 — prospect drafts and anonymous Auth accounts have no defined retention
  period** and accumulate indefinitely.

Retired 2026-08-06. See §7 of the canonical policy for the full record.
