/**
 * Firestore Security Rules Tests
 *
 * Tests all collections: scenarios, advisors, security, audit_logs
 * Run with: npx vitest run tests/firestore-rules.test.js
 * Requires Firebase Emulator: firebase emulators:exec --only firestore "npx vitest run tests/firestore-rules.test.js"
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ID = 'portfolio-architect-8b47d';
const MASTER_EMAIL = 'rmiller@millerwm.com';
const ADVISOR_EMAIL = 'advisor@test.com';
const ADVISOR_UID = 'advisor-uid-123';
const CLIENT_EMAIL = 'client@test.com';
const CLIENT_UID = 'client-uid-456';
const OTHER_EMAIL = 'other@test.com';
const OTHER_UID = 'other-uid-789';

const SCENARIO_PATH = 'artifacts/portfolio-architect/public/data/scenarios';
const ADVISOR_DIR_PATH = 'artifacts/portfolio-architect/public/data/advisors';

let testEnv;

beforeAll(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const rules = readFileSync(resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ─── Helper: get Firestore context for different users ──────────────

function asMaster() {
  return testEnv.authenticatedContext(ADVISOR_UID, {
    email: MASTER_EMAIL,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function asAdvisor() {
  return testEnv.authenticatedContext(ADVISOR_UID, {
    email: ADVISOR_EMAIL,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function asClient() {
  return testEnv.authenticatedContext(CLIENT_UID, {
    email: CLIENT_EMAIL,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function asOther() {
  return testEnv.authenticatedContext(OTHER_UID, {
    email: OTHER_EMAIL,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function asAnonymous() {
  return testEnv.authenticatedContext('anon-uid', {
    firebase: { sign_in_provider: 'anonymous' },
  }).firestore();
}

function asUnauthenticated() {
  return testEnv.unauthenticatedContext().firestore();
}

// ─── Helper: seed a scenario via admin ──────────────────────────────

async function seedScenario(id, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, SCENARIO_PATH, id), data);
  });
}

async function seedAdvisor(id, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, ADVISOR_DIR_PATH, id), data);
  });
}

// =====================================================================
// SCENARIOS
// =====================================================================

describe('Scenarios collection', () => {
  const scenarioData = {
    advisorId: ADVISOR_UID,
    advisorEmail: ADVISOR_EMAIL,
    name: 'Test Plan',
    assignedClientEmail: CLIENT_EMAIL,
  };

  // ─── READ ───

  describe('read', () => {
    it('allows signed-in anonymous user to read', async () => {
      await seedScenario('s1', scenarioData);
      const db = asAnonymous();
      await assertSucceeds(getDoc(doc(db, SCENARIO_PATH, 's1')));
    });

    it('allows authenticated user to read', async () => {
      await seedScenario('s1', scenarioData);
      const db = asAdvisor();
      await assertSucceeds(getDoc(doc(db, SCENARIO_PATH, 's1')));
    });

    it('denies unauthenticated user from reading', async () => {
      await seedScenario('s1', scenarioData);
      const db = asUnauthenticated();
      await assertFails(getDoc(doc(db, SCENARIO_PATH, 's1')));
    });
  });

  // ─── CREATE ───

  describe('create', () => {
    it('allows advisor to create scenario stamped with own identity', async () => {
      const db = asAdvisor();
      await assertSucceeds(
        setDoc(doc(db, SCENARIO_PATH, 'new1'), {
          advisorId: ADVISOR_UID,
          advisorEmail: ADVISOR_EMAIL,
          name: 'New Plan',
        })
      );
    });

    it('denies advisor from creating scenario with someone else\'s identity', async () => {
      const db = asAdvisor();
      await assertFails(
        setDoc(doc(db, SCENARIO_PATH, 'new2'), {
          advisorId: 'fake-uid',
          advisorEmail: OTHER_EMAIL,
          name: 'Spoofed Plan',
        })
      );
    });

    it('allows anonymous user to create CLIENT_SUBMISSION', async () => {
      const db = asAnonymous();
      await assertSucceeds(
        setDoc(doc(db, SCENARIO_PATH, 'sub1'), {
          advisorId: 'CLIENT_SUBMISSION',
          advisorEmail: 'Client Submission',
          name: 'Prospect Plan',
        })
      );
    });

    it('allows anonymous user to create CLIENT_PROGRESS', async () => {
      const db = asAnonymous();
      await assertSucceeds(
        setDoc(doc(db, SCENARIO_PATH, 'prog1'), {
          advisorId: 'CLIENT_PROGRESS',
          advisorEmail: 'Client Progress',
          name: 'In-Progress Plan',
        })
      );
    });

    it('denies unauthenticated user from creating', async () => {
      const db = asUnauthenticated();
      await assertFails(
        setDoc(doc(db, SCENARIO_PATH, 'bad1'), {
          advisorId: 'CLIENT_SUBMISSION',
          advisorEmail: 'Client Submission',
          name: 'No Auth Plan',
        })
      );
    });
  });

  // ─── UPDATE ───

  describe('update', () => {
    it('allows owner to update their scenario', async () => {
      await seedScenario('s1', scenarioData);
      const db = asAdvisor();
      await assertSucceeds(updateDoc(doc(db, SCENARIO_PATH, 's1'), { name: 'Updated' }));
    });

    it('allows master to update any scenario', async () => {
      await seedScenario('s1', scenarioData);
      const db = asMaster();
      await assertSucceeds(updateDoc(doc(db, SCENARIO_PATH, 's1'), { name: 'Master Edit' }));
    });

    it('allows assigned client to update non-ownership fields', async () => {
      await seedScenario('s1', scenarioData);
      const db = asClient();
      await assertSucceeds(updateDoc(doc(db, SCENARIO_PATH, 's1'), { name: 'Client Edit' }));
    });

    it('denies assigned client from changing advisorId', async () => {
      await seedScenario('s1', scenarioData);
      const db = asClient();
      await assertFails(updateDoc(doc(db, SCENARIO_PATH, 's1'), { advisorId: CLIENT_UID }));
    });

    it('denies assigned client from changing advisorEmail', async () => {
      await seedScenario('s1', scenarioData);
      const db = asClient();
      await assertFails(updateDoc(doc(db, SCENARIO_PATH, 's1'), { advisorEmail: CLIENT_EMAIL }));
    });

    it('denies unrelated user from updating', async () => {
      await seedScenario('s1', scenarioData);
      const db = asOther();
      await assertFails(updateDoc(doc(db, SCENARIO_PATH, 's1'), { name: 'Hacked' }));
    });
  });

  // ─── DELETE ───

  describe('delete', () => {
    it('allows owner to delete their scenario', async () => {
      await seedScenario('s1', scenarioData);
      const db = asAdvisor();
      await assertSucceeds(deleteDoc(doc(db, SCENARIO_PATH, 's1')));
    });

    it('allows master to delete any scenario', async () => {
      await seedScenario('s1', scenarioData);
      const db = asMaster();
      await assertSucceeds(deleteDoc(doc(db, SCENARIO_PATH, 's1')));
    });

    it('denies assigned client from deleting', async () => {
      await seedScenario('s1', scenarioData);
      const db = asClient();
      await assertFails(deleteDoc(doc(db, SCENARIO_PATH, 's1')));
    });

    it('denies unrelated user from deleting', async () => {
      await seedScenario('s1', scenarioData);
      const db = asOther();
      await assertFails(deleteDoc(doc(db, SCENARIO_PATH, 's1')));
    });
  });
});

// =====================================================================
// ADVISORS
// =====================================================================

describe('Advisors collection', () => {
  const advisorData = { name: 'Test Advisor', email: ADVISOR_EMAIL };

  describe('read', () => {
    it('allows authenticated user to read', async () => {
      await seedAdvisor('a1', advisorData);
      const db = asAdvisor();
      await assertSucceeds(getDoc(doc(db, ADVISOR_DIR_PATH, 'a1')));
    });

    it('denies anonymous user from reading', async () => {
      await seedAdvisor('a1', advisorData);
      const db = asAnonymous();
      await assertFails(getDoc(doc(db, ADVISOR_DIR_PATH, 'a1')));
    });

    it('denies unauthenticated user from reading', async () => {
      await seedAdvisor('a1', advisorData);
      const db = asUnauthenticated();
      await assertFails(getDoc(doc(db, ADVISOR_DIR_PATH, 'a1')));
    });
  });

  describe('write', () => {
    it('allows master to create advisor', async () => {
      const db = asMaster();
      await assertSucceeds(
        setDoc(doc(db, ADVISOR_DIR_PATH, 'a2'), { name: 'New Advisor', email: 'new@test.com' })
      );
    });

    it('allows master to delete advisor', async () => {
      await seedAdvisor('a1', advisorData);
      const db = asMaster();
      await assertSucceeds(deleteDoc(doc(db, ADVISOR_DIR_PATH, 'a1')));
    });

    it('denies non-master from creating advisor', async () => {
      const db = asAdvisor();
      await assertFails(
        setDoc(doc(db, ADVISOR_DIR_PATH, 'a3'), { name: 'Unauthorized', email: 'bad@test.com' })
      );
    });

    it('denies non-master from deleting advisor', async () => {
      await seedAdvisor('a1', advisorData);
      const db = asAdvisor();
      await assertFails(deleteDoc(doc(db, ADVISOR_DIR_PATH, 'a1')));
    });
  });
});

// =====================================================================
// SECURITY RECORDS
// =====================================================================

describe('Security records collection', () => {
  const secPath = 'security/users/test_user/data';

  it('denies all reads (even master)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), secPath), { failedAttempts: 3 });
    });
    const db = asMaster();
    await assertFails(getDoc(doc(db, secPath)));
  });

  it('denies all writes (even master)', async () => {
    const db = asMaster();
    await assertFails(setDoc(doc(db, secPath), { failedAttempts: 0 }));
  });

  it('denies anonymous reads', async () => {
    const db = asAnonymous();
    await assertFails(getDoc(doc(db, secPath)));
  });

  it('denies unauthenticated reads', async () => {
    const db = asUnauthenticated();
    await assertFails(getDoc(doc(db, secPath)));
  });
});

// =====================================================================
// AUDIT LOGS
// =====================================================================

describe('Audit logs collection', () => {
  it('allows master to read', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs/log1'), { action: 'create' });
    });
    const db = asMaster();
    await assertSucceeds(getDoc(doc(db, 'audit_logs/log1')));
  });

  it('denies non-master from reading', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'audit_logs/log1'), { action: 'create' });
    });
    const db = asAdvisor();
    await assertFails(getDoc(doc(db, 'audit_logs/log1')));
  });

  it('denies all client writes (even master)', async () => {
    const db = asMaster();
    await assertFails(setDoc(doc(db, 'audit_logs/log2'), { action: 'fake' }));
  });
});

// =====================================================================
// CATCH-ALL
// =====================================================================

describe('Catch-all deny', () => {
  it('denies access to unmatched paths', async () => {
    const db = asMaster();
    await assertFails(getDoc(doc(db, 'random/collection')));
  });

  it('denies access to unmatched nested paths', async () => {
    const db = asMaster();
    await assertFails(setDoc(doc(db, 'foo/bar/baz/qux'), { data: true }));
  });
});
