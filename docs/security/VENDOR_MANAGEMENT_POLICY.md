# Vendor Management Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This policy defines how third-party vendors and services used by Portfolio Architect are evaluated, monitored, and managed to ensure they meet security and compliance requirements.

---

## 2. Vendor Inventory

### 2.1 Critical Vendors (Data Access)

| Vendor | Service | Data Accessed | SOC 2 Status | Contract/Terms |
|--------|---------|--------------|-------------|----------------|
| **Google Cloud / Firebase** | Authentication, Firestore database, Cloud Functions, Hosting | All application data (scenarios, advisor directory, security records, audit logs) | SOC 2 Type II (published annually at [compliance.google.com](https://compliance.google.com)) | Google Cloud Terms of Service |
| **GitHub** | Source code repository, CI/CD (GitHub Actions) | Application source code, security policies, CI/CD configuration | SOC 2 Type II ([github.com/security](https://github.com/security)) | GitHub Terms of Service |

### 2.2 Supporting Vendors (No Direct Data Access)

| Vendor | Service | Data Accessed | SOC 2 Status |
|--------|---------|--------------|-------------|
| **npm Registry** | Package manager for build dependencies | None — packages downloaded at build time | N/A (open-source registry) |
| **QR Server API** | QR code generation for MFA enrollment | TOTP secret URI (transmitted via URL) | N/A |

---

## 3. Vendor Evaluation Criteria

Before onboarding a new vendor that will access, process, or store application data, evaluate:

| Criterion | Requirement |
|-----------|------------|
| **Security certification** | SOC 2 Type II report (preferred) or equivalent (ISO 27001, FedRAMP) |
| **Encryption** | Data encrypted in transit (TLS 1.2+) and at rest |
| **Access controls** | Role-based access, MFA for administrative access |
| **Incident response** | Documented incident notification procedures and SLA |
| **Data residency** | Data stored in regions compliant with applicable regulations |
| **Subprocessors** | Vendor discloses and manages its own subprocessors |
| **Business continuity** | Documented disaster recovery with published RTO/RPO |

---

## 4. Ongoing Monitoring

### 4.1 Annual Review

For each critical vendor, annually:

1. **Obtain current SOC 2 report** — Download from vendor's compliance page. Verify the report covers the services you use and the review period is current.
2. **Review for findings** — Check if any qualified opinions or exceptions were noted. Assess whether findings affect your data.
3. **Verify terms** — Confirm no material changes to terms of service, data processing agreements, or privacy policies.
4. **Document the review** — Record the review date, report period, and any findings in the review log below.

### 4.2 Continuous Monitoring

- **Service status pages** — Monitor for outages that may affect availability.
  - Google Cloud: [status.cloud.google.com](https://status.cloud.google.com)
  - GitHub: [githubstatus.com](https://www.githubstatus.com)
- **Security advisories** — Monitor vendor security bulletins for vulnerabilities affecting your usage.
- **Dependency alerts** — GitHub Dependabot and `npm audit` in CI/CD flag vulnerable dependencies.

---

## 5. Vendor Risk Assessment

| Vendor | Risk Level | Justification |
|--------|-----------|---------------|
| Google Cloud / Firebase | **High dependency, Low risk** | Hosts all application data and compute. Maintains SOC 2 Type II, ISO 27001, FedRAMP. Google's security team is industry-leading. Risk is concentration, not capability. |
| GitHub | **High dependency, Low risk** | Hosts source code and CI/CD. SOC 2 Type II certified. Source code does not contain secrets (environment variables are managed separately). |
| npm Registry | **Medium dependency, Low risk** | Build-time dependency only. Packages are pinned via package-lock.json. CI/CD runs `npm audit` on every build. |
| QR Server API | **Low dependency, Medium risk** | TOTP secret URI is passed via URL during MFA enrollment. Used only once per user during setup. Consider self-hosting QR generation in the future. |

---

## 6. Vendor Offboarding

When discontinuing a vendor:

1. Revoke all API keys, tokens, and access credentials associated with the vendor.
2. Verify that the vendor has deleted or returned any data per their data processing agreement.
3. Update this inventory to remove the vendor.
4. Update CSP and other security configurations to remove vendor domains.
5. Document the offboarding in the review log.

---

## 7. Review Log

| Date | Reviewer | Vendor | Action |
|------|----------|--------|--------|
| 2026-02-13 | Rodd Miller | All vendors | Initial inventory and risk assessment |

---

## 8. Action Items

| Priority | Action | Target Date |
|----------|--------|-------------|
| Medium | Download and file Google Cloud SOC 2 Type II report | 2026-03-15 |
| Medium | Download and file GitHub SOC 2 Type II report | 2026-03-15 |
| Low | Evaluate self-hosted QR code generation to eliminate QR Server API dependency | 2026-06-01 |
