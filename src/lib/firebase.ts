// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB7gobp_RyD05hnVmFBdtX-pcjVRZrBUJ4",
  authDomain: "order-63780.firebaseapp.com",
  projectId: "order-63780",
  storageBucket: "order-63780.appspot.com",
  messagingSenderId: "57020655857",
  appId: "1:57020655857:web:5aa6af025ca168e63ee150"
};


// Initialize Firebase
// A check is added to ensure that firebase is only initialized once.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, doc, getDoc, setDoc, serverTimestamp };
