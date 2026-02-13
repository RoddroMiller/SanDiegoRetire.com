const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

initializeApp();
const db = getFirestore();

// ─── Constants ──────────────────────────────────────────────────────

const MASTER_EMAIL = "rmiller@millerwm.com";
const AUDIT_COLLECTION = "audit_logs";
const APP_ID = "portfolio-architect";

// Firestore document paths (v2 uses full path strings)
const SCENARIOS_PATH = `artifacts/${APP_ID}/public/data/scenarios/{scenarioId}`;
const ADVISORS_PATH = `artifacts/${APP_ID}/public/data/advisors/{advisorId}`;
const SECURITY_PATH = "security/users/{hashedEmail}/data";

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Write an audit log entry. Uses admin SDK so it bypasses security rules
 * (audit_logs collection blocks all client writes).
 */
async function writeAuditLog({ action, collectionName, documentId, documentPath, before, after, changedFields }) {
  // Extract user info from the after doc (create/update) or before doc (delete)
  const source = after || before || {};
  const userId = source.advisorId || source.uid || null;
  const userEmail = source.advisorEmail || source.email || null;

  await db.collection(AUDIT_COLLECTION).add({
    action,
    collection: collectionName,
    documentId,
    documentPath,
    userId,
    userEmail,
    timestamp: FieldValue.serverTimestamp(),
    before: before || null,
    after: after || null,
    changedFields: changedFields || [],
  });
}

/**
 * Compute which top-level fields changed between two objects.
 */
function getChangedFields(before, after) {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

/**
 * Redact sensitive fields from security records before logging.
 */
function redactSecurityData(data) {
  if (!data) return null;
  const redacted = { ...data };
  if (redacted.passwordHistory) {
    redacted.passwordHistory = `[REDACTED - ${redacted.passwordHistory.length} entries]`;
  }
  return redacted;
}

// ─── Scenario Triggers ──────────────────────────────────────────────

exports.onScenarioCreated = onDocumentCreated(SCENARIOS_PATH, async (event) => {
  const data = event.data.data();
  await writeAuditLog({
    action: "create",
    collectionName: "scenarios",
    documentId: event.params.scenarioId,
    documentPath: event.data.ref.path,
    before: null,
    after: data,
  });
});

exports.onScenarioUpdated = onDocumentUpdated(SCENARIOS_PATH, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const changedFields = getChangedFields(before, after);

  // Noise reduction: skip if only updatedAt changed
  if (changedFields.length === 1 && changedFields[0] === "updatedAt") {
    return;
  }

  await writeAuditLog({
    action: "update",
    collectionName: "scenarios",
    documentId: event.params.scenarioId,
    documentPath: event.data.after.ref.path,
    before,
    after,
    changedFields,
  });
});

exports.onScenarioDeleted = onDocumentDeleted(SCENARIOS_PATH, async (event) => {
  const data = event.data.data();
  await writeAuditLog({
    action: "delete",
    collectionName: "scenarios",
    documentId: event.params.scenarioId,
    documentPath: event.data.ref.path,
    before: data,
    after: null,
  });
});

// ─── Advisor Triggers ───────────────────────────────────────────────

exports.onAdvisorCreated = onDocumentCreated(ADVISORS_PATH, async (event) => {
  const data = event.data.data();
  await writeAuditLog({
    action: "create",
    collectionName: "advisors",
    documentId: event.params.advisorId,
    documentPath: event.data.ref.path,
    before: null,
    after: data,
  });
});

exports.onAdvisorDeleted = onDocumentDeleted(ADVISORS_PATH, async (event) => {
  const data = event.data.data();
  await writeAuditLog({
    action: "delete",
    collectionName: "advisors",
    documentId: event.params.advisorId,
    documentPath: event.data.ref.path,
    before: data,
    after: null,
  });
});

// ─── Security Record Trigger ────────────────────────────────────────

exports.onSecurityRecordUpdated = onDocumentUpdated(SECURITY_PATH, async (event) => {
  const before = redactSecurityData(event.data.before.data());
  const after = redactSecurityData(event.data.after.data());
  const changedFields = getChangedFields(
    event.data.before.data(),
    event.data.after.data()
  );

  // Noise reduction: skip if only updatedAt changed
  if (changedFields.length === 1 && changedFields[0] === "updatedAt") {
    return;
  }

  await writeAuditLog({
    action: "update",
    collectionName: "security",
    documentId: event.params.hashedEmail,
    documentPath: event.data.after.ref.path,
    before,
    after,
    changedFields,
  });
});

// ─── Callable: Set User Role ────────────────────────────────────────
// Future use — master can assign custom claims (roles) to users.

exports.setUserRole = onCall(async (request) => {
  // Only master can call this
  if (!request.auth || request.auth.token.email?.toLowerCase() !== MASTER_EMAIL) {
    throw new HttpsError("permission-denied", "Only the master account can assign roles.");
  }

  const { uid, role } = request.data;
  if (!uid || !role) {
    throw new HttpsError("invalid-argument", "uid and role are required.");
  }

  const validRoles = ["master", "advisor", "registeredClient"];
  if (!validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", `role must be one of: ${validRoles.join(", ")}`);
  }

  await getAuth().setCustomUserClaims(uid, { role });

  // Log the role change
  await writeAuditLog({
    action: "update",
    collectionName: "auth_claims",
    documentId: uid,
    documentPath: `auth/users/${uid}`,
    before: null,
    after: { uid, role, assignedBy: request.auth.token.email },
    changedFields: ["role"],
  });

  return { success: true, uid, role };
});
