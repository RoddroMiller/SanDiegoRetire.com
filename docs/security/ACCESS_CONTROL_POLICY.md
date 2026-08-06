# Access Control Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-08-05
**Review Cadence:** Quarterly

---

## 1. Purpose

This policy defines who can access Portfolio Architect, what they can do, and how access is granted, modified, and revoked. Access follows the principle of least privilege — users get only the permissions they need.

---

## 2. Roles & Permissions

### 2.1 Application Roles

Role is determined by a **server-set custom auth claim**, assigned only by the master through the `setUserRole` Cloud Function. It is never inferred from data a user can create. A user with no claim receives no privileges.

| Role | How Assigned | Permissions |
|------|-------------|-------------|
| **Master** | Login email matches `VITE_MASTER_EMAIL` (default `rmiller@millerwm.com`), or a `role: master` custom claim | Full access: read/write all plans, manage advisor directory, read audit logs, assign roles via `setUserRole` |
| **Advisor** | `role: advisor` custom claim, granted by the master. Not self-assignable and not inferred from activity. | Create plans (must stamp own identity), read/update/delete own plans, read plans belonging to their teams, read the prospect inbox, read advisor directory |
| **Registered Client** | Default state for any authenticated account with no advisor or master claim | Read only plans assigned to their own email address (`assignedClientEmail`); update non-ownership fields on those plans; cannot delete. Note: client logins are disabled (§4.2), so in practice this is the least-privilege landing state for a new or unclaimed account rather than a provisioned role. |
| **Anonymous** | Firebase Anonymous Auth, used by prospective clients | **No read access to any plan.** May create `CLIENT_SUBMISSION` and `CLIENT_PROGRESS` documents, and may update only the `CLIENT_PROGRESS` draft bound to its own session (`ownerUid`). |
| **Unauthenticated** | No Firebase Auth session | No access to any Firestore data |

An account created outside the application (the browser API key is public, so the REST sign-up endpoint is reachable) lands as Registered Client with no claim. It can see no plans and cannot create advisor-owned plans. See §8.

### 2.2 Infrastructure Access

| System | Who Has Access | How Granted |
|--------|---------------|-------------|
| **Firebase Console** | Rodd Miller | Google Cloud IAM (Owner role) |
| **GitHub Repository** | Rodd Miller | GitHub repo admin |
| **Google Cloud Console** | Rodd Miller | GCP project Owner |
| **Firebase Hosting** | Deployed via `firebase deploy` | Requires Firebase CLI authentication |
| **Cloud Functions** | Deployed via `firebase deploy` | Requires Firebase CLI authentication |

---

## 3. Authentication Requirements

### 3.1 Password Policy

| Requirement | Value | Enforced By |
|------------|-------|-------------|
| Minimum length | 12 characters | `passwordValidation.js` (client-side) |
| Complexity | At least 1 special character (`~!@#$%^&*`) | `passwordValidation.js` (client-side) |
| Expiration | 90 days | `checkPasswordExpiry` Cloud Function |
| History | Cannot reuse last 5 passwords | `checkPasswordHistory` Cloud Function (SHA-256 hashes) |
| Account lockout | 5 failed attempts, 15-minute lockout | `checkAccountLockout` / `recordFailedAttempt` Cloud Functions |

Length and complexity are enforced in the browser only. Firebase Authentication's own minimum is 6 characters, so a caller using the public API key directly could set a weaker password than this policy requires. This is accepted because such an account holds no claim and therefore no access (§2.1); the controls that matter are enforced server-side in security rules and Cloud Functions.

### 3.2 Multi-Factor Authentication (MFA)

- **Required for:** all accounts that sign in with a password.
- **Method:** Time-based One-Time Password (TOTP) via Google Authenticator or a compatible app.
- **Enforcement:** an account with zero enrolled factors is routed to enrollment before it can reach the application.
- **Enrollment:** the `otpauth://` URI is issued by Firebase `TotpMultiFactorGenerator`. The QR image is rendered **locally in the browser** by the `qrcode` package. It is never sent to a third-party image service — doing so would place the TOTP shared secret in that service's request logs.

### 3.3 Session Management

| Setting | Value |
|---------|-------|
| Session timeout | 15 minutes of inactivity |
| Warning before timeout | 1 minute |
| Activity tracking | mousedown, keydown, scroll, touchstart, mousemove |
| Throttle | Activity resets checked at most once per second |

---

## 4. Access Provisioning

### 4.1 New Advisor

There is **no self-service signup.** The login screen is login-only; the signup mode was removed.

1. Administrator creates the Firebase Auth account for the advisor.
2. Advisor signs in and enrolls MFA before reaching the application.
3. Master grants the advisor role from Plan Management → **Grant advisor role**, which calls `setUserRole` with the advisor's email. The function resolves the email to a uid server-side and sets the claim, including any team ids and legacy teammate emails that govern team visibility.
4. The advisor must sign out and back in for the new claim to appear in their token.
5. Master adds the advisor to the advisor directory (Firestore `advisors` collection) so they appear in assignment lists.

### 4.2 Clients

