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

window.saveScoreToDatabase = async function(jsonData) {


    


    try {
        const data = JSON.parse(jsonData);
        console.log("C#からデータを受け取りました:", data);

        // 例: Firebase Firestore等を使ってデータベースに保存
        // await setDoc(doc(db, "scores", data.userId), { score: data.score });
        await addDoc(collection(db, "lobby"), {
            playerName: data.userId,
            score: data.score,
            createdAt: serverTimestamp()
        });



        console.log("データベースへの保存が完了しました！");
    } catch (error) {
        console.error("エラーが発生しました:", error);
    }
};
