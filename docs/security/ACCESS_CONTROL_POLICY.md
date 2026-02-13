# Access Control Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Quarterly

---

## 1. Purpose

This policy defines who can access Portfolio Architect, what they can do, and how access is granted, modified, and revoked. Access follows the principle of least privilege — users get only the permissions they need.

---

## 2. Roles & Permissions

### 2.1 Application Roles

| Role | How Assigned | Permissions |
|------|-------------|-------------|
| **Master** | Email matches `VITE_MASTER_EMAIL` env var (currently `rmiller@millerwm.com`) | Full access: read/write all scenarios, manage advisor directory, read audit logs, assign roles via `setUserRole` Cloud Function |
| **Advisor** | Any authenticated user who has created scenarios (or new users by default) | Create scenarios (stamped with own identity), read/update/delete own scenarios, read advisor directory |
| **Registered Client** | Any authenticated user with plans assigned to them (via `assignedClientEmail`) | Read assigned scenarios, update non-ownership fields on assigned scenarios, cannot delete |
| **Anonymous** | Signed in via Firebase Anonymous Auth (prospective clients) | Read scenarios (for role determination), create `CLIENT_SUBMISSION` and `CLIENT_PROGRESS` documents only |
| **Unauthenticated** | No Firebase Auth session | No access to any Firestore data |

### 2.2 Infrastructure Access

| System | Who Has Access | How Granted |
|--------|---------------|-------------|
| **Firebase Console** | Rodd Miller | Google Cloud IAM (Owner role) |
| **GitHub Repository** | Rodd Miller | GitHub repo admin |
| **Google Cloud Console** | Rodd Miller | GCP project Owner |
| **Firebase Hosting** | Deployed via CI/CD or `firebase deploy` | Requires Firebase CLI authentication |
| **Cloud Functions** | Deployed via CI/CD or `firebase deploy` | Requires Firebase CLI authentication |

---

## 3. Authentication Requirements

### 3.1 Password Policy

| Requirement | Value | Enforced By |
|------------|-------|-------------|
| Minimum length | 12 characters | `passwordValidation.js` (client-side) |
| Complexity | At least 1 special character | `passwordValidation.js` (client-side) |
| Expiration | 90 days | `checkPasswordExpiry` Cloud Function |
| History | Cannot reuse last 5 passwords | `checkPasswordHistory` Cloud Function (SHA-256 hashes) |
| Account lockout | 5 failed attempts, 15-minute lockout | `checkAccountLockout` / `recordFailedAttempt` Cloud Functions |

### 3.2 Multi-Factor Authentication (MFA)

- **Required for:** All advisors and registered clients.
- **Method:** Time-based One-Time Password (TOTP) via Google Authenticator or compatible app.
- **Enforcement:** Users without MFA enrolled are redirected to enrollment before accessing the application.
- **Enrollment:** QR code generated via Firebase `TotpMultiFactorGenerator`.

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

1. Advisor creates account via the signup form (email + password).
2. Password must meet policy requirements.
3. MFA enrollment is required immediately after signup.
4. Master adds the advisor to the advisor directory (Firestore `advisors` collection).
5. Advisor can now create and manage their own financial plans.

### 4.2 New Client

1. Advisor assigns a plan to the client's email via `assignedClientEmail`.
2. Client creates account via the client signup form.
3. Password must meet policy requirements.
4. MFA enrollment is required immediately after signup.
5. Client can view and update their assigned plans (cannot change ownership fields).

### 4.3 Master Account

- There is exactly one master account, identified by email address.
- Master access is not assignable through the application UI.
- Changing the master email requires updating the `VITE_MASTER_EMAIL` environment variable, `firestore.rules`, and `functions/index.js`, followed by redeployment.

---

## 5. Access Revocation

| Trigger | Action | Timeline |
|---------|--------|----------|
| Advisor leaves the firm | Disable Firebase Auth account, remove from advisor directory, reassign scenarios | Same business day |
| Client relationship ends | Disable Firebase Auth account, follow data retention policy | Within 5 business days |
| Suspected compromise | Disable account, reset password, revoke sessions (see Incident Response Plan) | Immediately |
| Account locked out | Auto-unlocks after 15 minutes. Master can manually reset via security record. | Automatic |

---

## 6. Access Reviews

| Review | Frequency | Reviewer | Process |
|--------|-----------|----------|---------|
| **Advisor directory** | Quarterly | Master | Compare `advisors` Firestore collection against active advisors. Remove any inactive entries. |
| **Firebase Auth accounts** | Quarterly | Master | Review user list in Firebase Console > Authentication. Disable accounts for departed advisors/clients. |
| **GCP/Firebase IAM** | Quarterly | Rodd Miller | Review IAM roles in Google Cloud Console. Verify only authorized personnel have access. |
| **GitHub repository access** | Quarterly | Rodd Miller | Review collaborator list. Remove anyone who no longer needs access. |

---

## 7. Firestore Security Rules Summary

All access control is enforced server-side via Firestore security rules and Cloud Functions:

| Collection | Read | Write |
|-----------|------|-------|
| `scenarios` | Any signed-in user | Create: own identity stamp required. Update: owner, assigned client (limited), or master. Delete: owner or master. |
| `advisors` | Authenticated (non-anonymous) | Master only |
| `security/users/*/data` | Denied (admin SDK only) | Denied (admin SDK only) |
| `audit_logs` | Master only | Denied (admin SDK only) |
| Everything else | Denied | Denied |
