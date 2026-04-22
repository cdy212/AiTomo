// js/dataService.js
// Firebase SDK 또는 차후 VM 백엔드 API 연동을 위한 전역 추상화 데이터 서비스
// 현재 Firebase 키가 없을 경우를 대비하여 LocalStorage 모의(Mock) 저장소를 자동으로 Fallback 하여 작동합니다.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, enableMultiTabIndexedDbPersistence, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Firebase 프로젝트 설정 후 여기에 적절한 Config를 입력하세요.
const firebaseConfig = {
    // apiKey: "YOUR_API_KEY",
    // authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    // projectId: "YOUR_PROJECT_ID",
    // storageBucket: "YOUR_PROJECT_ID.appspot.com",
    // messagingSenderId: "123456789",
    // appId: "1:123456789:web:abcdefgh"
};

let db = null;
try {
    if (firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);

        // 인프라.md 규칙 준수: 오프라인 캐시(Persistence) 활성화하여 읽기 비용 최소화
        enableMultiTabIndexedDbPersistence(db).catch((err) => {
            console.warn("Firebase 캐시 활성화 실패:", err.code);
        });
        console.log("Firebase DB 연동 활성화 완료.");
    } else {
        console.warn("Firebase 플러그인 키가 누락되어 LocalStorage 가상 DB로 대체 구동됩니다.");
    }
} catch (e) {
    console.warn("Firebase 초기화 에러:", e);
}

const getLocalPosts = (coll) => JSON.parse(localStorage.getItem(`mock_${coll}`) || "[]");
const saveLocalPosts = (coll, data) => localStorage.setItem(`mock_${coll}`, JSON.stringify(data));

// 초기 더미 데이터 주입 (UI 테스트 용)
if (getLocalPosts('coffeeLounge').length === 0) {
    saveLocalPosts('coffeeLounge', [
        { 
            id: "1", author: "익명", region: "답십리", 
            title: "아니 애가 갑자기 열이 나는데 일본인 남편이 당황해서 한국어로 병원 예약을 못잡아요. 어쩌죠? 팁좀 ㅠ", 
            comments: 4, likes: 12, 
            createdAt: new Date(Date.now() - 10*60000).toISOString() 
        },
        { 
            id: "2", author: "익명", region: "전농동", 
            title: "배달 음식 물리는데 전농동 근처에 포장 픽업하기 좋은 아기랑 먹을만한 식당 있나요?", 
            comments: 1, likes: 3, 
            createdAt: new Date(Date.now() - 40*60000).toISOString() 
        }
    ]);
}

window.DataService = {
    getPosts: async (collectionName) => {
        if (db) {
            // Firebase 조회 (비용 방어를 위해 limit 적용)
            const q = query(collection(db, collectionName), orderBy("createdAt", "desc"), limit(20));
            const querySnapshot = await getDocs(q);
            let results = [];
            querySnapshot.forEach((doc) => {
                let data = doc.data();
                // Firestore timestamp 변환
                if(data.createdAt && typeof data.createdAt.toDate === 'function') {
                    data.createdAt = data.createdAt.toDate().toISOString();
                }
                results.push({ id: doc.id, ...data });
            });
            return results;
        } else {
            // LocalStorage Mock 반환
            return getLocalPosts(collectionName).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
    },
    
    addPost: async (collectionName, data) => {
        if (db) {
            const payload = { ...data, createdAt: serverTimestamp() };
            const docRef = await addDoc(collection(db, collectionName), payload);
            return docRef.id;
        } else {
            const posts = getLocalPosts(collectionName);
            const newPost = { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() };
            posts.push(newPost);
            saveLocalPosts(collectionName, posts);
            return newPost.id;
        }
    },

    getPost: async (collectionName, id) => {
        if (db) {
            // Firebase 구현 (생략)
            return null; // 차후 firebase-firestore의 getDoc() 사용
        } else {
            const posts = getLocalPosts(collectionName);
            return posts.find(p => p.id === id.toString()) || null;
        }
    },

    getReplies: async (collectionName, postId) => {
        if (db) {
            // Firebase sub-collection 조회
            return []; // 차후 구현
        } else {
            return getLocalPosts(`${collectionName}_replies_${postId}`).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
    },

    addReply: async (collectionName, postId, data) => {
        if (db) {
            // Firebase sub-collection 에 추가
            return null; 
        } else {
            const repliesKey = `${collectionName}_replies_${postId}`;
            const replies = getLocalPosts(repliesKey);
            const newReply = { id: Date.now().toString(), postId, ...data, createdAt: new Date().toISOString() };
            replies.push(newReply);
            localStorage.setItem(`mock_${repliesKey}`, JSON.stringify(replies));
            
            // 본글의 댓글 수 업데이트
            const posts = getLocalPosts(collectionName);
            const postIdx = posts.findIndex(p => p.id === postId.toString());
            if (postIdx >= 0) {
                posts[postIdx].comments = (posts[postIdx].comments || 0) + 1;
                saveLocalPosts(collectionName, posts);
            }
            
            return newReply.id;
        }
    }
};

// Dispatch event so scripts know DataService is ready
window.dispatchEvent(new CustomEvent('DataServiceReady'));
