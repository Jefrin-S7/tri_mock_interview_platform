
import { initializeApp, getApp, getApps} from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA36_J8kKIAqiwwVNAC4o8dQO_zoN5C25s",
  authDomain: "nextround-ai-2ff0b.firebaseapp.com",
  projectId: "nextround-ai-2ff0b",
  storageBucket: "nextround-ai-2ff0b.firebasestorage.app",
  messagingSenderId: "694950962563",
  appId: "1:694950962563:web:873313aab3a5e05e6dc2b6",
  measurementId: "G-B4B5WPY3V9"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db =getFirestore(app);
