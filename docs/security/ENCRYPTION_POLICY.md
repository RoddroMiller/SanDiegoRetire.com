# Encryption Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This policy documents how data is encrypted in transit and at rest for Portfolio Architect, ensuring confidentiality and integrity of client financial data and PII.

---

## 2. Data in Transit

| Layer | Encryption | Enforced By |
|-------|-----------|-------------|
| **Browser to Firebase Hosting** | TLS 1.2+ (HTTPS) | Firebase Hosting enforces HTTPS by default; HSTS header (`max-age=63072000; includeSubDomains; preload`) prevents downgrade |
| **Browser to Firebase Auth** | TLS 1.2+ (HTTPS) | Firebase SDK communicates over HTTPS exclusively |
| **Browser to Cloud Functions** | TLS 1.2+ (HTTPS) | Cloud Functions callable endpoints are HTTPS-only |
| **Browser to Cloud Firestore** | TLS 1.2+ (HTTPS) | Firestore SDK communicates over HTTPS/gRPC with TLS |
| **Cloud Functions to Firestore** | TLS (internal) | Google Cloud internal networking with encryption |

All data in transit is encrypted. There are no unencrypted communication channels.

---

## 3. Data at Rest

| Data Store | Encryption | Key Management |
|-----------|-----------|----------------|
| **Cloud Firestore** | AES-256 (default encryption) | Google-managed encryption keys (GMEK). Each data chunk is encrypted with a unique data encryption key (DEK), which is itself encrypted with a key encryption key (KEK) managed by Google's Key Management Service. |
| **Firebase Authentication** | AES-256 (default encryption) | Google-managed. Password hashes use scrypt algorithm before storage. |
| **Cloud Functions source** | AES-256 (default encryption) | Google-managed via Cloud Storage and Artifact Registry |
| **Firebase Hosting content** | AES-256 (default encryption) | Google-managed via Google Cloud CDN storage |
| **GitHub repository** | AES-256-GCM | GitHub-managed encryption at rest for all repository data |
| **Audit logs (Firestore)** | AES-256 (default encryption) | Same as Cloud Firestore |

All data at rest is encrypted using industry-standard AES-256 encryption. No unencrypted data stores exist.

---

## 4. Application-Level Encryption

| Data | Method | Purpose |
|------|--------|---------|
| **Password history** | SHA-256 hash (Web Crypto API, client-side) | Passwords are hashed before being sent to Cloud Functions. Only hashes are stored in the security collection — plaintext passwords are never persisted. |
| **TOTP secrets** | Managed by Firebase Auth | TOTP enrollment secrets are generated and stored by Firebase Authentication; the application does not store them independently. |
| **Environment variables** | GitHub encrypted secrets | `VITE_GATE_PASSWORD` and `VITE_MASTER_EMAIL` are stored as encrypted secrets in GitHub Actions for CI/CD builds. |

---

## 5. Key Management

Portfolio Architect relies on Google-managed encryption keys (GMEK) for all data at rest. This means:

- Google automatically rotates encryption keys on a regular schedule.
- Key material is never exposed to the application or its administrators.
- Key management is covered under Google's SOC 2 Type II report.

**Customer-managed encryption keys (CMEK)** are not currently used. If regulatory requirements change to require CMEK, this can be enabled for Firestore via Google Cloud KMS at additional cost.

---

## 6. Prohibited Practices

- **No plaintext storage of passwords** — Only SHA-256 hashes are stored in the security collection.
- **No plaintext storage of secrets** — Environment variables are managed via `.env` (gitignored) and CI secrets. Firebase API keys are public by design (security is enforced by Firestore rules, not key secrecy).
- **No unencrypted data transmission** — All communication uses TLS. HSTS prevents protocol downgrade. CSP restricts connections to HTTPS origins.
- **No local data persistence of sensitive data** — The Vite/React SPA does not persist sensitive data to localStorage or IndexedDB (Firebase Auth manages its own token storage with standard browser security).

---

## 7. Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-13 | Rodd Miller | Initial policy |
