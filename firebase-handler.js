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
    serverTimestamp,
    deleteDoc,
    updateDoc,
    setDoc
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
window.createRoom = async function(userId) {

    console.log("window.createRoomのuserId：" + userId);

    try {
        const roomRef = await addDoc(collection(db, "rooms"), {
            status: "waiting",
            theme: "朝食はパン派 vs ごはん派",
            currentTurn: 1,
            activeSpeaker:"たかし",
            hostName: userId, // 部屋を作った人の名前
            guestName: null,  // 参加者の名前（最初は誰もいないので null）
            playerCount: 1,
            maxPlayers: 2,
            createdAt: serverTimestamp(),
            turnEndAt: null,
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

    console.log("startLobbyListener が呼び出されました！");
    
    // すでにリスナーが動いている場合は、重複を防ぐために一度解除するなどの処理をここに書くと安心です
    if (unsubscribe_Lobby != null) {
        unsubscribe_Lobby();
        unsubscribe_Lobby = null;
    }

    // すでに監視中なら二重登録を防ぐために何もしない
    if (unsubscribe_Lobby) return;

    console.log("Lobbyシーンの監視を開始します");

    const messagesRef = collection(db, "rooms");
    const q = query(messagesRef, orderBy("createdAt"));
    
    // データベースを監視して新規メッセージを検知
    unsubscribe_Lobby = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {

            const Data = change.doc.data();
            const docId = change.doc.id;

            if(change.type === "added" && recentlyDeletedIds.has(docId))
            {
                console.log("自分で削除したドキュメントのため、生成をスキップします：", docId);
                return;
            }

            if (change.type === "added") {
                
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

            if (change.type === "modified") {
                const jsonString = JSON.stringify({
                    id: docId,
                    hostName: Data.hostName,
                    playerCount: Data.playerCount,
                    maxPlayers: Data.maxPlayers,
                    status: Data.status
                });
                
                if (window.unityInstance) {
                    console.log("Lobbyのオブジェクトを更新！！");
                    window.unityInstance.SendMessage("Content", "UpdatePackageInfoNotify", jsonString);
                }
            }
        });
    });
};


window.stopLobbyListener = function() {
    if (unsubscribe_Lobby) { // ←もし監視中（unsubscribeに中身が入っている）なら実行する
        unsubscribe_Lobby(); 
        unsubscribe_Lobby = null;
        console.log("Lobbyシーンの監視を終了しました");
    }
    // 監視していなければ（unsubscribeがnullなら）、ここをスルーするのでエラーにならない！
};

let unsubscribeMessages = null; // メッセージ監視解除用
let unsubscribeTimer = null;    // タイマー監視解除用
let unsubscribeStatus = null;    // ステータス監視解除用

// データベースでメッセージが記録されたときの処理
// Roomシーンに入ったときにUnityから呼び出される関数を定義
window.startRoomListener = function(roomId) {

    console.log("window.startRoomListener：これは呼ばれた");
    
    // すでに監視中なら二重登録を防ぐために何もしない
    if (unsubscribeMessages || unsubscribeTimer) return;

    // メッセージの監視
    console.log("Roomシーンの監視を開始します" + roomId);
    const messagesRef = collection(db, "rooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt"));

    // データベースを監視して新規メッセージを検知
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
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

    // ルーム情報の参照
    const roomRef = doc(db, "rooms", roomId);

    // タイマーとステータスの監視を1つにまとめる
    unsubscribeTimer = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const turnEndAt = data.turnEndAt;
            const currentStatus = data.status; // ステータスを取得

            // 1. ターンエンド時刻の検知
            if (turnEndAt) {
                console.log("DBから新しいturnEndAtを検知:", turnEndAt);

                if (window.unityInstance) {
                    window.unityInstance.SendMessage("TimerManager", "ReceiveTurnEndAt", turnEndAt.toString());
                }
            }   

            // 2. ステータスが "playing" になったときの処理
            // ※必要に応じて条件（ステータスが切り替わった瞬間など）を調整してください
            if (currentStatus === "playing") {
                const jsonString = JSON.stringify({
                    id: docSnap.id,
                    hostName: data.hostName,
                    playerCount: data.playerCount,
                    maxPlayers: data.maxPlayers,
                    status: data.status
                });

                if (window.unityInstance) {
                    console.log("DBのステータスが playing に更新された");
                    window.unityInstance.SendMessage("RoomManager", "GameStart", jsonString);
                }
            }
        }
    });
};

