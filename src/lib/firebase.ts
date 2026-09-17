import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase web config. Values come from Vite env vars when provided
// (see .env.example) so the project can be swapped without code changes;
// otherwise they fall back to the currently provisioned FatBallot project.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDBzRlGJfUZXU86t5xMg1Q18rdjBbXzsEA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fatballot-ymlsf-oauthc.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fatballot-ymlsf-oauthc',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fatballot-ymlsf-oauthc.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '403610611594',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:403610611594:web:aedc6a1521206c950e6273',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-2VCJG4GHKK'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Where Firebase password-reset emails redirect the user after completion.
export const PASSWORD_RESET_REDIRECT_URL = () => `${window.location.origin}/login`;
