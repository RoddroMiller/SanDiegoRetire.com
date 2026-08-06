# Vendor Management Policy — moved

This policy is **firm-level** and is no longer maintained separately in this repository.

**Canonical location:** `the-one-process/docs/security/VENDOR_MANAGEMENT_POLICY.md`

Portfolio Architect's vendors are covered there. Note two corrections made during
consolidation that affect this system specifically:

- **GitHub has no hosting role.** `sandiegoretire.com` is served by Firebase Hosting,
  not GitHub Pages. GitHub is source control and CI only, and the CI workflow holds no
  secrets and performs no deployment.
- **Fastly** is the CDN in front of Firebase Hosting, as Google's authorised
  subprocessor. Cloudflare has no role in any MWM data path.

The copy previously kept here was the older template: no vendor onboarding section, no
documented exceptions for the Google and GitHub "without undue delay" breach-notification
language, and no review history.

Retired 2026-08-05. See §11 of the canonical policy for the full record.
