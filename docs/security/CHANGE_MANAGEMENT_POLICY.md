# Change Management Policy

**Owner:** Rodd Miller (rmiller@millerwm.com)
**Last Reviewed:** 2026-02-13
**Review Cadence:** Annually

---

## 1. Purpose

This policy defines how changes to Portfolio Architect are proposed, reviewed, tested, deployed, and rolled back. The goal is to prevent unauthorized or untested changes from reaching production while maintaining development velocity.

---

## 2. Change Categories

| Category | Examples | Approval Required | Testing Required |
|----------|---------|-------------------|-----------------|
| **Critical hotfix** | Security vulnerability, data breach remediation, production outage | Post-deployment review (deploy first, document after) | Manual smoke test |
| **Standard change** | New feature, bug fix, dependency update, UI change | Code review before merge | CI pipeline must pass (build, lint, rules tests) |
| **Security change** | Firestore rules, Cloud Functions, auth logic, security headers | Code review + manual verification in staging/production | CI pipeline + manual security testing |
| **Infrastructure change** | Firebase config, GCP IAM, DNS, environment variables | Documented approval from Rodd Miller | Manual verification |

---

## 3. Development Workflow

### 3.1 Branching Strategy

- **`master`** is the production branch. All deployments come from `master`.
- Feature work should be done on feature branches and merged via pull request.
- Direct pushes to `master` are permitted for single-developer workflow but should transition to PR-only as the team grows.

### 3.2 CI/CD Pipeline

Every push to `master` and every pull request triggers the GitHub Actions CI pipeline:

| Job | What It Checks | Blocks Merge |
|-----|---------------|-------------|
| **Lint & Build** | ESLint code quality + Vite production build | Yes (build failure) |
| **Functions Validate** | `npm ci` + Node.js syntax check on `functions/index.js` | Yes |
| **Dependency Audit** | `npm audit --audit-level=high` for root + functions | No (advisory) |
| **Firestore Rules Test** | 27 security rules tests via Firebase Emulator | Yes |

### 3.3 Code Review

- All pull requests should be reviewed before merging.
- Reviewer should verify: no secrets in code, no security rule regressions, tests pass.
- For security-sensitive changes (rules, auth, Cloud Functions), the reviewer must manually inspect the diff.

> **Current state:** Single-developer workflow. Code review is self-review. As the team grows, require at least one independent reviewer for all PRs.

---

## 4. Deployment Process

### 4.1 Standard Deployment

```bash
# 1. Build the frontend
npm run build

# 2. Deploy everything
npx firebase deploy

# Or deploy specific components:
npx firebase deploy --only hosting          # Frontend only
npx firebase deploy --only firestore:rules  # Security rules only
npx firebase deploy --only functions        # Cloud Functions only
```

### 4.2 Deployment Checklist

Before deploying:

- [ ] CI pipeline passes (build, lint, rules tests)
- [ ] Changes have been reviewed (self-review or peer review)
- [ ] No secrets or credentials in the code being deployed
- [ ] For security rule changes: rules tests updated and passing
- [ ] For Cloud Functions changes: syntax check passes (`node --check functions/index.js`)

After deploying:

- [ ] Verify the application loads at production URL
- [ ] Verify login flow works (advisor + client)
- [ ] For security changes: manually test the affected access paths
- [ ] Check Firebase Functions logs for errors (Google Cloud Console > Logging)

### 4.3 Environment Variables

Environment variables are managed via `.env` (local, gitignored) and must be set in the build environment for CI/CD:

| Variable | Purpose | Where Set |
|----------|---------|-----------|
| `VITE_GATE_PASSWORD` | Application gate password | `.env` (local), CI secrets |
| `VITE_MASTER_EMAIL` | Master account email | `.env` (local), CI secrets |

Changes to environment variables require a rebuild and redeployment of hosting.

---

## 5. Rollback Procedures

### 5.1 Firebase Hosting (Frontend)

Firebase Hosting keeps a release history. To roll back:

1. Go to Firebase Console > Hosting > Release History.
2. Find the last known-good release.
3. Click "Rollback" to revert to that version.

Alternatively, from the CLI:
```bash
# List recent releases
firebase hosting:channel:list

# Revert to a specific version from git
git checkout <known-good-commit>
npm run build
npx firebase deploy --only hosting
```

### 5.2 Firestore Security Rules

```bash
# Revert rules to a previous version
git checkout <known-good-commit> -- firestore.rules
npx firebase deploy --only firestore:rules
```

Rules take effect immediately upon deployment. There is no built-in rollback in Firebase — you must redeploy the previous version.

### 5.3 Cloud Functions

```bash
# Revert functions to a previous version
git checkout <known-good-commit> -- functions/
npx firebase deploy --only functions
```

Individual functions can be deleted if causing issues:
```bash
firebase functions:delete <functionName>
```

### 5.4 Git Revert

For any change, the safest rollback is a git revert:
```bash
git revert <commit-hash>
git push origin master
# Then redeploy the affected component
```

---

## 6. Emergency Changes

For Critical incidents (active breach, production down):

1. **Deploy the fix immediately** — do not wait for full CI pipeline.
2. **Document the change** within 24 hours (what was changed, why, by whom).
3. **Run the full CI pipeline** after the emergency to verify no regressions.
4. **Conduct a post-incident review** within 5 business days (see Incident Response Plan).

---

## 7. Change Log

All changes are tracked via:

- **Git history:** Every deployment is traceable to a commit.
- **Audit logs:** Firestore triggers log all data changes (scenarios, advisors, security records).
- **Firebase Console:** Hosting release history, Functions deployment history.
- **GitHub Actions:** CI run history with pass/fail status.
