# Information Security Program — Portfolio Architect

**Firm:** Miller Wealth Management (independent RIA)
**System:** Portfolio Architect — retirement planning and portfolio projection tool
**Last reviewed:** 2026-08-01
**Owner:** Rodd Miller

> **Status: draft for counsel review.** This document records how the system actually
> works as of the date above, including known gaps. It is deliberately factual rather
> than reassuring — an accurate document is more useful to counsel, and is the version
> that holds up under examination. Items marked **GAP** are unresolved. Items marked
> **FOR COUNSEL** are legal determinations outside the author's competence.

---

## 1. Data inventory

### 1.1 What is collected

Client and prospect data entered by advisors, or by prospects through the public
planning wizard.

**Direct identifiers**
- Full name; partner/spouse name
- Email address
- Phone number

**Financial and demographic data (nonpublic personal information)**
- Current age, retirement age; partner equivalents
- Marital status; retirement status
- Current portfolio value, broken out by account (tax-deferred / Roth / non-qualified,
  plus inherited IRAs)
- Annual savings, annual income, partner annual income
- Current monthly spending and projected retirement spending
- Social Security primary insurance amount (PIA) and claiming age; partner equivalents
- Pension amounts, start age, survivor benefit percentages
- Tax filing status and state of residence
- Life expectancy assumptions for client and partner
- Advisory fee

This constitutes **nonpublic personal information** about natural persons. It contains
no Social Security *numbers*, account numbers, card numbers, or government IDs — only
benefit amounts and balances. No credentials for outside institutions are collected, and
the system holds no custody of assets and initiates no transactions.

### 1.2 Where it lives

| Store | Location | Contents |
|---|---|---|
| Firestore `…/data/scenarios` | GCP `nam5` (US multi-region) | Client plans: all fields above, plus assumptions and projections |
| Firestore `…/data/advisors` | GCP `nam5` | Advisor directory: display name + email only |
| Firestore `security/users/{hashedEmail}/data` | GCP `nam5` | Password history (SHA-256 hashes), failed-attempt counts, lockout timestamps |
| Firestore `audit_logs` | GCP `nam5` | Change history for scenarios, advisors, security records |
| Firebase Authentication | Google-managed | 3 staff accounts; ephemeral anonymous prospect sessions |
| Firestore backups | GCP `nam5` | Daily (31-day retention), weekly (98-day retention) |
| Command Center (`miller-one-process`) | Separate GCP project | Client records and team membership — **outside the scope of this document** |

Hosting: Firebase Hosting, served via Fastly CDN over TLS, at
`portfolio-architect-8b47d.web.app`, `sandiegoretire.com`, and `www.sandiegoretire.com`.
The application is also embedded via iframe on `millerwm.com`, `retiregilbert.com`, and
`www.fmgwebsites.com`; embedded pages load application content directly from Firebase, so
no client data transits those hosts.

### 1.3 Data at rest and in transit

- **At rest:** Google-managed encryption on all Firestore data and backups (AES-256).
- **In transit:** TLS enforced. HSTS set with a two-year max-age and preload.
- **Third parties receiving client data:** none. QR codes are generated in-browser; the
  application makes no outbound calls to non-Google hosts. A Content-Security-Policy
  restricts outbound connections to Google and Firebase origins.

---

## 2. Access control

### 2.1 Who has access

At launch, three people, all Miller Wealth Management staff:

| Person | Role | Scope |
|---|---|---|
| Rodd Miller | `master` | All plans, all administration |
| Dee Ann Gee | `advisor` | Team Alpha plans, own plans, prospect inbox |
| John Harvill | `advisor` | Team Alpha plans, own plans, prospect inbox |

No clients hold logins. Client login was disabled and the account-creation path removed.
Prospects use an anonymous session that can write a draft plan but cannot read any
stored plan.

### 2.2 How access is enforced

Authorization is enforced **server-side** by Firestore security rules. Client-side
filtering is treated as presentation only and is not relied upon as a control.