**Client logins are disabled.** The client signup path refuses outright rather than creating an account.

- A plan may still be assigned to a client's email address (`assignedClientEmail`). That assignment governs read access if client logins are ever re-enabled, and is enforced server-side today.
- Prospective clients use anonymous sessions (§2.1) and never receive credentials.
- Re-enabling client logins requires restoring the client signup path, confirming MFA enrollment applies to those accounts, and reviewing this policy.

### 4.3 Master Account

- There is exactly one master account, identified by email address.
- Master access is not assignable through the application UI.
- Changing the master email requires updating the `VITE_MASTER_EMAIL` environment variable, the hardcoded address in `firestore.rules`, and `functions/index.js`, followed by redeployment.

---

## 5. Access Revocation

| Trigger | Action | Timeline |
|---------|--------|----------|
| Advisor leaves the firm | Disable Firebase Auth account, revoke the advisor claim via `setUserRole`, remove from advisor directory, reassign plans | Same business day |
| Client relationship ends | Remove `assignedClientEmail` from their plans, follow data retention policy | Within 5 business days |
| Suspected compromise | Disable account, reset password, revoke sessions (see Incident Response Plan) | Immediately |
| Account locked out | Auto-unlocks after 15 minutes. Master can manually reset via the security record. | Automatic |

Revoking a claim does not invalidate an already-issued ID token. Disable the Firebase Auth account as well when removing access, so existing sessions cannot continue until their token expires.

---

## 6. Access Reviews

| Review | Frequency | Reviewer | Process |
|--------|-----------|----------|---------|
| **Advisor claims** | Quarterly | Master | Confirm every account holding a `role: advisor` claim is still an active advisor. |
| **Advisor directory** | Quarterly | Master | Compare `advisors` Firestore collection against active advisors. Remove inactive entries. |
| **Firebase Auth accounts** | Quarterly | Master | Review the user list in Firebase Console → Authentication. Disable departed advisors. Purge stale anonymous sessions. |
| **GCP/Firebase IAM** | Quarterly | Rodd Miller | Review IAM roles in Google Cloud Console. Verify only authorized personnel have access. |
| **GitHub repository access** | Quarterly | Rodd Miller | Review collaborator list. Remove anyone who no longer needs access. |

---

## 7. Firestore Security Rules Summary

All access control is enforced server-side via Firestore security rules and Cloud Functions. Reads are evaluated **per document** — there is no collection-wide read grant.

| Collection | Read | Write |
|-----------|------|-------|
| `artifacts/{appId}/public/data/scenarios` | Master; plan owner; the assigned client; or an advisor for a prospect-inbox, team, or legacy-teammate plan. Anonymous sessions: denied. | **Create:** advisor/master claim plus own identity stamp, or a `CLIENT_SUBMISSION`/`CLIENT_PROGRESS` document. **Update:** owner, master, assigned client (cannot change ownership fields), or a prospect updating the draft bound to its own `ownerUid`. **Delete:** owner or master. |
| `artifacts/{appId}/public/data/advisors` | Authenticated (non-anonymous) | Master only |
| `security/users/*/data` | Denied (admin SDK only) | Denied (admin SDK only) |
| `audit_logs` | Master only | Denied (admin SDK only) |
| Everything else | Denied | Denied |

Because security rules filter documents rather than queries, the application issues targeted queries whose constraints mirror each rule branch. A collection-wide query would be rejected outright.

Rule changes are covered by an emulator test suite (`tests/firestore-rules.test.js`) exercising both allow and deny paths.

---

## 8. Application Integrity Controls

| Control | State | Notes |
|---------|-------|-------|
| **App Check — Cloud Firestore** | Enforced | reCAPTCHA v3 attestation required for Firestore access |
| **App Check — Cloud Functions** | Enforced in code | `onCall({ enforceAppCheck: true })`. Cloud Functions has no console toggle, so this is the only mechanism. Matters most for the pre-login callables (`checkAccountLockout`, `recordFailedAttempt`), which are unauthenticated by design. |
| **App Check — Firebase Authentication** | **Monitoring only, deliberately** | Enforcing it means a failed attestation blocks all sign-in, including the master, recoverable only through the console. |
| **Firebase Auth "Enable create (sign-up)"** | **Must remain enabled** | Prospect access uses anonymous sign-in, which Firebase treats as a create operation. Disabling this setting blocks prospect sessions entirely (`auth/admin-restricted-operation`), even with the Anonymous provider enabled. It was disabled once as a defense against advisor self-signup and broke prospect access until restored. Self-signup is instead contained by §2.1: an unclaimed account has no access. |

---

## Revision History

| Date | Change |
|------|--------|
| 2026-08-05 | Corrected §2.1 (role now a server-set claim, not inferred from activity; anonymous sessions have no read access), §4.1 (self-service signup removed), §4.2 (client logins disabled), §7 (per-document reads, correct collection paths). Added §8 (App Check state and the sign-up setting dependency), MFA QR generation now local, and caveats on client-side password enforcement and claim revocation. |
| 2026-02-13 | Initial policy. |
