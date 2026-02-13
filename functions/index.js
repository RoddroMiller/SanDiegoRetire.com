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

// ─── Callable: Account Lockout ──────────────────────────────────────
// These run BEFORE authentication so they do NOT require request.auth.
// The admin SDK bypasses security rules to read/write the locked-down
// security collection.

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const PASSWORD_EXPIRY_DAYS = 90;
const MAX_PASSWORD_HISTORY = 5;

function hashEmail(email) {
  return email.toLowerCase().replace(/[.@]/g, "_");
}

function getSecurityDocRef(email) {
  return db.doc(`security/users/${hashEmail(email)}/data`);
}

exports.checkAccountLockout = onCall(async (request) => {
  const { email } = request.data;
  if (!email) {
    throw new HttpsError("invalid-argument", "email is required.");
  }

  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    const data = docSnap.data();

    if (data.lockoutUntil) {
      const lockoutTime = data.lockoutUntil.toDate();
      if (lockoutTime > new Date()) {
        const remainingMs = lockoutTime - new Date();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return {
          locked: true,
          remainingMinutes,
          message: `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}.`,
        };
      }
      // Lockout expired, reset
      await docRef.update({
        failedAttempts: 0,
        lockoutUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const remainingAttempts = MAX_FAILED_ATTEMPTS - (data.failedAttempts || 0);
    return { locked: false, remainingAttempts };
  } catch (error) {
    console.error("Error checking account lockout:", error);
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }
});

exports.recordFailedAttempt = onCall(async (request) => {
  const { email } = request.data;
  if (!email) {
    throw new HttpsError("invalid-argument", "email is required.");
  }

  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await docRef.get();

    let failedAttempts = 1;

    if (docSnap.exists) {
      failedAttempts = (docSnap.data().failedAttempts || 0) + 1;
    }

    const updateData = {
      email: email.toLowerCase(),
      failedAttempts,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    if (docSnap.exists) {
      await docRef.update(updateData);
    } else {
      await docRef.set({ ...updateData, createdAt: FieldValue.serverTimestamp() });
    }

    return {
      attemptCount: failedAttempts,
      isLocked: failedAttempts >= MAX_FAILED_ATTEMPTS,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
    };
  } catch (error) {
    console.error("Error recording failed attempt:", error);
    return { attemptCount: 1, isLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - 1 };
  }
});

exports.resetFailedAttempts = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { email } = request.data;
  if (!email) {
    throw new HttpsError("invalid-argument", "email is required.");
  }

  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      await docRef.update({
        failedAttempts: 0,
        lockoutUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error resetting failed attempts:", error);
    return { success: false };
  }
});

// ─── Callable: Password Expiry & History ────────────────────────────

exports.checkPasswordExpiry = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { email } = request.data;
  if (!email) {
    throw new HttpsError("invalid-argument", "email is required.");
  }

  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { expired: false, daysUntilExpiry: PASSWORD_EXPIRY_DAYS };
    }

    const data = docSnap.data();
    if (!data.lastPasswordChange) {
      return { expired: true, daysUntilExpiry: 0 };
    }

    const lastChange = data.lastPasswordChange.toDate();
    const daysSinceChange = Math.floor((Date.now() - lastChange) / (1000 * 60 * 60 * 24));
    const daysUntilExpiry = PASSWORD_EXPIRY_DAYS - daysSinceChange;

    return {
      expired: daysSinceChange >= PASSWORD_EXPIRY_DAYS,
      daysUntilExpiry: Math.max(0, daysUntilExpiry),
      daysSinceChange,
    };
  } catch (error) {
    console.error("Error checking password expiry:", error);
    return { expired: false, daysUntilExpiry: PASSWORD_EXPIRY_DAYS };
  }
});

exports.initializeSecurityRecord = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { email, passwordHash } = request.data;
  if (!email || !passwordHash) {
    throw new HttpsError("invalid-argument", "email and passwordHash are required.");
  }

  try {
    const docRef = getSecurityDocRef(email);
    await docRef.set({
      email: email.toLowerCase(),
      failedAttempts: 0,
      lockoutUntil: null,
      lastPasswordChange: FieldValue.serverTimestamp(),
      passwordHistory: [passwordHash],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error initializing security record:", error);
    return { success: false };
  }
});

exports.checkPasswordHistory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { email, passwordHash } = request.data;
  if (!email || !passwordHash) {
    throw new HttpsError("invalid-argument", "email and passwordHash are required.");
  }

  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { valid: true };
    }

    const data = docSnap.data();
    const passwordHistory = data.passwordHistory || [];

    if (passwordHistory.length === 0) {
      return { valid: true };
    }

    if (passwordHistory.includes(passwordHash)) {
      return {
        valid: false,
        error: "Cannot reuse your last 5 passwords. Please choose a different password.",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Error checking password history:", error);
    return { valid: true };
  }
});

exports.addToPasswordHistory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { email, passwordHash } = request.data;
  if (!email || !passwordHash) {
    throw new HttpsError("invalid-argument", "email and passwordHash are required.");
  }

  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await docRef.get();

    let passwordHistory = [];
    if (docSnap.exists) {
      passwordHistory = docSnap.data().passwordHistory || [];
    }

    // Add new hash to beginning, keep only last 5
    passwordHistory.unshift(passwordHash);
    if (passwordHistory.length > MAX_PASSWORD_HISTORY) {
      passwordHistory = passwordHistory.slice(0, MAX_PASSWORD_HISTORY);
    }

    await docRef.set(
      {
        passwordHistory,
        lastPasswordChange: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (error) {
    console.error("Error adding to password history:", error);
    return { success: false };
  }
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
