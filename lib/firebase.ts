import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const required = ["NEXT_PUBLIC_FIREBASE_API_KEY","NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN","NEXT_PUBLIC_FIREBASE_PROJECT_ID","NEXT_PUBLIC_FIREBASE_APP_ID"] as const;
for (const key of required) { if (!process.env[key]) console.warn(`Missing ${key}`); }

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
if (typeof window !== "undefined") void setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
