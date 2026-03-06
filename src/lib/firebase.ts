import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// REPLACE THESE WITH YOUR FIREBASE PROJECT CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDYwsaMBB3Y4if1mrPmw79B9ETnaqEha4M",
  authDomain: "auction-68362.firebaseapp.com",
  databaseURL: "https://auction-68362-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "auction-68362",
  storageBucket: "auction-68362.firebasestorage.app",
  messagingSenderId: "788595958272",
  appId: "1:788595958272:web:0346758aa30ed26494aee5",
  measurementId: "G-RLB7YDX531"
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);
