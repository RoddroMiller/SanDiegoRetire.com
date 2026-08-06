# Access Control Policy — moved

This policy is **firm-level** and is no longer maintained separately in this repository.

**Canonical location:** `the-one-process/docs/security/ACCESS_CONTROL_POLICY.md`

Portfolio Architect's roles, Firestore rule summary and provisioning process are in
**§7.1** and **§4.1** of that document. The controls that apply identically to both
systems — password policy, MFA, session management, revocation and access reviews —
are stated once in §3, §5 and §6.

Two items specific to this system are worth knowing where to find:

- **§8** records that Firebase Auth's "Enable create (sign-up)" setting must remain
  enabled. Prospect access uses anonymous sign-in, which Firebase treats as a create
  operation, so disabling it blocks prospect sessions entirely — as happened on
  2026-08-05.
- **§9** records that CI does not deploy and holds no secrets, correcting an earlier
  claim that build-time values were stored as GitHub Actions secrets.

The version previously kept here was rewritten on 2026-08-05 to match the
post-security-pass system; that content is carried into the canonical policy rather
than lost.

Retired 2026-08-06.
