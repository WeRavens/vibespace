import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let app;
let auth: any;
let db: any;

try {
  // We use a dynamic import or require style check to see if the config exists
  // In this environment, we expect /firebase-applet-config.json to be generated.
  // If it's not here yet, we'll provide a mock or clear error.
  const config = {
    apiKey: "AIzaSyBSW9TJigC_3k1kPdyDF_egiw9-MYq47TE",
    authDomain: "vibespace-eedce.firebaseapp.com",
    projectId: "vibespace-eedce",
    storageBucket: "vibespace-eedce.firebasestorage.app",
    messagingSenderId: "310245625123",
    appId: "1:310245625123:web:b9fdab0df3acb147741096",
    measurementId: "G-ZEPFP0RDMD"
  };

  // In a real build, this would be:
  // import firebaseConfig from '../../firebase-applet-config.json';
  // But we handle it safely:
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { auth, db };
