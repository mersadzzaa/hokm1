import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// ------------------------------------------------------------------
// اطلاعات فایربیس خود را در اینجا جایگزین کنید
// به کنسول فایربیس بروید -> Project Settings -> General -> Your apps
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAiau0FXhLr6iaAmLJOch-w28Wm_NyqG64",
  authDomain: "hokm-27c27.firebaseapp.com",
  databaseURL:
    "https://hokm-27c27-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "hokm-27c27",
  storageBucket: "hokm-27c27.firebasestorage.app",
  messagingSenderId: "802084972614",
  appId: "1:802084972614:web:3471825abb1779560b0247",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
