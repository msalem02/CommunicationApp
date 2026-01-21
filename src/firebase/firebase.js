import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtgpL6JP_bHeewuU7SDMoZ-WyY2FiVo4E",
  authDomain: "chatfirbase02.firebaseapp.com",
  projectId: "chatfirbase02",
  storageBucket: "chatfirbase02.firebasestorage.app",
  messagingSenderId: "703742828472",
  appId: "1:703742828472:web:6437b2a7dd5895606b794d",
  measurementId: "G-8RNDQNN6JX"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
