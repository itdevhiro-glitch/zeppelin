import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA9wgSalrlTcveIZi2i-WND86z1i9JYHKw",
    authDomain: "it-support-53eeb.firebaseapp.com",
    databaseURL: "https://it-support-53eeb-default-rtdb.firebaseio.com",
    projectId: "it-support-53eeb",
    storageBucket: "it-support-53eeb.firebasestorage.app",
    messagingSenderId: "573924501146",
    appId: "1:573924501146:web:12f34306ed675472322123",
    measurementId: "G-33K6DDE1VR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };