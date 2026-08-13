import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAgCRY7XlVa_4vhNPraktbH8nuycXmC1Gc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ktxb-4fb9d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ktxb-4fb9d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ktxb-4fb9d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "799255943197",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:799255943197:web:a12b36ca38a44feaf00ef4",
};

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
const app = firebaseConfigured ? (getApps()[0] || initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const recordsDocument = db ? doc(db, "ktx", "records") : null;
let authPromise;

function authenticate() {
  if (!firebaseConfigured) return Promise.reject(new Error("Chưa cấu hình Firebase"));
  authPromise ||= signInAnonymously(auth);
  return authPromise;
}

export async function subscribeRecords(onData, onError) {
  await authenticate();
  return onSnapshot(recordsDocument, (snapshot) => onData(snapshot.data()?.items || []), onError);
}

export async function saveRecords(records) {
  await authenticate();
  await setDoc(recordsDocument, { items: JSON.parse(JSON.stringify(records)), updatedAt: serverTimestamp() });
}
