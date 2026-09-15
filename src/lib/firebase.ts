import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDBzRlGJfUZXU86t5xMg1Q18rdjBbXzsEA',
  authDomain: 'fatballot-ymlsf-oauthc.firebaseapp.com',
  projectId: 'fatballot-ymlsf-oauthc',
  storageBucket: 'fatballot-ymlsf-oauthc.firebasestorage.app',
  messagingSenderId: '403610611594',
  appId: '1:403610611594:web:aedc6a1521206c950e6273',
  measurementId: 'G-2VCJG4GHKK'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Where the magic link email redirects the user. In dev this resolves to
// http://localhost:3000/login; in production it picks up the deployed origin.
export const EMAIL_LINK_REDIRECT_URL = () => `${window.location.origin}/login`;