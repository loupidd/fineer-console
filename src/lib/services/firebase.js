import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "fineer-fix.firebaseapp.com",
  projectId: "fineer-fix",
  storageBucket: "fineer-fix.appspot.com",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);