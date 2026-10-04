// 1. Firebase機能のインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    doc,
    runTransaction,
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
// MessageSender.cs
window.saveScoreToDatabase = async function(jsonData) {

    try {
        const data = JSON.parse(jsonData);
        console.log("C#からデータを受け取りました:", data);

        // サブコレクションにメッセージを記録
        const messagesRef = collection(db, "rooms", data.roomId, "messages");
        await addDoc(messagesRef, {
            playerName: data.userId,
            role: data.role, // host, guest, gm　のどれかが入る
            message: data.message,
            createdAt: serverTimestamp()
        });
        
        
    } catch (error) {
        console.error("エラーが発生しました:", error);
    }
};

// ロビー画面の部屋作成ボタンでデータベースを作成
window.createRoom = async function() {

    try {
        const roomRef = await addDoc(collection(db, "rooms"), {
            status: "waiting",
            theme: "朝食はパン派 vs ごはん派",
            currentTurn: 1,
            activeSpeaker:"たかし",
            hostName:"たかし", // 部屋を作った人の名前
            guestName: null,  // 参加者の名前（最初は誰もいないので null）
            playerCount: 1,
            maxPlayers: 2,
            createdAt: serverTimestamp()
        });

        console.log("jsのコメント" + roomRef.id);

        // 成功したら Unity に部屋IDを送る
        if (window.unityInstance) {

            // .idのプロパティで自動生成されたドキュメント名を渡す
            window.unityInstance.SendMessage("GameManager", "OnRoomCreatedSuccess", roomRef.id);
        }

    } catch (error) {
        console.error("部屋作成に失敗:", error);

        // ★失敗したことを Unity に伝える！
        if (window.unityInstance) {
            window.unityInstance.SendMessage("GameManager", "OnRoomCreateFailed", error.message);
        }
    }
    
};

let unsubscribe_Lobby = null; // リスナーを解除するための変数

// データベースでメッセージが記録されたときの処理
// Lobbyシーンに入ったときにUnityから呼び出される関数を定義
window.startLobbyListener = function() {

    // すでに監視中なら二重登録を防ぐために何もしない
    if (unsubscribe_Lobby) return;

    console.log("Lobbyシーンの監視を開始します");

    const messagesRef = collection(db, "rooms");
    const q = query(messagesRef, orderBy("createdAt"));
    
    // データベースを監視して新規メッセージを検知
    unsubscribe_Lobby = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const Data = change.doc.data();
                const docId = change.doc.id;

                const jsonString = JSON.stringify({
                    id: docId,
                    hostName: Data.hostName,
                    playerCount: Data.playerCount,
                    maxPlayers: Data.maxPlayers,
                    status: Data.status
                });

                if (window.unityInstance) {

                    console.log("Lobbyにオブジェクト生成！！");
                    window.unityInstance.SendMessage("ScrollViewManager", "ReceiveLobbyDispDataFromJS", jsonString);
                }
            }
        });
    });
};

window.stopLobbyListener = function() {
    if (unsubscribe_Lobby) { // ←もし監視中（unsubscribeに中身が入っている）なら実行する
        unsubscribe_Lobby(); 
        unsubscribe_Lobby = null;
        console.log("Roomシーンの監視を終了しました");
    }
    // 監視していなければ（unsubscribeがnullなら）、ここをスルーするのでエラーにならない！
};

let unsubscribe = null; // リスナーを解除するための変数

// データベースでメッセージが記録されたときの処理
// Roomシーンに入ったときにUnityから呼び出される関数を定義
window.startRoomListener = function(roomId) {

    console.log("window.startRoomListener：これは呼ばれた");
    
    // すでに監視中なら二重登録を防ぐために何もしない
    if (unsubscribe) return;

    console.log("Roomシーンの監視を開始します" + roomId);

    
    const messagesRef = collection(db, "rooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt"));

    
    // データベースを監視して新規メッセージを検知
    unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const Data = change.doc.data();
                const jsonString = JSON.stringify({
                    message: Data.message,
                    role: Data.role
                });

                if (window.unityInstance) {

                    console.log("Roomにオブジェクト生成！！");
                    window.unityInstance.SendMessage("ScrollViewManager", "ReceiveDataFromJS", jsonString);
                }
            }
        });
    });
};

window.stopRoomListener = function() {
    if (unsubscribe) { // ←もし監視中（unsubscribeに中身が入っている）なら実行する
        unsubscribe(); 
        unsubscribe = null;
        console.log("Roomシーンの監視を終了しました");
    }
    // 監視していなければ（unsubscribeがnullなら）、ここをスルーするのでエラーにならない！
};


// Unityのロード完了時（index.html側から呼んでもらう、または定期チェックするなど）に
// 溜まっていたメッセージを吐き出す関数を用意しておく

let messageQueue = []; // 一時的にメッセージを溜めておく箱

//Unityが完全に起動する前に外部（Firebaseなど）から届いちゃったデータを、
//取りこぼさないように一時保存しておいて、Unityの準備ができた瞬間に流し込む
window.flushMessageQueue = function() {
    console.log("【キュー解放】キューに溜まったメッセージを流します。件数:", messageQueue.length);
    if (window.unityInstance) {
        messageQueue.forEach((jsonString) => {
            console.log("【Unity送信(キュー)】:", jsonString);
            window.unityInstance.SendMessage("ScrollViewManager", "ReceiveDataFromJS", jsonString);
        });
        messageQueue = []; // 箱を空にする
    } else {
        console.warn("【警告】unityInstanceがまだ存在しません");
    }
};

// ★ これを必ず書く！（外の世界の window に公開する）
window.joinRoom = joinRoom;

// トリガー：ロビー画面の入室ボタン押下
// 内容：入室可能であるかトランザクション処理で判断する
async function joinRoom(jsonData) {

    console.log("届いた生データ ->", jsonData);

    if (!jsonData) {
        console.error("jsonData が空っぽで届きました！C#側を確認してください。");
        return;
    }

    const data = JSON.parse(jsonData);
    console.log("joinRoomが呼ばれた！ パース成功:", data);

    try {
        // ★ 修正①：第1引数に db を渡す
        await runTransaction(db, async (transaction) => {

            // ★ 修正②：data.roomId に修正（スペルミス解消）
            const roomRef = doc(db, "rooms", data.roomId);
            
            const roomDoc = await transaction.get(roomRef);

            // ★ 修正③：.exists() にカッコをつける
            if (!roomDoc.exists()) {
                throw new Error("部屋が存在しません。");
            }

            const currentGuest = roomDoc.data().guestName;

            if (currentGuest) {
                throw new Error("部屋はすでに満員です。");
            }

            // ★ 修正④：data.userId に修正
            // 空白であれば書き込みを実行（ドキュメントからguestNameを探して上書き）
            transaction.update(roomRef, {
                guestName: data.userId
            });
        });

        // トランザクション成功（入室成功）
        console.log("入室成功！");

        // ゲームシーンへ遷移などの処理
        if (window.unityInstance) {
            window.unityInstance.SendMessage("LobbyManager", "OnRoomEntrySuccess");
        }

    } catch (error) {
        // トランザクション失敗（先を越された、またはエラー）
        console.error("入室失敗: ", error.message);

        // 「満員です」などのポップアップを出す
        if (window.unityInstance) {
            window.unityInstance.SendMessage("LobbyManager", "OnRoomEntryFailed", error.message);
        }
    }
}
