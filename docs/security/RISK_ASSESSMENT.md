# Risk Assessment — moved

This assessment is **firm-level** and is no longer maintained separately in this
repository.

**Canonical location:** `the-one-process/docs/security/RISK_ASSESSMENT.md`

This system's Environment Variable Exposure risk was carried across as **§4.11
Build-Time Secret Exposure**, with one correction: the copy here claimed the values
were "set in CI secrets for builds." The CI workflow references no secrets and performs
no deployment — the values come from a local gitignored `.env`, and Vite inlines them
into the bundle at build time regardless.

Retired 2026-08-06. See §7 of the canonical assessment for the full record, including
four risks added that neither copy previously contemplated.
