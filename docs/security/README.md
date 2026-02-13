# Security Policies — Portfolio Architect

These policies document the security controls, procedures, and responsibilities for Portfolio Architect. They are maintained as part of the codebase to ensure they stay in sync with the actual implementation.

## Policies

| Document | Purpose |
|----------|---------|
| [Information Security Policy](INFORMATION_SECURITY_POLICY.md) | Overarching security program: objectives, governance, and controls summary |
| [Access Control Policy](ACCESS_CONTROL_POLICY.md) | Who can access what, how access is granted and revoked |
| [Change Management Policy](CHANGE_MANAGEMENT_POLICY.md) | How changes are reviewed, tested, deployed, and rolled back |
| [Data Retention Policy](DATA_RETENTION_POLICY.md) | How long data is kept and how it is securely disposed of |
| [Incident Response Plan](INCIDENT_RESPONSE_PLAN.md) | How to detect, contain, investigate, and recover from security incidents |
| [Risk Assessment](RISK_ASSESSMENT.md) | Identified threats, likelihood, impact, and mitigating controls |
| [Vendor Management Policy](VENDOR_MANAGEMENT_POLICY.md) | Third-party vendor evaluation, monitoring, and risk management |
| [Business Continuity Plan](BUSINESS_CONTINUITY_PLAN.md) | Disaster recovery, backup strategy, RTO/RPO objectives |
| [Encryption Policy](ENCRYPTION_POLICY.md) | Data encryption in transit and at rest |
| [Acceptable Use Policy](ACCEPTABLE_USE_POLICY.md) | Authorized use of systems and data handling rules |

## Review Schedule

| Policy | Review Cadence | Next Review |
|--------|---------------|-------------|
| Information Security Policy | Annually | 2027-02-13 |
| Access Control Policy | Quarterly | 2026-05-13 |
| Change Management Policy | Annually | 2027-02-13 |
| Data Retention Policy | Annually | 2027-02-13 |
| Incident Response Plan | Quarterly | 2026-05-13 |
| Risk Assessment | Annually | 2027-02-13 |
| Vendor Management Policy | Annually | 2027-02-13 |
| Business Continuity Plan | Annually | 2027-02-13 |
| Encryption Policy | Annually | 2027-02-13 |
| Acceptable Use Policy | Annually | 2027-02-13 |

## Technical Controls Summary

These policies reference the following technical controls implemented in code:

- **Firestore security rules** (`firestore.rules`) — Server-side access control
- **Cloud Functions** (`functions/index.js`) — Audit logging, account lockout, password security
- **Security headers** (`firebase.json`) — HSTS, CSP, X-Frame-Options, etc.
- **CI/CD pipeline** (`.github/workflows/ci.yml`) — Automated build, lint, rules tests, dependency audit
- **MFA enforcement** (`src/hooks/useAuth.js`) — TOTP-based multi-factor authentication
- **Session timeout** (`src/hooks/useSessionTimeout.js`) — 15-minute inactivity logout
- **Password policy** (`src/utils/passwordValidation.js`) — 12-char minimum, special character, 90-day expiry, history of 5
- **PII detection** (`src/utils/piiValidation.js`) — SSN pattern blocking
