# Security Policies — Portfolio Architect

These policies document the security controls, procedures, and responsibilities for Portfolio Architect. They are maintained as part of the codebase to ensure they stay in sync with the actual implementation.

## Policies

| Document | Purpose |
|----------|---------|
| [Incident Response Plan](INCIDENT_RESPONSE_PLAN.md) | How to detect, contain, investigate, and recover from security incidents |
| [Data Retention Policy](DATA_RETENTION_POLICY.md) | How long data is kept and how it is securely disposed of |
| [Access Control Policy](ACCESS_CONTROL_POLICY.md) | Who can access what, how access is granted and revoked |
| [Change Management Policy](CHANGE_MANAGEMENT_POLICY.md) | How changes are reviewed, tested, deployed, and rolled back |

## Review Schedule

| Policy | Review Cadence | Next Review |
|--------|---------------|-------------|
| Incident Response Plan | Quarterly | 2026-05-13 |
| Data Retention Policy | Annually | 2027-02-13 |
| Access Control Policy | Quarterly | 2026-05-13 |
| Change Management Policy | Annually | 2027-02-13 |

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
