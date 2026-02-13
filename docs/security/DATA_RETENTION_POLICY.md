# Data Retention Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This policy defines how long data is retained in Portfolio Architect and when it is deleted. The goal is to keep data only as long as it serves a business or regulatory purpose, and to dispose of it securely when no longer needed.

---

## 2. Data Categories & Retention Periods

| Data Category | Firestore Collection | Retention Period | Justification |
|--------------|---------------------|-----------------|---------------|
| **Financial plans (scenarios)** | `artifacts/portfolio-architect/public/data/scenarios` | Duration of client relationship + 7 years | SEC/FINRA recordkeeping requirements for investment advisory records |
| **Advisor directory** | `artifacts/portfolio-architect/public/data/advisors` | Duration of employment + 3 years | Business need; regulatory retention for associated persons |
| **Security records** | `security/users/{hashedEmail}/data` | 1 year after last activity | Contains lockout status, failed attempts, password history (hashed). No business need beyond active security enforcement. |
| **Audit logs** | `audit_logs` | 7 years | SEC Rule 17a-4 and SOC 2 audit trail requirements |
| **Firebase Authentication accounts** | Firebase Auth (managed) | Duration of relationship + 7 years | Aligned with financial plan retention |

---

## 3. Data Deletion Procedures

### 3.1 Client-Initiated Deletion

When a client requests account deletion:

1. Delete all scenarios where `assignedClientEmail` matches the client.
2. Delete the client's Firebase Authentication account via Firebase Console.
3. Delete the client's security record from the `security/users/` collection (via admin SDK).
4. Audit log entries referencing the client are **retained** (required for compliance) but the client's email is noted as deleted.
5. Confirm deletion to the client in writing within 30 days.

### 3.2 Advisor Offboarding

When an advisor leaves:

1. Reassign or archive the advisor's scenarios (transfer `advisorId`/`advisorEmail` to another advisor or master).
2. Remove the advisor from the `advisors` directory.
3. Disable the advisor's Firebase Authentication account (do not delete — retain for audit trail).
4. Revoke any Command Center access.

### 3.3 Automated Cleanup (Future)

The following automated processes should be implemented:

- **Security records:** Cloud Function scheduled to delete records with no activity in 1 year.
- **Audit log archival:** Cloud Function scheduled to export audit logs older than 3 years to Cloud Storage (cold storage), delete from Firestore after confirmed export.

> **Current state:** Automated cleanup is not yet implemented. Manual review should be performed quarterly until automation is in place.

---

## 4. Data Backup

| Data | Backup Method | Frequency | Retention |
|------|--------------|-----------|-----------|
| Firestore (all collections) | Firebase scheduled backups (Google Cloud) | Daily | 30 days |
| Audit logs | Firestore native + future Cloud Storage export | Continuous (triggers) | 7 years |
| Source code | GitHub repository | Every push | Indefinite (git history) |

### Backup Verification

- **Monthly:** Spot-check that Firebase backups are running by reviewing Google Cloud Console > Firestore > Backups.
- **Quarterly:** Test restore of a backup to a non-production Firestore instance to verify integrity.

---

## 5. Data Disposal

When data reaches the end of its retention period:

- **Firestore documents:** Delete via admin SDK. Firestore does not retain deleted documents.
- **Firebase Auth accounts:** Delete via Firebase Console or admin SDK.
- **Cloud Storage exports:** Delete from the storage bucket. Verify deletion.
- **Local copies:** Any local exports or backups must be securely deleted (not just moved to trash).

---

## 6. Exceptions

Retention periods may be extended when:
- Data is subject to an active legal hold or regulatory investigation.
- A client dispute is unresolved.
- An audit is in progress.

The Incident Commander (Rodd Miller) must approve any retention extension in writing.
