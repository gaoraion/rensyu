// 1. Firebase機能のインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
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

// C#でメッセージを送信した時の処理
window.saveScoreToDatabase = async function(jsonData) {

    try {
        const data = JSON.parse(jsonData);
        console.log("C#からデータを受け取りました:", data);

        // サブコレクションにメッセージを記録
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


// データベースでメッセージが記録されたときの処理
const messagesRef = collection(db, "rooms", "room_abc", "messages");
const q = query(messagesRef, orderBy("createdAt"));
let messageQueue = []; // 一時的にメッセージを溜めておく箱

// データベースを監視して新規メッセージを検知すればC#の関数を呼び出す
onSnapshot(q, (snapshot) => {

  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
        
        const messageData = change.doc.data();
        const messageText = messageData.message;
    
        console.log("【受信】新しいメッセージを検知:", messageText);


        // jsからC#の関数を呼び出す
        // 第1引数: オブジェクト名
        // 第2引数: スクリプト内の関数名
        // 第3引数: 引数にしたい文字列
        if (window.unityInstance) {
            console.log("【Unity送信】SendMessageを実行します:", messageText);
            window.unityInstance.SendMessage("ScrollViewManager", "ReceiveDataFromJS", messageText);
        }else {
            console.log("【キュー保存】まだUnityの準備ができていないためキューに保存します:", messageText);
            // まだUnityの準備ができていなければ、箱に溜めておく
            messageQueue.push(messageText);
        }
    }
  });
});

// Unityのロード完了時（index.html側から呼んでもらう、または定期チェックするなど）に
// 溜まっていたメッセージを吐き出す関数を用意しておく
window.flushMessageQueue = function() {
    console.log("【キュー解放】キューに溜まったメッセージを流します。件数:", messageQueue.length);
    if (window.unityInstance) {
        messageQueue.forEach((text) => {
            console.log("【Unity送信(キュー)】:", text);
            window.unityInstance.SendMessage("ScrollViewManager", "ReceiveDataFromJS", text);
        });
        messageQueue = []; // 箱を空にする
        console.warn("【警告】unityInstanceがまだ存在しません");
    }
};