window.stopRoomListener = function() {
    if (unsubscribeMessages) {
        unsubscribeMessages(); 
        unsubscribeMessages = null;
    }
    // タイマーの監視を解除
    if (unsubscribeTimer) {
        unsubscribeTimer(); 
        unsubscribeTimer = null;
    }

    // タイマーの監視を解除
    if (unsubscribeStatus) {
        unsubscribeStatus(); 
        unsubscribeStatus = null;
    }
    console.log("Roomシーンの監視を終了しました");
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

// トリガー：ロビー画面の入室ボタン押下
// 内容：入室可能であるかトランザクション処理で判断する
window.joinRoom = async function(jsonData) {

    console.log("届いた生データ ->", jsonData);

    if (!jsonData) {
        console.error("jsonData が空っぽで届きました！C#側を確認してください。");
        return;
    }

    const data = JSON.parse(jsonData);
    console.log("joinRoomが呼ばれた！ パース成功:", data);

    try {

        await runTransaction(db, async (transaction) => {

            const roomRef = doc(db, "rooms", data.roomId);
            
            const roomDoc = await transaction.get(roomRef);

            if (!roomDoc.exists()) {
                throw new Error("部屋が存在しません。");
            }

            const currentGuest = roomDoc.data().guestName;

            // ゲストが居れば入室不可
            if (currentGuest) {
                throw new Error("部屋はすでに満員です。");
            }

            // ドキュメントに書き込みを実行
            transaction.update(roomRef, {
                guestName: data.userId,
                playerCount: 2,
                status: "playing"
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

const recentlyDeletedIds = new Set(); // 削除した部屋をロビー画面に出さないガード処理のため

window.deleteRoom = async function(roomId) {

    console.log("window.deleteRoom：これは呼ばれた");
    console.log("除外リストに登録" + roomId);

    recentlyDeletedIds.add(roomId);

    try {
        // 削除したいドキュメントの参照を作成
        const docRef = doc(db, "rooms", roomId);
        
        // ドキュメントを削除
        await deleteDoc(docRef);

        console.log("ドキュメントが正常に削除されました:", roomId);
    } catch (error) {
        console.error("ドキュメントの削除に失敗しました: ", error);
        recentlyDeletedIds.delete(roomId);
    }
}

// トリガー：スペースキー押下　TimerManager.cs
// 内容：firestore→roomsのturnEndAtの書き込み
// 　　　タイマーの開始
window.setTurnEndAt = async function(roomId) {

    console.log("window.setTurnEndAt：これは呼ばれた");

    // ドキュメントの参照を作成
    const docRef = doc(db, "rooms", roomId);

    // 現在の時刻（ミリ秒）に60秒（60000ミリ秒）を足して、ターン終了時刻を作る
    const newEndTime = Date.now() + 60 * 1000;

    console.log("設定する終了時刻:", newEndTime);

    // setDocの読み込み不可をさせないために、turnEndAtを作り始めて必ず書き込めるようにする
    await setDoc(docRef, {
        turnEndAt: newEndTime
    }, { merge: true });
}

// roomIdを受け取って存在確認を行う関数
async function checkRoomExistsAndHandle(roomId) {
    try {
        // rooms コレクションの中の roomId ドキュメントの参照を取得
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);

        // ドキュメントが存在するかチェック
        if (roomSnap.exists()) {
            console.log("ルームが見つかりました:", roomId);
            
            await updateDoc(roomRef, {
                status: "playing"
            });

        } else {
            console.log("ルームが見つかりませんでした。退室処理を実行します。");
            
            // 見つからなかった場合に呼び出したい退室関数を実行
            if (window.unityInstance) {
                window.unityInstance.SendMessage("RoomManager", "exitRoom");
            }
        }      

    } catch (error) {
        console.error("ルーム確認中にエラーが発生しました:", error);

        // 見つからなかった場合に呼び出したい退室関数を実行
        if (window.unityInstance) {
            window.unityInstance.SendMessage("RoomManager", "exitRoom");
        }
    }
}



