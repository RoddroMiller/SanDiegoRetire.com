# Risk Assessment

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This document identifies and assesses the security risks to Portfolio Architect, its data, and its users. Each risk is evaluated for likelihood, impact, and the controls in place to mitigate it. This assessment informs security priorities and resource allocation.

---

## 2. Scope

This assessment covers:
- Portfolio Architect web application (Vite/React SPA on Firebase Hosting)
- Cloud Firestore database (scenarios, advisors, security records, audit logs)
- Firebase Authentication (user accounts, MFA)
- Cloud Functions (audit logging, account security)
- Supporting infrastructure (GitHub, Google Cloud Platform)
- Operational processes (deployment, access management, incident response)

---

## 3. Risk Matrix

| Likelihood | Definition |
|-----------|------------|
| **High** | Expected to occur within the next year |
| **Medium** | Could occur within the next year |
| **Low** | Unlikely to occur within the next year |

| Impact | Definition |
|--------|------------|
| **Critical** | Client PII/financial data exposed, regulatory action, significant business disruption |
| **High** | Unauthorized data access, extended service outage, credential compromise |
| **Medium** | Limited data exposure, short service disruption, policy violation |
| **Low** | Minor security finding, no data exposure, minimal business impact |

---

## 4. Identified Risks

### 4.1 Unauthorized Access

| Attribute | Detail |
|-----------|--------|
| **Risk** | An attacker gains access to a user account through credential stuffing, phishing, or password reuse |
| **Likelihood** | Medium |
| **Impact** | High |
| **Inherent Risk** | High |
| **Mitigating Controls** | MFA enforcement (TOTP), account lockout after 5 failed attempts, 12-character password minimum with special characters, 90-day password expiry, password history (last 5), 15-minute session timeout, gate password for initial access |
| **Residual Risk** | Low |

### 4.2 Master Account Compromise

| Attribute | Detail |
|-----------|--------|
| **Risk** | The master account (rmiller@millerwm.com) is compromised, granting full access to all scenarios, advisor directory, and audit logs |
| **Likelihood** | Low |
| **Impact** | Critical |
| **Inherent Risk** | Critical |
| **Mitigating Controls** | MFA enforcement, strong password policy, session timeout, master role determined by email match in Firestore rules and Cloud Functions, audit logging of all data changes, immediate incident response procedures |
| **Residual Risk** | Medium |

### 4.3 Firestore Security Rule Misconfiguration

| Attribute | Detail |
|-----------|--------|
| **Risk** | A deployment introduces a security rule change that exposes scenario data or advisor directory to unauthorized users |
| **Likelihood** | Medium |
| **Impact** | Critical |
| **Inherent Risk** | Critical |
| **Mitigating Controls** | Automated Firestore rules tests (27 tests) in CI/CD pipeline, security rules reviewed before deployment, catch-all deny rule, security collection fully locked down (admin SDK only) |
| **Residual Risk** | Low |

### 4.4 Cloud Functions Failure

| Attribute | Detail |
|-----------|--------|
| **Risk** | Cloud Functions become unavailable, breaking account lockout, audit logging, or password security |
| **Likelihood** | Low |
| **Impact** | High |
| **Inherent Risk** | Medium |
| **Mitigating Controls** | Google Cloud's 99.95% SLA for Cloud Functions, client-side graceful error handling (login still works if functions fail, with degraded security), Cloud Logging alerts for function errors |
| **Residual Risk** | Low |

### 4.5 Data Breach via API Key Abuse

| Attribute | Detail |
|-----------|--------|
| **Risk** | Firebase API keys (visible in client-side code) are used to access data without authorization |
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Inherent Risk** | Medium |
| **Mitigating Controls** | Firestore security rules enforce all access control server-side (API keys alone grant no data access), security collection denies all client reads/writes, API key restrictions in Google Cloud Console |
| **Residual Risk** | Low |

### 4.6 Insider Threat

