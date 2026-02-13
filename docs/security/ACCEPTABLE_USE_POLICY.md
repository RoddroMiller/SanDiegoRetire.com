# Acceptable Use Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This policy defines the acceptable use of Portfolio Architect, its data, and its supporting infrastructure. All users — including advisors, registered clients, administrators, and anyone with access to the application's systems — must comply with this policy.

---

## 2. Scope

This policy applies to:
- All users of the Portfolio Architect web application
- All personnel with access to Firebase Console, Google Cloud Console, or GitHub
- All devices used to access the application or its infrastructure

---

## 3. Acceptable Use

### 3.1 Application Use

Users **may**:
- Access financial scenarios within their authorized scope (advisors: own scenarios; clients: assigned scenarios; master: all scenarios)
- Create, update, and delete scenarios within the permissions defined by their role
- Use the Command Center for portfolio analysis on authorized client data
- Export or print scenario data for authorized business purposes

### 3.2 Infrastructure Use

Authorized personnel **may**:
- Deploy code changes following the Change Management Policy
- Access Firebase Console and GCP Console for application administration
- Access the GitHub repository for development and code review
- Use CI/CD pipelines for automated testing and deployment

---

## 4. Prohibited Use

### 4.1 Data Handling

Users **must not**:
- Access scenarios or client data outside their authorized scope
- Share login credentials with any other person
- Store client PII or financial data on personal devices, USB drives, or unauthorized cloud services
- Email client financial data in unencrypted form
- Copy client data to unauthorized systems or applications
- Retain client data after the business relationship has ended (per Data Retention Policy)
- Enter Social Security numbers or other sensitive PII into scenario text fields (SSN pattern detection will block this)

### 4.2 Account Security

Users **must not**:
- Share their password or MFA device with anyone
- Use the same password for Portfolio Architect as for other services
- Disable or bypass MFA enrollment
- Share the gate password with unauthorized individuals
- Attempt to access another user's account
- Attempt to circumvent account lockout protections

### 4.3 System Use

Users **must not**:
- Attempt to access Firestore collections outside their authorized scope
- Attempt to modify security rules, Cloud Functions, or hosting configuration without authorization
- Use the application for any purpose unrelated to Miller Wealth Management business
- Introduce malicious code, scripts, or unauthorized browser extensions that interact with the application
- Perform security testing (penetration testing, vulnerability scanning) without written authorization from the Information Security Owner

---

## 5. Device Requirements

Users accessing Portfolio Architect should:
- Keep their operating system and browser up to date with security patches
- Use a supported modern browser (Chrome, Firefox, Safari, Edge — current version or one version prior)
- Enable device lock screen / password protection
- Not access the application from public or shared computers when handling sensitive client data

---

## 6. Reporting Obligations

All users **must** report the following to the Information Security Owner (rmiller@millerwm.com) immediately:
- Suspected unauthorized access to their account or client data
- Lost or stolen devices that have been used to access the application
- Phishing emails or social engineering attempts targeting their account
- Any behavior that violates this policy

---

## 7. Enforcement

Violation of this policy may result in:

| Severity | Example | Consequence |
|----------|---------|-------------|
| **Minor** | Accessing the application from an unpatched browser | Warning and required remediation |
| **Moderate** | Storing client data on an unauthorized personal device | Access suspension pending review |
| **Severe** | Sharing credentials, accessing unauthorized data, data exfiltration | Immediate access revocation, investigation per Incident Response Plan, potential termination and legal action |

---

## 8. Acknowledgment

All users with access to Portfolio Architect should acknowledge they have read and understand this policy. For advisors and registered clients, this acknowledgment should be part of the onboarding process.

---

## 9. Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-13 | Rodd Miller | Initial policy |
