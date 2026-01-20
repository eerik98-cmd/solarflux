
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCVQDfjdxY1ls1qZGyLJ1huqRBn5eLKeqg",
  authDomain: "gen-lang-client-0444236188.firebaseapp.com",
  projectId: "gen-lang-client-0444236188",
  storageBucket: "gen-lang-client-0444236188.firebasestorage.app",
  messagingSenderId: "217480388468",
  appId: "1:217480388468:web:bdf1a0f5789fd6f5cf1621",
  measurementId: "G-QMKZ015W7Z"
};

// Initialize Firebase
let app;
let db;
let storage;
let analytics;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Analytics is only supported in browser environments
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

export { db, storage, analytics };