- **Role** is a custom auth claim set only by the `setUserRole` Cloud Function, which
  rejects any caller other than the master account and writes an audit log entry. Roles
  are never inferred from user-creatable data.
- **Plan reads** are restricted per document to: master; the plan's owner; the assigned
  client; or an advisor for team plans and the unclaimed prospect inbox. Anonymous
  sessions can read no plans.
- **Plan creation** requires the advisor or master claim.
- **Prospect drafts** are bound to the creating session and cannot be read or overwritten
  by another visitor.
- **Security records** and **audit logs** deny all client access; only Cloud Functions
  using the admin SDK may touch them.

Rules are covered by an automated test suite (50 tests) exercising both permitted and
denied paths, runnable against the Firestore emulator via `npm run test:rules`.

### 2.3 Authentication controls

- **Multi-factor authentication is mandatory** for all staff accounts (TOTP). Users
  without an enrolled factor are forced through enrollment before reaching the app.
- **Account lockout:** 5 failed attempts triggers a 15-minute lockout.
- **Password policy:** complexity requirements enforced; 90-day expiry; last 5 passwords
  retained as hashes to prevent reuse.
- **Session timeout:** automatic logout after 15 minutes of inactivity.
- **Self-service account creation is disabled**, both in the application and at the
  Firebase Authentication layer. Accounts are provisioned by the master account only.
- **App Check** (reCAPTCHA v3) is enforced on Firestore and on all callable functions,
  so requests must originate from the genuine application. This is the only gate on the
  pre-authentication callables (lockout, password expiry), which by design cannot check
  an authenticated identity.

### 2.4 Administrative access

Google Cloud / Firebase console access is held by Rodd Miller. **GAP:** console access is
not covered by a documented review cadence, and no formal offboarding checklist exists for
removing application, console, and Command Center access when a staff member departs.

---

## 3. Incident response

### 3.1 Detection

- **Audit logs** record create, update, and delete on plans, advisor records, and security
  records, with actor identity and changed fields. Readable by master only; not writable
  from any client.
- **Firebase Authentication** records last sign-in per account, allowing review for
  unrecognized access.
- **App Check metrics** show verified vs. unverified request volume; a rise in unverified
  traffic indicates attempted access from outside the application.

**GAP:** detection is manual and review-driven. There is no alerting on anomalous
activity — no notification on unusual read volume, repeated lockouts, or role changes.

### 3.2 Containment

Available immediately, without a code deploy:
- Revoke a user's role claim via `setUserRole`, removing data access on their next token
  refresh (within 1 hour, or immediately on re-authentication).
- Disable or delete an account in the Firebase console, ending access at once.
- Tighten or disable App Check enforcement.
- Firestore rules can be redeployed in roughly one minute to restrict access further.

### 3.3 Recovery

- **Point-in-time recovery:** enabled, 7-day window, recovering to any microsecond within
  it. Appropriate for corruption or mistaken deletion noticed within a week.
- **Backups:** daily (31-day retention) and weekly (98-day retention).
- **Delete protection:** enabled on the production database.
- **Restore tested:** 2026-08-01. The 10:57 daily backup was restored into a separate
  database, contents verified, and the copy deleted. Restores create a new database and
  never overwrite production.

### 3.4 Notification

**FOR COUNSEL.** The 2024 amendments to Regulation S-P introduce incident-response
program and customer-notification obligations, generally requiring notification within 30
days of determining that unauthorized access to sensitive customer information has
occurred. The firm's specific obligations, thresholds, and notification content require
legal determination. No notification template or decision procedure exists yet — **GAP**.

---

## 4. Retention and disposal

### 4.1 Current behavior

- **Live records are retained indefinitely.** There is no automatic expiry or deletion of
  client plans. Records persist until manually deleted.
- **Backups** retain deleted data for a further 31 days (daily) or 98 days (weekly).
- **Point-in-time recovery** retains prior versions for 7 days.
- **Audit logs** are retained indefinitely with no expiry policy.

