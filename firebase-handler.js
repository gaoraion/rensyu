// 1. Firebase機能のインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,          // ← これを追加！
    onSnapshot,       // ← これを追加！
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
            host_or_guest: data.host,
            message: data.message,
            createdAt: serverTimestamp()
        });
        
        
    } catch (error) {
        console.error("エラーが発生しました:", error);
    }
};

// データベースのメッセージを監視

const messagesRef = collection(db, "rooms", "room_abc", "messages");
const q = query(messagesRef, orderBy("createdAt"));
// 一時的にメッセージを溜めておく箱
let messageQueue = [];

onSnapshot(q, (snapshot) => {
  // .docChanges() を使うと、変更があったもの (追加・変更・削除) だけを抜き出せる
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
        // 新しく追加されたデータを取得
        const messageData = change.doc.data();
        const messageText = messageData.message; // 例：メッセージのテキストフィールド
    
        console.log("【受信】新しいメッセージを検知:", messageText);


        // ここでUnityへ送信！
        // 第1引数: シーン内にある、スクリプトがアタッチされている「ゲームオブジェクトの名前」
        // 第2引数: 呼び出したいC#の「関数名」
        // 第3引数: 送りたい文字列データ
        if (window.unityInstance) {
            console.log("【Unity送信】SendMessageを実行します:", messageText);
            window.unityInstance.SendMessage("GameManager", "ReceiveDataFromJS", messageText);
        }else {
                // まだUnityの準備ができていなければ、箱に溜めておく
                messageQueue.push(messageText);
        }
    }
  });
});

// Unityのロード完了時（index.html側から呼んでもらう、または定期チェックするなど）に
// 溜まっていたメッセージを吐き出す関数を用意しておく
window.flushMessageQueue = function() {
    if (window.unityInstance) {
        messageQueue.forEach((text) => {
            window.unityInstance.SendMessage("GameManager", "ReceiveDataFromJS", text);
        });
        messageQueue = []; // 箱を空にする
    }
};
