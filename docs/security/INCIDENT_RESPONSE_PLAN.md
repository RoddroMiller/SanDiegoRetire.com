# Incident Response Plan

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Quarterly

---

## 1. Scope

This plan covers security incidents affecting Portfolio Architect and its supporting infrastructure: Firebase Authentication, Cloud Firestore, Cloud Functions, and Firebase Hosting.

A **security incident** is any event that compromises the confidentiality, integrity, or availability of client data or the application itself. Examples include unauthorized access, data breaches, credential compromise, service outages, and malicious code injection.

---

## 2. Severity Levels

| Level | Definition | Examples | Response Time |
|-------|-----------|----------|---------------|
| **Critical** | Active breach or data exposure of client PII/financial data | Unauthorized Firestore access, leaked credentials, master account compromise | Immediate (< 1 hour) |
| **High** | Confirmed unauthorized access attempt or service degradation | Repeated account lockouts across multiple users, Cloud Functions failure, security rule misconfiguration | < 4 hours |
| **Medium** | Suspicious activity or potential vulnerability discovered | Unusual login patterns, dependency vulnerability (high severity), failed deployment with security implications | < 24 hours |
| **Low** | Minor security improvement or informational finding | Dependency vulnerability (moderate), lint warning in security code, documentation gap | Next business day |

---

## 3. Incident Response Team

| Role | Person | Contact |
|------|--------|---------|
| **Incident Commander** | Rodd Miller | rmiller@millerwm.com |
| **Technical Lead** | Rodd Miller | rmiller@millerwm.com |
| **Communications** | Rodd Miller | rmiller@millerwm.com |

As the team grows, these roles should be separated. The Incident Commander has authority to take the application offline if necessary.

---

## 4. Response Phases

### Phase 1: Detection & Triage

**Detection sources:**
- Firebase Console alerts (Cloud Logging)
- Audit log anomalies in `audit_logs` Firestore collection
- GitHub Actions CI failures (dependency audit, rules tests)
- User reports of unexpected behavior
- Account lockout notifications in security records

**Triage steps:**
1. Assess severity using the table above.
2. If Critical or High, proceed immediately to Phase 2.
3. Document the incident: what happened, when, how it was detected.

### Phase 2: Containment

**Immediate actions by incident type:**

| Incident | Containment Action |
|----------|--------------------|
| Compromised user account | Disable account in Firebase Console > Authentication. Reset password. Revoke sessions. |
| Master account compromise | Rotate master account password. Review audit logs for unauthorized changes. Revoke all active sessions. |
| Firestore data breach | Deploy restrictive security rules (`allow read, write: if false` on affected collections). |
| Malicious code in deployment | Roll back Firebase Hosting to previous version via Firebase Console > Hosting > Release History. |
| Cloud Functions compromise | Delete affected functions via `firebase functions:delete <name>`. Redeploy from known-good commit. |
| API key abuse | Restrict API key in Google Cloud Console > APIs & Services > Credentials. |

### Phase 3: Investigation

1. **Review audit logs:** Query `audit_logs` collection for the affected time window. Filter by `userId`, `collection`, or `action`.
2. **Review Cloud Logging:** Check Firebase Functions logs in Google Cloud Console > Logging for error patterns.
3. **Review GitHub history:** Check `git log` for recent deployments. Identify the commit that introduced the issue.
4. **Preserve evidence:** Export relevant Firestore documents and Cloud Logging entries before any cleanup.

### Phase 4: Remediation

1. Fix the root cause (code change, rule update, credential rotation).
2. Deploy the fix through the standard CI/CD pipeline (GitHub Actions).
3. Verify the fix by running Firestore rules tests and manual smoke testing.
4. Re-enable any services that were taken offline during containment.

### Phase 5: Notification

**Client notification required when:**
- Client PII or financial data was accessed by an unauthorized party.
- Client accounts were compromised.
- Service was unavailable for more than 4 hours.

**Notification timeline:** Within 72 hours of confirmed breach (per industry best practice and regulatory requirements).

**Notification content:**
- What happened (plain language, no jargon)
- What data was affected
- What we did to fix it
- What the client should do (e.g., change password)
- Contact information for questions

### Phase 6: Post-Incident Review

Within 5 business days of resolution:
1. Write a post-incident report documenting timeline, root cause, and remediation.
2. Identify process improvements to prevent recurrence.
3. Update this plan if gaps were identified.
4. File the report in `docs/security/incidents/` (create directory as needed).

---

## 5. Communication Templates

### Internal Escalation
```
INCIDENT: [Brief description]
SEVERITY: [Critical/High/Medium/Low]
DETECTED: [Timestamp]
IMPACT: [What is affected]
STATUS: [Investigating/Contained/Resolved]
NEXT STEPS: [What happens next]
```

### Client Notification
```
Subject: Security Notice — Portfolio Architect

We are writing to inform you of a security incident that may affect
your account. [Description of what happened and what data was involved.]

We have [actions taken to resolve the issue].

We recommend that you [recommended client actions].

If you have questions, please contact [contact info].
```

---

## 6. Regular Testing

- **Quarterly:** Review this plan for accuracy.
- **Annually:** Conduct a tabletop exercise simulating a Critical incident.
- **After every incident:** Update the plan based on lessons learned.