### 4.2 Deletion does not propagate

Two behaviors that matter for any deletion request, both verified 2026-08-01:

1. **Deleting a Firebase Authentication account does not delete that person's Firestore
   data.** Plans and directory entries created by that account persist and remain
   attributed to the deleted identity. Confirmed during restore testing, where a deleted
   duplicate account's directory entry reappeared in the restored copy.
2. **Deleted data survives in backups** for the full retention period regardless. A record
   deleted today remains recoverable from backups for up to 98 days.

Neither is a defect — both are expected behavior for a backed-up system — but a deletion
request cannot be answered with "deleted immediately and everywhere," and any
representation to a client should reflect that.

### 4.3 Retention requirement

**This system is not the firm's system of record.**

Portfolio Architect is a working modeling tool. Plans in it are live and change as
assumptions are revised. Any version actually presented to a client is printed to PDF and
filed in that client's file, maintained outside this application. The firm's books and
records obligations are therefore satisfied by the client file, not by this database, and
no multi-year retention or immutable-archive requirement attaches to this system.

*This operational step belongs in the MWM standard operating procedures — the control
only works if the PDF is reliably produced and filed. See §4.4.*

**FOR COUNSEL (lower priority than previously assessed):** confirm that the
print-to-PDF-and-file practice satisfies the applicable recordkeeping rules for advice
presented to clients, and that no obligation attaches to intermediate modeling data.

### 4.4 Data minimization — the remaining consideration

Because this system is *not* the record of authority, indefinite retention here is
unnecessary rather than required. That inverts the usual analysis:

- The application holds client nonpublic personal information — names, contact details,
  portfolio balances, income, Social Security benefit amounts — **indefinitely, with no
  expiry.**
- Safeguarding obligations attach to that data regardless of whether retention obligations
  do. Data the firm holds is data the firm must protect, and data it can lose.
- Every plan retained past its usefulness enlarges the exposure in a breach without
  serving a records purpose, since the authoritative copy is already in the client file.

**GAP (medium):** there is no policy or mechanism for purging stale plans. Worth deciding
a working retention period for modeling data — for instance, purge prospect drafts after N
months and closed-client plans after N years — and applying it. This reduces exposure and
is straightforward to implement once the period is chosen.

An operational dependency worth naming: if a plan is deleted here and no PDF was filed,
the record of what was presented is gone. The purge policy and the print-to-file SOP have
to be consistent with each other.

---

## 5. Known gaps summary

| # | Gap | Severity |
|---|---|---|
| 1 | No incident-notification procedure or template (Reg S-P) | **High** |
| 2 | Print-to-PDF-and-file step is the firm's records control but is not yet written into the MWM SOPs | **High** — the control only works if documented and followed |
| 3 | No purge policy for stale plans; client NPI retained indefinitely in a system that is not the record of authority | Medium |
| 4 | No alerting on anomalous activity; detection is manual | Medium |
| 5 | No documented access review cadence or offboarding checklist | Medium |
| 6 | Command Center project (`miller-one-process`) not covered by this review; App Check not enforced there | Medium |
| 7 | 7 moderate dependency vulnerabilities remain (transitive; no fix without further major upgrades) | Low |
| 8 | `index.html` cached up to 1 hour, delaying propagation of emergency fixes | Low |

*Revised 2026-08-01: the original #1 and #2 (immutable archive, retention period) were
written on the assumption that this system was the record of authority. It is not — see
§4.3 — so those are withdrawn and replaced by the SOP and data-minimization items.*

---

## 6. Change history

| Date | Change |
|---|---|
| 2026-08-01 | Initial document. Reflects the security remediation completed 2026-07-31 to 2026-08-01: restricted plan reads to a per-document server-enforced model; removed self-service account creation; moved role determination to server-set auth claims; eliminated third-party transmission of MFA secrets; scoped prospect drafts to their session; enabled and enforced App Check; enabled point-in-time recovery and delete protection; tested restore; cleared all critical and high dependency vulnerabilities. |
