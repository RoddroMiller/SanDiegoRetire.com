import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const LOGO_URL = "Black on WhiteBackground - small.jpg";
export const MASTER_EMAIL = "rmiller@millerwm.com";

// Firebase Configuration
// TODO: Move these values to environment variables for production
const MANUAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCJ92_bE_-hDg95WZ5NRdx1SptRO_Ndb28",
  authDomain: "portfolio-architect-8b47d.firebaseapp.com",
  projectId: "portfolio-architect-8b47d",
  storageBucket: "portfolio-architect-8b47d.firebasestorage.app",
  messagingSenderId: "869562952092",
  appId: "1:869562952092:web:63af623c0310af80990059"
};

const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : MANUAL_FIREBASE_CONFIG;

export const appId = typeof __app_id !== 'undefined' ? __app_id : 'portfolio-architect';

// Initialize Firebase
let auth = null;
let db = null;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "Paste_Your_API_Key_Here") {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

export { auth, db };
