// 1. Firebase機能のインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// 2. Firebaseの設定情報
const firebaseConfig = {
    apiKey: "AIzaSyCB6o0CRiP_FuAnrpwkNjzhlNFveUHZcbc",
    authDomain: "discussionserver.firebaseapp.com",
    projectId: "discussionserver",
    storageBucket: "discussionserver.firebasestorage.app",
    messagingSenderId: "716023382638",
    appId: "1:716023382638:web:4b4e341b4204198aa09c7f",
    measurementId: "G-H43TRL3TBR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// サブコレクションを作りたい
window.saveScoreToDatabase = async function(jsonData) {

    try {
        const data = JSON.parse(jsonData);
        console.log("C#からデータを受け取りました:", data);



        // 1. リアルタイムリスナーのセットアップ (onSnapshot)
        const messagesRef = collection(db, "rooms", "room_abc", "messages");
        await addDoc(messagesRef, {
            playerName: data.userId,
            score: data.score,
            createdAt: serverTimestamp()
        });

        


        
    } catch (error) {
        console.error("エラーが発生しました:", error);
    }
};
