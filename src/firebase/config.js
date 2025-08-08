import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {

    apiKey: "AIzaSyAdj8EwqtB7uP_gQmevelvbxew4_X4LJyk",  
    authDomain: "tech-city-phone-information.firebaseapp.com",  
    projectId: "tech-city-phone-information",  
    storageBucket: "tech-city-phone-information.firebasestorage.app",  
    messagingSenderId: "218177382353",  
    appId: "1:218177382353:web:cf92ab1e75bcd139a062f0"  
};
  

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);