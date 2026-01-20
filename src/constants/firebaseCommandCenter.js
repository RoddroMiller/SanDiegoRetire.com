import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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

try {
  const commandCenterApp = initializeApp(COMMAND_CENTER_CONFIG, 'commandCenter');
  commandCenterDb = getFirestore(commandCenterApp);
} catch (e) {
  console.error("Command Center Firebase Initialization Error:", e);
}

export { commandCenterDb };
