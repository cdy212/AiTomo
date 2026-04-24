// js/dataService.js
// Firebase SDK (CDN ESM) 기반 전역 추상화 데이터 서비스
// Firebase 연결 실패 시 LocalStorage Mock으로 자동 Fallback
//
// [중요] 이 프로젝트는 번들러(webpack/vite) 없이 순수 HTML+JS 구조를 사용합니다.
// 따라서 npm install 방식 대신 Google CDN ESM URL import 방식을 사용합니다.
// 'npm install firebase'는 이 파일에서 직접 동작하지 않습니다.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getFirestore,
    enableIndexedDbPersistence,
    collection,
    doc,
    getDoc,
    addDoc,
    getDocs,
    updateDoc,
    increment,
    query,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";


// aitomo-e108f Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCKxVC03LxeikqM3gFPuBt4XciXcqL_aRA",
    authDomain: "aitomo-e108f.firebaseapp.com",
    projectId: "aitomo-e108f",
    storageBucket: "aitomo-e108f.firebasestorage.app",
    messagingSenderId: "384275737042",
    appId: "1:384275737042:web:4fcf0de21115f1db58800b",
    measurementId: "G-MG57CFHMQJ"
};

let db = null;
let analytics = null;

try {
    const app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);


    db = getFirestore(app);

    // 인프라.md 규칙 준수: 오프라인 캐시 활성화하여 중복 읽기 비용 최소화
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Firebase 캐시: 멀티탭 환경에서는 하나의 탭에서만 활성화됩니다.");
        } else if (err.code === 'unimplemented') {
            console.warn("Firebase 캐시: 이 브라우저는 IndexedDB를 지원하지 않습니다.");
        }
    });

    console.log("[DataService] Firebase Firestore 연동 완료 (프로젝트: aitomo-e108f)");
} catch (e) {
    console.error("[DataService] Firebase 초기화 실패, LocalStorage Mock으로 대체합니다:", e);
    db = null;
}

// ------------------
// LocalStorage Mock Helpers (Fallback 전용)
// ------------------
const getLocalPosts = (key) => JSON.parse(localStorage.getItem(`mock_${key}`) || "[]");
const saveLocalPosts = (key, data) => localStorage.setItem(`mock_${key}`, JSON.stringify(data));

// LocalStorage 초기 더미 데이터 (Fallback 모드 UI 테스트용)
if (!db && getLocalPosts('coffeeLounge').length === 0) {
    saveLocalPosts('coffeeLounge', [
        {
            id: "1", author: "익명", region: "답십리",
            title: "아니 애가 갑자기 열이 나는데 일본인 남편이 당황해서 한국어로 병원 예약을 못잡아요. 어쩌죠? 팁좀 ㅠ",
            comments: 4, likes: 12,
            createdAt: new Date(Date.now() - 10 * 60000).toISOString()
        },
        {
            id: "2", author: "익명", region: "전농동",
            title: "배달 음식 물리는데 전농동 근처에 포장 픽업하기 좋은 아기랑 먹을만한 식당 있나요?",
            comments: 1, likes: 3,
            createdAt: new Date(Date.now() - 40 * 60000).toISOString()
        }
    ]);
}

// ------------------
// Timestamp 변환 헬퍼
// ------------------
const toISO = (val) => {
    if (!val) return new Date().toISOString();
    if (typeof val.toDate === 'function') return val.toDate().toISOString();
    return val;
};

