import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Firebase Configuration for The One Process (Client Command Center)
// This is a SECOND Firebase project, separate from Portfolio Architect's database
const COMMAND_CENTER_CONFIG = {
  apiKey: "AIzaSyBRQ8suy4WmboyQ_jekItEDdU7Sh1ZI0WE",
  authDomain: "miller-one-process.firebaseapp.com",
  projectId: "miller-one-process",
  storageBucket: "miller-one-process.firebasestorage.app",
  messagingSenderId: "519781942426",
  appId: "1:519781942426:web:8d11b6ac5c994e00454b23"
};

// Initialize as a named app to avoid conflicts with the primary Firebase app
let commandCenterDb = null;
let commandCenterAuth = null;
let commandCenterApp = null;

try {
  commandCenterApp = initializeApp(COMMAND_CENTER_CONFIG, 'commandCenter');
  commandCenterDb = getFirestore(commandCenterApp);
  commandCenterAuth = getAuth(commandCenterApp);
} catch (e) {
  console.error("Command Center Firebase Initialization Error:", e);
}

/**
 * Sign in to Command Center Firebase with the same credentials
 * This enables cross-project Firestore queries
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object|null>} User credential or null on error
 */
export const signInToCommandCenter = async (email, password) => {
  if (!commandCenterAuth) {
    console.error('Command Center Auth not initialized');
    return null;
  }
  try {
    const credential = await signInWithEmailAndPassword(commandCenterAuth, email, password);
    console.log('Signed in to Command Center successfully');
    return credential;
  } catch (e) {
    // User might not exist in Command Center yet - that's okay
    console.log('Command Center sign-in failed (user may not exist there yet):', e.code);
    return null;
  }
};

export { commandCenterDb, commandCenterAuth };
