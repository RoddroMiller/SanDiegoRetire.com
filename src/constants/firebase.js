import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

export const LOGO_URL = "mwm-logo.png";
export const MASTER_EMAIL = import.meta.env.VITE_MASTER_EMAIL || "rmiller@millerwm.com";

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

    // App Check attests that requests come from THIS app before Firestore/Functions will
    // serve them. The Firebase apiKey above ships in the public bundle and is therefore
    // not a secret — App Check is what stops someone from lifting it and calling the API
    // directly, outside the app and outside its UI.
    //
    // Must be initialized BEFORE getAuth/getFirestore so every request carries a token.
    // Deliberately non-fatal: if the key is absent or attestation fails, the app still
    // runs (unattested) rather than going dark. That is why enforcement is turned on in
    // the console only after the console confirms verified traffic arriving.
    const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (appCheckSiteKey) {
      // Local dev: set VITE_APPCHECK_DEBUG_TOKEN=true to have the SDK print a debug token
      // to the console, which you then register under App Check → Manage debug tokens.
      if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
      }
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (e) {
        console.error("App Check initialization failed (continuing unattested):", e);
      }
    } else if (import.meta.env.PROD) {
      console.warn("App Check not configured: VITE_RECAPTCHA_SITE_KEY is unset.");
    }

    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

export { auth, db };