// ------------------
// DataService 공개 API
// ------------------
window.DataService = {

    // 게시글 목록 조회 (최신순, 최대 20건)
    getPosts: async (collectionName) => {
        if (db) {
            try {
                const q = query(
                    collection(db, collectionName),
                    orderBy("createdAt", "desc"),
                    limit(20)
                );
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: toISO(d.data().createdAt)
                }));
            } catch (e) {
                console.error("[DataService] getPosts 실패:", e);
                return [];
            }
        } else {
            return getLocalPosts(collectionName).sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
        }
    },

    // 게시글 등록
    addPost: async (collectionName, data) => {
        if (db) {
            try {
                const payload = { ...data, createdAt: serverTimestamp(), likes: 0, comments: 0 };
                const docRef = await addDoc(collection(db, collectionName), payload);
                return docRef.id;
            } catch (e) {
                console.error("[DataService] addPost 실패:", e);
                return null;
            }
        } else {
            const posts = getLocalPosts(collectionName);
            const newPost = {
                id: Date.now().toString(),
                ...data,
                likes: 0,
                comments: 0,
                createdAt: new Date().toISOString()
            };
            posts.unshift(newPost);
            saveLocalPosts(collectionName, posts);
            return newPost.id;
        }
    },

    // 단일 게시글 조회
    getPost: async (collectionName, id) => {
        if (db) {
            try {
                const docRef = doc(db, collectionName, id);
                const snap = await getDoc(docRef);
                if (!snap.exists()) return null;
                return {
                    id: snap.id,
                    ...snap.data(),
                    createdAt: toISO(snap.data().createdAt)
                };
            } catch (e) {
                console.error("[DataService] getPost 실패:", e);
                return null;
            }
        } else {
            return getLocalPosts(collectionName).find(p => p.id === id.toString()) || null;
        }
    },

    // 답변(댓글) 목록 조회 - sub-collection 구조: /{collectionName}/{postId}/replies
    getReplies: async (collectionName, postId) => {
        if (db) {
            try {
                const repliesRef = collection(db, collectionName, postId, "replies");
                const q = query(repliesRef, orderBy("createdAt", "asc"), limit(50));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: toISO(d.data().createdAt)
                }));
            } catch (e) {
                console.error("[DataService] getReplies 실패:", e);
                return [];
            }
        } else {
            return getLocalPosts(`${collectionName}_replies_${postId}`).sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
        }
    },

    // 답변(댓글) 등록 + 본글 comments 카운트 +1
    addReply: async (collectionName, postId, data) => {
        if (db) {
            try {
                const repliesRef = collection(db, collectionName, postId, "replies");
                const newReply = await addDoc(repliesRef, {
                    ...data,
                    createdAt: serverTimestamp()
                });

                // 본글 comments 카운트 원자적 증가
                const postRef = doc(db, collectionName, postId);
                await updateDoc(postRef, { comments: increment(1) });

                return newReply.id;
            } catch (e) {
                console.error("[DataService] addReply 실패:", e);
                return null;
            }
        } else {
            const repliesKey = `${collectionName}_replies_${postId}`;
            const replies = getLocalPosts(repliesKey);
            const newReply = {
                id: Date.now().toString(),
                postId,
                ...data,
                createdAt: new Date().toISOString()
            };
            replies.push(newReply);
            localStorage.setItem(`mock_${repliesKey}`, JSON.stringify(replies));

            // 본글 comments 수 업데이트
            const posts = getLocalPosts(collectionName);
            const idx = posts.findIndex(p => p.id === postId.toString());
            if (idx >= 0) {
                posts[idx].comments = (posts[idx].comments || 0) + 1;
                saveLocalPosts(collectionName, posts);
            }

            return newReply.id;
        }
    },

    // 공감(좋아요) +1
    likePost: async (collectionName, postId) => {
        if (db) {
            try {
                const postRef = doc(db, collectionName, postId);
                await updateDoc(postRef, { likes: increment(1) });
                return true;
            } catch (e) {
                console.error("[DataService] likePost 실패:", e);
                return false;
            }
        } else {
            const posts = getLocalPosts(collectionName);
            const idx = posts.findIndex(p => p.id === postId.toString());
            if (idx >= 0) {
                posts[idx].likes = (posts[idx].likes || 0) + 1;
                saveLocalPosts(collectionName, posts);
            }
            return true;
        }
    },

    // 게시글 수정 (content 등 일부 필드 업데이트)
    updatePost: async (collectionName, postId, fields) => {
        if (db) {
            try {
                const postRef = doc(db, collectionName, postId);
                await updateDoc(postRef, { ...fields });
                return true;
            } catch (e) {
                console.error("[DataService] updatePost 실패:", e);
                return false;
            }
        } else {
            const posts = getLocalPosts(collectionName);
            const idx = posts.findIndex(p => p.id === postId.toString());
            if (idx >= 0) {
                posts[idx] = { ...posts[idx], ...fields };
                saveLocalPosts(collectionName, posts);
            }
            return true;
        }
    },

    // 게시글 삭제
    deletePost: async (collectionName, postId) => {
        if (db) {
            try {
                const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
                const postRef = doc(db, collectionName, postId);
                await deleteDoc(postRef);
                return true;
            } catch (e) {
                console.error("[DataService] deletePost 실패:", e);
                return false;
            }
        } else {
            const posts = getLocalPosts(collectionName).filter(p => p.id !== postId.toString());
            saveLocalPosts(collectionName, posts);
            return true;
        }
    },

    // === 동네꿀팁 (dongnaeTips) API ===

    getTips: async (options = {}) => {
        if (db) {
            try {
                // 기본 최신순 100건 조회 (추후 거리순 필터링은 클라이언트에서 처리)
                const q = query(
                    collection(db, 'dongnaeTips'),
                    orderBy("createdAt", "desc"),
                    limit(100)
                );
                const snapshot = await getDocs(q);
                let tips = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: toISO(d.data().createdAt)
                }));
                if (options.category && options.category !== 'all') {
                    tips = tips.filter(t => t.category === options.category);
                }
                return tips;
            } catch (e) {
                console.error("[DataService] getTips 실패:", e);
                return [];
            }
        } else {
            let tips = getLocalPosts('dongnaeTips');
            if (options.category && options.category !== 'all') {
                tips = tips.filter(t => t.category === options.category);
            }
            return tips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
    },

    addTip: async (data) => {
        const authorToken = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        let newDocId = null;

        if (db) {
            try {
                const payload = {
                    ...data,
                    authorToken,
                    createdAt: serverTimestamp(),
                    likes: 0,
                    likedBy: [],
                    status: 'active'
                };
                const docRef = await addDoc(collection(db, 'dongnaeTips'), payload);
                newDocId = docRef.id;
            } catch (e) {
                console.error("[DataService] addTip 실패:", e);
                return null;
            }
        } else {
            const tips = getLocalPosts('dongnaeTips');
            const newTip = {
                id: Date.now().toString(),
                ...data,
                authorToken,
                likes: 0,
                likedBy: [],
                status: 'active',
                createdAt: new Date().toISOString()
            };
            tips.unshift(newTip);
            saveLocalPosts('dongnaeTips', tips);
            newDocId = newTip.id;
        }

        // 브라우저 로컬 스토리지에 글 비밀키(토큰) 매핑 저장
        if (newDocId) {
            const tokens = JSON.parse(localStorage.getItem('dongnae_tokens') || '{}');
            tokens[newDocId] = authorToken;
            localStorage.setItem('dongnae_tokens', JSON.stringify(tokens));
        }

        return newDocId;
    },

    likeTip: async (docId, uid) => {
        if (db) {
            try {
                const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
                const tipRef = doc(db, 'dongnaeTips', docId);

                await updateDoc(tipRef, {
                    likes: increment(1),
                    likedBy: arrayUnion(uid)
                });
                return true;
            } catch (e) {
                console.error("[DataService] likeTip 실패:", e);
                return false;
            }
        } else {
            const tips = getLocalPosts('dongnaeTips');
            const idx = tips.findIndex(t => t.id === docId.toString());
            if (idx >= 0) {
                if (!tips[idx].likedBy) tips[idx].likedBy = [];
                if (!tips[idx].likedBy.includes(uid)) {
                    tips[idx].likedBy.push(uid);
                    tips[idx].likes = (tips[idx].likes || 0) + 1;
                    saveLocalPosts('dongnaeTips', tips);
                    return true;
                }
            }
            return false;
        }
    },

    deleteDongnaeTip: async (docId, authorToken) => {
        if (db) {
            try {
                // 실제 보안은 Firebase Security Rules에서 `resource.data.authorToken == request.resource.data.authorToken` 확인 필요
                const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
                const tipRef = doc(db, 'dongnaeTips', docId);
                await deleteDoc(tipRef);
                return true;
            } catch (e) {
                console.error("[DataService] deleteDongnaeTip 실패:", e);
                return false;
            }
        } else {
            let tips = getLocalPosts('dongnaeTips');
            tips = tips.filter(t => t.id !== docId.toString());
            saveLocalPosts('dongnaeTips', tips);
            return true;
        }
    },

    updateDongnaeTip: async (docId, fields, authorToken) => {
        if (db) {
            try {
                const tipRef = doc(db, 'dongnaeTips', docId);
                await updateDoc(tipRef, fields);
                return true;
            } catch (e) {
                console.error("[DataService] updateDongnaeTip 실패:", e);
                return false;
            }
        } else {
            const tips = getLocalPosts('dongnaeTips');
            const idx = tips.findIndex(t => t.id === docId.toString());
            if (idx >= 0) {
                tips[idx] = { ...tips[idx], ...fields };
                saveLocalPosts('dongnaeTips', tips);
                return true;
            }
            return false;
        }
    },

    // Analytics Helper
    trackPageView: (pageName) => {
        if (analytics) {
            logEvent(analytics, 'page_view', {
                page_title: pageName,
                page_location: window.location.href,
                page_path: window.location.pathname
            });
            console.log(`[Analytics] Tracked page view: ${pageName}`);
        }
    },

    trackEvent: (eventName, eventParams = {}) => {
        if (analytics) {
            logEvent(analytics, eventName, eventParams);
            console.log(`[Analytics] Tracked event: ${eventName}`, eventParams);
        }
    }
};

// DataService 준비 완료 이벤트 발행
window.dispatchEvent(new CustomEvent('DataServiceReady'));
console.log("[DataService] 초기화 완료 (Firebase 모드:", !!db, ")");

// 자동으로 현재 페이지 뷰 트래킹
if (window.DataService && window.DataService.trackPageView) {
    // DOM이 완전히 로드된 후 타이틀을 읽기 위해 약간 지연 또는 그대로 실행
    setTimeout(() => {
        window.DataService.trackPageView(document.title || 'Unknown Page');
    }, 500);
}
