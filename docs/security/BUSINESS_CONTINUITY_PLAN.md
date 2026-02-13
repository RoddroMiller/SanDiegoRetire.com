# Business Continuity Plan

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This plan defines how Portfolio Architect will maintain or restore operations following a disruption. It covers disaster recovery, data recovery, and communication procedures for various failure scenarios.

---

## 2. Recovery Objectives

| Metric | Target | Definition |
|--------|--------|------------|
| **RTO (Recovery Time Objective)** | 4 hours | Maximum acceptable time from disruption to restored service |
| **RPO (Recovery Point Objective)** | 24 hours | Maximum acceptable data loss measured in time (aligned with daily Firestore backup frequency) |

---

## 3. Critical Systems

| System | Provider | SLA | Impact if Unavailable |
|--------|----------|-----|----------------------|
| Firebase Hosting | Google Cloud | 99.95% | Application completely inaccessible |
| Cloud Firestore | Google Cloud | 99.999% | No data reads/writes; application non-functional |
| Firebase Authentication | Google Cloud | 99.95% | Users cannot log in |
| Cloud Functions | Google Cloud | 99.95% | Account lockout, audit logging, password security non-functional; login still works with degraded security |
| GitHub | Microsoft | 99.9% | Cannot deploy code changes or run CI/CD; no impact on running application |

---

## 4. Disaster Scenarios and Recovery Procedures

### 4.1 Firebase Hosting Outage

| Step | Action |
|------|--------|
| 1 | Check [status.cloud.google.com](https://status.cloud.google.com) to confirm outage |
| 2 | If prolonged (>2 hours), communicate to users via email that the service is temporarily unavailable |
| 3 | Monitor status page for resolution |
| 4 | No action needed on recovery — Firebase auto-restores |

**Alternative:** If the outage is specific to our deployment (not a platform outage), rebuild and redeploy: `npm run build && npx firebase deploy --only hosting`

### 4.2 Firestore Data Corruption or Loss

| Step | Action |
|------|--------|
| 1 | Assess scope of data loss (which collections, how many documents) |
| 2 | Stop further writes if corruption is ongoing (deploy restrictive security rules) |
| 3 | Identify the most recent clean backup in GCP Console > Firestore > Backups |
| 4 | Restore the backup to a temporary database to verify integrity |
| 5 | Import the verified backup into the production database |
| 6 | Review audit logs to identify the cause of data loss |
| 7 | Document the incident per the Incident Response Plan |

### 4.3 Firebase Authentication Outage

| Step | Action |
|------|--------|
| 1 | Confirm via status page |
| 2 | Users currently logged in retain their session (Firebase Auth tokens are valid for 1 hour) |
| 3 | New logins will fail until the service is restored |
| 4 | Communicate to users if outage exceeds 1 hour |

### 4.4 Cloud Functions Failure

| Step | Action |
|------|--------|
| 1 | Check Cloud Logging for error patterns |
| 2 | If a bad deployment caused the failure: redeploy from the last known-good commit |
| 3 | If a platform outage: monitor status page; login still works (with degraded security — no lockout enforcement) |
| 4 | Individual functions can be deleted and redeployed: `firebase functions:delete <name>` |

### 4.5 GitHub Repository Loss

| Step | Action |
|------|--------|
| 1 | Local clones of the repository exist on development machines |
| 2 | Create a new repository and push from the local clone |
| 3 | Update CI/CD workflows if the repository URL changes |
| 4 | The running application is unaffected (deployed to Firebase, not served from GitHub) |

### 4.6 Master Account Compromise

| Step | Action |
|------|--------|
| 1 | Follow the Incident Response Plan (Phase 2: Containment) |
| 2 | Disable the master account in Firebase Console |
| 3 | Review audit logs for unauthorized changes |
| 4 | Create a new master account, update `VITE_MASTER_EMAIL` environment variable |
| 5 | Update master email in `firestore.rules` and `functions/index.js` |
| 6 | Rotate all GCP IAM credentials |
| 7 | Rebuild and redeploy: `npm run build && npx firebase deploy` |

### 4.7 Build Pipeline Failure

| Step | Action |
|------|--------|
| 1 | Check GitHub Actions logs for the failure cause |
| 2 | If a dependency issue: update or pin the problematic package, re-run CI |
| 3 | If a platform issue (GitHub Actions outage): deploy manually from local machine using `npm run build && npx firebase deploy` |
| 4 | The running application is unaffected — only new deployments are blocked |

---

## 5. Data Backup Strategy

| Data | Backup Method | Frequency | Retention | Location |
|------|--------------|-----------|-----------|----------|
| Firestore (all collections) | Firebase scheduled backups | Daily | 30 days | Google Cloud Storage |
| Audit logs | Firestore native + future Cloud Storage export | Continuous (triggers) | 7 years | Firestore + future GCS archive |
| Source code | Git repository | Every commit | Indefinite | GitHub + local clones |
| Firebase configuration | `firebase.json`, `firestore.rules` in Git | Every commit | Indefinite | GitHub + local clones |
| Environment variables | Documented in `.env.example` (values in CI secrets) | On change | N/A | CI secrets + local `.env` |

### 5.1 Backup Verification Schedule

| Task | Frequency | Procedure |
|------|-----------|-----------|
| Confirm backups are running | Monthly | Check GCP Console > Firestore > Backups |
| Test restore | Quarterly | Restore latest backup to a non-production instance, verify data integrity |
| Verify Git repository | Monthly | Confirm local clone is current (`git fetch --all`) |

---

## 6. Communication Plan

### 6.1 Internal Communication

| Scenario | Communication Channel | Timeline |
|----------|----------------------|----------|
| Service outage detected | Email / phone to affected advisors | Within 30 minutes |
| Outage resolved | Email confirmation to affected advisors | Within 1 hour of resolution |
| Data loss incident | Per Incident Response Plan | Immediately |

### 6.2 External Communication (Clients)

| Scenario | Communication | Timeline |
|----------|--------------|----------|
| Outage > 4 hours | Email notification that service is temporarily unavailable | As soon as RTO is expected to be exceeded |
| Data breach | Per Incident Response Plan notification procedures | Within 72 hours |

---

## 7. Testing

| Test | Frequency | Procedure |
|------|-----------|-----------|
| Backup restore drill | Quarterly | Restore Firestore backup to non-production instance |
| Failover simulation | Annually | Tabletop exercise walking through a disaster scenario |
| Communication test | Annually | Verify contact information for all personnel is current |

---

## 8. Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-13 | Rodd Miller | Initial plan |
