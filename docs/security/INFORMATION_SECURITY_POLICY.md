# Information Security Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This policy establishes the information security program for Portfolio Architect, a web application operated by Miller Wealth Management. It defines the security objectives, scope, roles, and governance structure that all other security policies operate under.

---

## 2. Scope

This policy applies to:
- All systems and data associated with the Portfolio Architect application
- All users of the application (master, advisors, registered clients, anonymous users)
- All personnel with access to the application's infrastructure (Firebase, Google Cloud, GitHub)
- All third-party vendors and services used by the application

---

## 3. Security Objectives

1. **Confidentiality** — Client financial data and PII are accessible only to authorized users with a legitimate business need.
2. **Integrity** — Data is accurate, complete, and protected from unauthorized modification. All changes are logged.
3. **Availability** — The application is available to authorized users when needed, with documented recovery procedures for outages.

---

## 4. Governance

### 4.1 Roles and Responsibilities

| Role | Person | Responsibilities |
|------|--------|-----------------|
| **Information Security Owner** | Rodd Miller | Overall accountability for the security program. Approves policies, reviews incidents, authorizes access changes. |
| **System Administrator** | Rodd Miller | Manages Firebase, GCP, and GitHub infrastructure. Deploys code and configuration changes. |
| **Advisors** | Firm advisors | Comply with security policies. Report suspected incidents. Protect client data within their scope. |
| **Registered Clients** | Assigned clients | Comply with security policies. Report suspected incidents. Access only assigned scenarios. |

As the team grows, security responsibilities will be distributed and documented.

### 4.2 Policy Governance

- All security policies are maintained in version control (`docs/security/`) alongside the application code.
- Policies are reviewed on their documented cadence (quarterly or annually).
- Policy changes follow the Change Management Policy and are tracked in Git history.
- The Information Security Owner approves all policy changes.

---

## 5. Sub-Policies

This policy is supported by the following detailed policies:

| Policy | Scope | Review Cadence |
|--------|-------|---------------|
| [Access Control Policy](ACCESS_CONTROL_POLICY.md) | Authentication, authorization, provisioning, revocation | Quarterly |
| [Change Management Policy](CHANGE_MANAGEMENT_POLICY.md) | Development, deployment, rollback procedures | Annually |
| [Data Retention Policy](DATA_RETENTION_POLICY.md) | Data lifecycle, deletion, backups | Annually |
| [Incident Response Plan](INCIDENT_RESPONSE_PLAN.md) | Detection, containment, recovery, notification | Quarterly |
| [Risk Assessment](RISK_ASSESSMENT.md) | Threat identification, likelihood, impact, mitigations | Annually |
| [Vendor Management Policy](VENDOR_MANAGEMENT_POLICY.md) | Third-party evaluation, monitoring, risk | Annually |
| [Business Continuity Plan](BUSINESS_CONTINUITY_PLAN.md) | Disaster recovery, RTO/RPO, failover | Annually |
| [Encryption Policy](ENCRYPTION_POLICY.md) | Data in transit, data at rest, key management | Annually |
| [Acceptable Use Policy](ACCEPTABLE_USE_POLICY.md) | Authorized use of systems, data handling rules | Annually |

---

## 6. Security Controls Summary

### 6.1 Technical Controls

| Control | Implementation |
|---------|---------------|
| Server-side access control | Firestore security rules with role-based access (master via email match, owner via advisorId/advisorEmail, client via assignedClientEmail) |
| Audit logging | Cloud Functions Firestore triggers log all data changes to `audit_logs` collection |
| Account lockout | Cloud Functions enforce 5-attempt lockout with 15-minute duration |
| Password policy | 12-char minimum, special character required, 90-day expiry, last 5 history |
| Multi-factor authentication | TOTP required for all users via Firebase Auth |
| Session management | 15-minute inactivity timeout with 1-minute warning |
| Gate password | Application-level gate password for initial access (environment variable) |
| Encryption in transit | TLS enforced via HSTS (max-age 2 years, includeSubDomains, preload) |
| Encryption at rest | Google Cloud default encryption (AES-256) for all Firestore data |
| Security headers | CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy |
| CI/CD security | Automated lint, build, Firestore rules tests (27 tests), functions syntax validation, dependency auditing |
| PII detection | SSN pattern blocking via `piiValidation.js` |

### 6.2 Administrative Controls

| Control | Implementation |
|---------|---------------|
| Access reviews | Quarterly review of Firebase Auth users, advisor directory, GCP IAM |
| Policy reviews | Per documented cadence (quarterly/annually) |
| Vendor reviews | Annual review of vendor SOC 2 reports |
| Risk assessment | Annual threat and vulnerability assessment |
| Incident response | Documented response plan with severity levels and escalation procedures |
| Change management | CI/CD pipeline, code review, deployment checklists |

---

## 7. Compliance

This security program is designed to satisfy:
- **SOC 2 Type II** Trust Services Criteria (Security, Confidentiality, Availability)
- **SEC/FINRA** recordkeeping and data protection requirements for registered investment advisors
- Industry best practices for web application security (OWASP)

---

## 8. Exceptions

Any exception to this policy or its sub-policies must be:
1. Documented in writing with justification.
2. Approved by the Information Security Owner.
3. Time-limited with a remediation plan.
4. Reviewed at the next policy review cycle.

---

## 9. Enforcement

Violation of this policy may result in:
- Immediate revocation of system access.
- Disciplinary action up to and including termination.
- Notification to affected clients per the Incident Response Plan.

---

## 10. Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-13 | Rodd Miller | Initial policy |