| Attribute | Detail |
|-----------|--------|
| **Risk** | An authorized advisor accesses scenarios outside their scope or modifies data maliciously |
| **Likelihood** | Low |
| **Impact** | High |
| **Inherent Risk** | Medium |
| **Mitigating Controls** | Firestore rules enforce owner-based isolation (advisors can only modify their own scenarios), assigned clients have limited update rights (cannot change ownership fields), comprehensive audit logging of all data changes, quarterly access reviews |
| **Residual Risk** | Low |

### 4.7 Third-Party Vendor Compromise

| Attribute | Detail |
|-----------|--------|
| **Risk** | A vendor (Google Cloud, Firebase, GitHub) experiences a security breach affecting our data |
| **Likelihood** | Low |
| **Impact** | Critical |
| **Inherent Risk** | Medium |
| **Mitigating Controls** | All primary vendors maintain SOC 2 Type II compliance, data encrypted at rest and in transit by default, annual vendor security reviews, business continuity plan for vendor outages |
| **Residual Risk** | Low |

### 4.8 Supply Chain Attack (Dependencies)

| Attribute | Detail |
|-----------|--------|
| **Risk** | A compromised npm package introduces malicious code into the build |
| **Likelihood** | Medium |
| **Impact** | High |
| **Inherent Risk** | High |
| **Mitigating Controls** | CI/CD dependency audit (`npm audit --audit-level=high`), Content Security Policy restricting script sources to `'self'` only (Vite bundles all dependencies), package-lock.json pinning, ESLint code quality checks |
| **Residual Risk** | Medium |

### 4.9 Data Loss

| Attribute | Detail |
|-----------|--------|
| **Risk** | Firestore data is accidentally or maliciously deleted |
| **Likelihood** | Low |
| **Impact** | Critical |
| **Inherent Risk** | Medium |
| **Mitigating Controls** | Firestore scheduled backups (daily), audit logging captures all deletes, security rules prevent unauthorized deletion (only owner or master can delete scenarios), Git history preserves all code/config, quarterly backup restore verification |
| **Residual Risk** | Low |

### 4.10 Environment Variable Exposure

| Attribute | Detail |
|-----------|--------|
| **Risk** | Environment variables (`VITE_GATE_PASSWORD`, `VITE_MASTER_EMAIL`) are leaked or committed to source control |
| **Likelihood** | Low |
| **Impact** | High |
| **Inherent Risk** | Medium |
| **Mitigating Controls** | `.env` is gitignored, variables are set in CI secrets for builds, gate password provides only initial access (full auth still required), master email is also enforced in Firestore rules and Cloud Functions |
| **Residual Risk** | Low |

---

## 5. Risk Summary

| Risk | Inherent | Residual | Action Needed |
|------|----------|----------|---------------|
| Unauthorized access | High | Low | Maintain current controls |
| Master account compromise | Critical | Medium | Consider hardware security key as second MFA factor |
| Security rule misconfiguration | Critical | Low | Maintain CI rules tests |
| Cloud Functions failure | Medium | Low | Set up Cloud Logging alerts |
| API key abuse | Medium | Low | Review API key restrictions quarterly |
| Insider threat | Medium | Low | Conduct quarterly access reviews |
| Vendor compromise | Medium | Low | Annual vendor SOC 2 review |
| Supply chain attack | High | Medium | Monitor dependency advisories |
| Data loss | Medium | Low | Enable and verify Firestore backups |
| Environment variable exposure | Medium | Low | Audit CI secrets quarterly |

---

## 6. Action Items

| Priority | Action | Target Date |
|----------|--------|-------------|
| High | Enable Firestore scheduled backups | 2026-03-01 |
| High | Configure Cloud Logging alerts for function errors | 2026-03-01 |
| Medium | Review and restrict Firebase API keys in GCP Console | 2026-03-15 |
| Medium | Consider hardware security key for master account | 2026-04-01 |
| Low | Audit CI secrets and environment variable usage | 2026-06-01 |

---

## 7. Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-13 | Rodd Miller | Initial risk assessment |
