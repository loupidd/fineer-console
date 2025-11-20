// src/lib/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "fineer-fix.firebaseapp.com",
  projectId: "fineer-fix",
  storageBucket: "fineer-fix.appspot.com",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export modules you need
export const db = getFirestore(app);
export const auth = getAuth(app);
