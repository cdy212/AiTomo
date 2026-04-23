// js/dongnae.js
// 동네꿀팁 지도 렌더링 및 마커 제어 스크립트

let map = null;
let currentMarkers = [];         // { marker, infoWindow, tip } 형태로 저장
let currentInfoWindow = null;
let categoryFilters = 'all';

// 마커 클릭 이벤트 트리거 (랭킹에서 호출 시 사용)
function openMarkerInfoWindow(markerObj) {
    if (!markerObj || !map) return;
    if (currentInfoWindow) currentInfoWindow.close();
    markerObj.infoWindow.open(map, markerObj.marker);
    currentInfoWindow = markerObj.infoWindow;
}

// 카테고리별 마커 색상 및 아이콘(이모지) 매핑
const categoryStyles = {
    'playground': { color: '#5BA85B', name: '놀이터', emoji: '🛝' },
    'pool': { color: '#3B9ECC', name: '수영장/키즈풀', emoji: '💦' },
    'hospital': { color: '#E05555', name: '병원/소아과', emoji: '🏥' },
    'daycare': { color: '#8B6FD6', name: '어린이집', emoji: '🧸' },
    'kindergarten': { color: '#C47FD0', name: '유치원', emoji: '🎒' },
    'restaurant': { color: '#E87D3E', name: '맛집/카페', emoji: '🍽️' },
    'beauty': { color: '#D97DB0', name: '미용/피부과', emoji: '✂️' },
    'etc': { color: '#9E9E9E', name: '기타', emoji: '📌' }
};

// 네이버 지도 초기화 함수
function initMap(lat, lng) {
    const mapOptions = {
        center: new naver.maps.LatLng(lat, lng),
        zoom: 15,
        minZoom: 10,
        mapTypeControl: false,
        zoomControl: false, // 커스텀 버튼 사용을 위해 숨김
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
    };

    map = new naver.maps.Map('map', mapOptions);

    // 현재 위치 마커 표시 (파란색 닷)
    new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng),
        map: map,
        icon: {
            content: `
                <div class="relative flex items-center justify-center w-6 h-6">
                    <div class="absolute w-full h-full bg-blue-500 rounded-full opacity-30 animate-ping"></div>
                    <div class="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md"></div>
                </div>
            `,
            anchor: new naver.maps.Point(12, 12),
        }
    });

    console.log("[Dongnae] 지도 초기화 완료");
}

// 사용자 현재 위치 가져오기
function fetchCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("브라우저가 위치 정보를 지원하지 않습니다."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    });
}

// 두 좌표 간 거리 계산 (Haversine, 단위: km)
function calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let _rankingAllSorted = [];
const RANKING_PAGE_SIZE = 10;
let _rankingPage = 1;

// 랭킹 리스트 렌더링 (좋아요 내림차순 → 동점 시 거리 오름차순)
function renderRanking(tips) {
    const listContainer = document.getElementById('ranking-list');
    const moreBtn = document.getElementById('ranking-more-btn');
    if (!listContainer) return;

    if (tips.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-xs text-textmuted p-2">아직 데이터가 없습니다.</div>';
        if (moreBtn) moreBtn.classList.add('hidden');
        return;
    }

    const center = map ? map.getCenter() : null;
    const myLat = center ? center.lat() : null;
    const myLng = center ? center.lng() : null;

    _rankingAllSorted = [...tips].sort((a, b) => {
        const likeDiff = (b.likes || 0) - (a.likes || 0);
        if (likeDiff !== 0) return likeDiff;
        if (myLat !== null) {
            const dA = calcDistance(myLat, myLng, parseFloat(a.lat), parseFloat(a.lng));
            const dB = calcDistance(myLat, myLng, parseFloat(b.lat), parseFloat(b.lng));
            return dA - dB;
        }
        return 0;
    });

    _rankingPage = 1;
    _renderRankingPage();
}

function _renderRankingPage() {
    const listContainer = document.getElementById('ranking-list');
    const moreBtn = document.getElementById('ranking-more-btn');
    const center = map ? map.getCenter() : null;
    const myLat = center ? center.lat() : null;
    const myLng = center ? center.lng() : null;

    const visible = _rankingAllSorted.slice(0, _rankingPage * RANKING_PAGE_SIZE);
    const medals = ['🥇','🥈','🥉'];

    listContainer.innerHTML = visible.map((tip, idx) => {
        const style = categoryStyles[tip.category] || categoryStyles['etc'];
        const displayCatName = (tip.category === 'etc' && tip.customCategory) ? tip.customCategory : style.name;
        const numLabel = idx < 3 ? medals[idx] : `${idx + 1}`;
        const numColor = idx < 3 ? '' : 'text-gray-400';

        let distLabel = '';
        if (myLat !== null && !isNaN(parseFloat(tip.lat))) {
            const dist = calcDistance(myLat, myLng, parseFloat(tip.lat), parseFloat(tip.lng));
            distLabel = dist < 1
                ? `<span class="text-[10px] text-textmuted ml-1">${Math.round(dist * 1000)}m</span>`
                : `<span class="text-[10px] text-textmuted ml-1">${dist.toFixed(1)}km</span>`;
        }

        return `
            <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-black/5 cursor-pointer hover:bg-gray-100 transition-colors" onclick="moveToMarker(${tip.lat}, ${tip.lng})">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="font-black ${numColor} text-sm w-5 text-center shrink-0">${numLabel}</span>
                    <span class="font-bold text-sm text-textmain truncate">${tip.placeName}</span>
                    ${distLabel}
                </div>
                <div class="flex items-center gap-1.5 text-xs font-bold text-textmuted shrink-0">
                    <span class="px-1.5 py-0.5 rounded" style="background-color: ${style.color}15; color: ${style.color}">${displayCatName.split('/')[0]}</span>
                    <span class="flex items-center gap-0.5 text-accent"><iconify-icon icon="solar:heart-bold"></iconify-icon> ${tip.likes || 0}</span>
                    <a href="https://map.naver.com/p/search/${encodeURIComponent(tip.placeName)}" target="_blank" rel="noopener"
                        onclick="event.stopPropagation()"
                        class="flex items-center justify-center w-6 h-6 bg-[#03C75A]/10 hover:bg-[#03C75A] text-[#03C75A] hover:text-white rounded-md transition-colors"
                        title="네이버 지도에서 보기">
                        <iconify-icon icon="solar:map-bold" class="text-xs"></iconify-icon>
                    </a>
                </div>
            </div>
        `;
    }).join('');

    if (moreBtn) {
        if (_rankingAllSorted.length > _rankingPage * RANKING_PAGE_SIZE) {
            const remaining = _rankingAllSorted.length - _rankingPage * RANKING_PAGE_SIZE;
            moreBtn.textContent = `더보기 (${remaining}개 남음) ▾`;
            moreBtn.classList.remove('hidden');
            moreBtn.onclick = () => { _rankingPage++; _renderRankingPage(); };
        } else {
            moreBtn.classList.add('hidden');
        }
    }
}


// 랭킹 항목 클릭 시 해당 마커로 이동 + InfoWindow 열기
window.moveToMarker = function(lat, lng) {
    if (!map) return;
    const targetLatLng = new naver.maps.LatLng(lat, lng);
    map.morph(targetLatLng, 16, {}, () => {
        // 이동 완료 후 해당 위치의 마커 InfoWindow 오픈
        const found = currentMarkers.find(m => {
            const pos = m.marker.getPosition();
            return Math.abs(pos.lat() - lat) < 0.0001 && Math.abs(pos.lng() - lng) < 0.0001;
        });
        if (found) openMarkerInfoWindow(found);
    });
}

// 좋아요 핸들러 (전역 함수)
window.likeTipHandler = async function(docId) {
    // 임시: localStorage를 이용한 디바이스 핑거프린트
    let uid = localStorage.getItem('dummy_uid');
    if(!uid) {
        uid = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('dummy_uid', uid);
    }

    const success = await window.DataService.likeTip(docId, uid);
    if(success) {
        const tips = await window.DataService.getTips();
        renderMarkers(tips);
    } else {
        alert("이미 공감하셨거나 일시적인 오류가 발생했습니다.");
    }
}

// 삭제 핸들러 (전역 함수)
window.deleteTipHandler = async function(docId) {
    if (!confirm("정말 이 제보를 삭제하시겠습니까?")) return;
    
    const tokens = JSON.parse(localStorage.getItem('dongnae_tokens') || '{}');
    const authorToken = tokens[docId];

    if (!authorToken) {
        alert("삭제 권한이 없습니다.");
        return;
    }

    const success = await window.DataService.deleteDongnaeTip(docId, authorToken);
    if (success) {
        alert("삭제되었습니다.");
        // 캐시 키 삭제
        delete tokens[docId];
        localStorage.setItem('dongnae_tokens', JSON.stringify(tokens));
        
        // 목록 재로딩
        const tips = await window.DataService.getTips();
        renderMarkers(tips);
    } else {
        alert("삭제 중 오류가 발생했습니다.");
    }
};

// 임시 수정 핸들러 (메모 수정만 지원)
window.editTipHandler = async function(docId) {
    const tokens = JSON.parse(localStorage.getItem('dongnae_tokens') || '{}');
    const authorToken = tokens[docId];

    if (!authorToken) {
        alert("수정 권한이 없습니다.");
        return;
    }

    const newMemo = prompt("수정할 메모 내용을 입력하세요:");
    if (newMemo === null) return; // 취소

    const success = await window.DataService.updateDongnaeTip(docId, { memo: newMemo }, authorToken);
    if (success) {
        alert("수정되었습니다.");
        const tips = await window.DataService.getTips();
        renderMarkers(tips);
    } else {
        alert("수정 중 오류가 발생했습니다.");
    }
};

// ──────────────────────────────────────────────────────────────────
// 네이버 이미지 검색 + Edge Cache 로드 (Worker /image 엔드포인트 사용)
// ──────────────────────────────────────────────────────────────────
const IMAGE_WORKER = 'https://aitomo-navermap.cdy3088.workers.dev/image';
const IMG_INITIAL_COUNT = 5; // 초기 노출 장수

window.loadNaverImages = async function(galleryId, placeName) {
    const container = document.getElementById(galleryId);
    if (!container) return;

    try {
        const res = await fetch(`${IMAGE_WORKER}?query=${encodeURIComponent(placeName)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = (data.items || []).filter(it => it.link || it.thumbnail);

        if (items.length === 0) {
            container.innerHTML = `<div class="flex items-center justify-center h-full text-xs text-gray-400">사진 없음</div>`;
            return;
        }

        const renderImages = (list) => list.map(it =>
            `<img src="${it.thumbnail || it.link}" alt="장소 사진" loading="lazy"
                class="h-full w-auto object-cover rounded-lg shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                onerror="this.style.display='none'">`
        ).join('');

        const initial = items.slice(0, IMG_INITIAL_COUNT);
        const rest    = items.slice(IMG_INITIAL_COUNT);
        const hasMore  = rest.length > 0;

        container.className = 'relative bg-gray-100 overflow-hidden';
        container.innerHTML = `
            <div id="${galleryId}-scroll" class="flex gap-1.5 overflow-x-auto p-2 h-36 no-scrollbar">
                ${renderImages(initial)}
            </div>
            ${hasMore ? `
            <button id="${galleryId}-more"
                class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full hover:bg-black/80 transition-colors">
                +${rest.length}장 더보기
            </button>` : ''}
        `;

        if (hasMore) {
            document.getElementById(`${galleryId}-more`).addEventListener('click', () => {
                const scroll = document.getElementById(`${galleryId}-scroll`);
                scroll.insertAdjacentHTML('beforeend', renderImages(rest));
                document.getElementById(`${galleryId}-more`).remove();
            });
        }
    } catch (e) {
        console.warn('[loadNaverImages] 이미지 로드 실패:', e.message);
        container.innerHTML = `<div class="flex items-center justify-center h-full text-xs text-gray-400">사진을 불러올 수 없습니다</div>`;
    }
};

// 지도 마커 렌더링 함수
function renderMarkers(tips) {
    console.log(`[renderMarkers] 호출됨 - tips 수: ${tips.length}, 현재 필터: ${categoryFilters}`);

    // 기존 마커 및 인포윈도우 제거
    currentMarkers.forEach(m => m.marker.setMap(null));  // ← 객체구조 { marker, infoWindow, tip }
    currentMarkers = [];
    if (currentInfoWindow) { currentInfoWindow.close(); currentInfoWindow = null; }

    // 랭킹 동시 업데이트
    renderRanking(tips);

    let renderedCount = 0;
    tips.forEach((tip, idx) => {
        // 필터 적용
        if (categoryFilters !== 'all' && tip.category !== categoryFilters) return;

        // 좌표 유효성 검증
        const lat = parseFloat(tip.lat);
        const lng = parseFloat(tip.lng);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            console.warn(`[renderMarkers] tip[${idx}] 좌표 이상 → 스킵:`, { placeName: tip.placeName, lat: tip.lat, lng: tip.lng });
            return;
        }
        console.log(`[renderMarkers] tip[${idx}] 마커 생성: ${tip.placeName} (${lat}, ${lng})`);
        renderedCount++;

        const style = categoryStyles[tip.category] || categoryStyles['etc'];
        // 기타 카테고리에 사용자 입력값이 있는 경우 표시명 대체
        const displayCategoryName = (tip.category === 'etc' && tip.customCategory) ? tip.customCategory : style.name;
        const contentStr = `
            <div class="relative flex flex-col items-center group cursor-pointer transition-transform hover:-translate-y-1 hover:z-50">
                <div class="bg-white px-2 py-1 rounded-full shadow-md border border-[${style.color}] text-[11px] font-bold text-[${style.color}] whitespace-nowrap mb-1">
                    ${tip.placeName}
                </div>
                <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center" style="background-color: ${style.color};">
                    <span class="text-white font-bold text-[14px]">${style.emoji || style.name.substring(0, 2)}</span>
                </div>
                <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style="border-top-color: ${style.color};"></div>
            </div>
        `;

        const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(lat, lng),
            map: map,
            icon: {
                content: contentStr,
                anchor: new naver.maps.Point(16, 46)
            }
        });

        const tokens = JSON.parse(localStorage.getItem('dongnae_tokens') || '{}');
        const isAuthor = !!tokens[tip.id];
        const naverMapUrl = `https://map.naver.com/p/search/${encodeURIComponent(tip.placeName)}`;
        const galleryId = `gallery-${tip.id}`;

        // InfoWindow HTML (이미지 갤러리 플레이스홀더 + 아웃링크 포함)
        const infoHtml = `
            <div class="bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-black/10 overflow-hidden w-64 transform -translate-y-4">
                <!-- 이미지 갤러리 영역 -->
                <div id="${galleryId}" class="relative bg-gray-100 h-36 flex items-center justify-center">
                    <div class="text-xs text-gray-400 flex flex-col items-center gap-1">
                        <span class="text-2xl">📷</span>
                        <span>사진 불러오는 중...</span>
                    </div>
                </div>
                <!-- 본문 -->
                <div class="p-4">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex-1 min-w-0">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded text-white" style="background-color: ${style.color}">${displayCategoryName}</span>
                            <h3 class="font-extrabold text-[15px] text-textmain mt-1.5 break-keep-all truncate">${tip.placeName}</h3>
                        </div>
                    </div>
                    ${tip.memo ? `<div class="text-[12px] font-medium text-textmuted bg-gray-50 p-2.5 rounded-xl mb-3 break-keep-all line-clamp-2 leading-relaxed">${tip.memo}</div>` : ''}
                    <div class="text-[10px] text-textmuted font-bold mb-3 flex items-center gap-1">
                        <iconify-icon icon="solar:user-circle-linear" class="text-sm"></iconify-icon> 제보자: ${tip.reporterNick}
                    </div>
                    <!-- 공감 + 네이버 지도 버튼 -->
                    <div class="flex gap-2 mb-2">
                        <button onclick="window.likeTipHandler('${tip.id}')" class="flex-1 bg-accent/10 hover:bg-accent text-accent hover:text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1 transition-colors text-sm">
                            <iconify-icon icon="solar:heart-bold"></iconify-icon> 공감 (${tip.likes || 0})
                        </button>
                        <a href="${naverMapUrl}" target="_blank" rel="noopener" class="flex items-center justify-center gap-1 px-3 py-2 bg-[#03C75A]/10 hover:bg-[#03C75A] text-[#03C75A] hover:text-white font-bold rounded-xl transition-colors text-xs shrink-0">
                            <iconify-icon icon="solar:map-bold"></iconify-icon> 지도
                        </a>
                    </div>
                    ${isAuthor ? `
                    <div class="flex gap-2 pt-2 border-t border-black/5">
                        <button onclick="window.editTipHandler('${tip.id}')" class="flex-1 py-1.5 text-[11px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">수정</button>
                        <button onclick="window.deleteTipHandler('${tip.id}')" class="flex-1 py-1.5 text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">삭제</button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        const infoWindow = new naver.maps.InfoWindow({
            content: infoHtml,
            borderWidth: 0,
            backgroundColor: 'transparent',
            disableAnchor: true,
            pixelOffset: new naver.maps.Point(0, -10)
        });

        // 마커 클릭 → InfoWindow 오픈 + 이미지 비동기 로드
        naver.maps.Event.addListener(marker, 'click', () => {
            if (currentInfoWindow) currentInfoWindow.close();
            infoWindow.open(map, marker);
            currentInfoWindow = infoWindow;
            // DOM이 삽입된 직후 이미지 로드 (짧은 딜레이로 DOM 렌더 대기)
            setTimeout(() => window.loadNaverImages(galleryId, tip.placeName), 150);
        });

        currentMarkers.push({ marker, infoWindow, tip });
    });
    console.log(`[renderMarkers] 완료 - 실제 렌더링된 마커 수: ${renderedCount}`);
}

// 메인 초기화 실행
async function initializeDongnae() {
    try {
        console.log('[initializeDongnae] 시작');
        const mapContainer = document.getElementById('map');
        mapContainer.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center bg-wbg text-textmuted gap-3"><div class="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div><span class="font-bold text-sm">현재 위치를 찾는 중...</span></div>';

        // 1. 위치 정보 획득 (실패시 기본 서울 좌표: 시청)
        let center = { lat: 37.5666805, lng: 126.9784147 };
        try {
            center = await fetchCurrentLocation();
            console.log('[initializeDongnae] 현재 위치 획득:', center);
        } catch (e) {
            console.warn('[initializeDongnae] 위치 정보를 가져올 수 없어 기본 좌표로 설정합니다.', e);
        }

        // 2. 지도 그리기
        mapContainer.innerHTML = ''; // 로딩 스피너 제거
        initMap(center.lat, center.lng);
        console.log('[initializeDongnae] 지도 초기화 완료');

        // 3. 데이터 로드 및 마커 렌더링
        if (window.DataService) {
            console.log('[initializeDongnae] DataService.getTips() 호출 중...');
            const tips = await window.DataService.getTips();
            console.log(`[initializeDongnae] getTips 결과: ${tips.length}건`, tips);
            renderMarkers(tips);
        } else {
            console.error('[initializeDongnae] window.DataService 없음!');
        }

        // 4. 현재 위치 버튼 이벤트 리스너 등록
        document.getElementById('btn-current-location').addEventListener('click', async () => {
            try {
                const pos = await fetchCurrentLocation();
                map.morph(new naver.maps.LatLng(pos.lat, pos.lng), 15);
            } catch(e) {
                alert('위치 정보를 가져올 수 없습니다.');
            }
        });

    } catch (e) {
        console.error('[initializeDongnae] 초기화 중 오류:', e);
        document.getElementById('map').innerHTML = '<div class="flex items-center justify-center w-full h-full text-red-500 font-bold text-sm">지도를 불러오는데 실패했습니다.</div>';
    }
}

// DataService가 준비되면 지도 초기화 시작
window.addEventListener('DataServiceReady', () => {
    initializeDongnae();
    initReportModal();
});

// 제보하기 모달 및 폼 로직
function initReportModal() {
    const modal = document.getElementById('report-modal');
    const overlay = document.getElementById('report-modal-overlay');
    const content = document.getElementById('report-modal-content');
    const btnOpen = document.getElementById('btn-report');
    const btnClose = document.getElementById('btn-close-report');
    
    // 모달 열기
    btnOpen.addEventListener('click', () => {
        modal.classList.remove('hidden');
        // 강제 리플로우 후 트랜지션 적용
        void modal.offsetWidth;
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
        content.classList.remove('translate-y-full');
        content.classList.add('translate-y-0');
    });

    // 모달 닫기
    const closeModal = () => {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        content.classList.remove('translate-y-0');
        content.classList.add('translate-y-full');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); // transition 시간과 맞춤
    };
    btnClose.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // 장소 검색 로직
    const searchInput = document.getElementById('report-search-input');
    const btnSearch = document.getElementById('btn-search-place');
    const searchResults = document.getElementById('search-results');
    const selectedPlaceContainer = document.getElementById('selected-place');
    const selectedPlaceName = document.getElementById('selected-place-name');
    const selectedPlaceAddr = document.getElementById('selected-place-addr');
    const btnReselect = document.getElementById('btn-reselect-place');

    // 기타 카테고리 직접 입력 표시/숨김
    const catEtcRadio = document.getElementById('cat-etc-radio');
    const etcInputWrap = document.getElementById('etc-category-input-wrap');
    document.querySelectorAll('input[name="report-category"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'etc' && radio.checked) {
                etcInputWrap.classList.remove('hidden');
                document.getElementById('etc-category-input').focus();
            } else {
                etcInputWrap.classList.add('hidden');
                document.getElementById('etc-category-input').value = '';
            }
        });
    });

    let currentSelectedPlace = null;

    btnSearch.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) return alert("상호명을 입력해주세요.");

        searchResults.innerHTML = '<div class="p-4 text-center text-sm text-textmuted">검색 중...</div>';
        searchResults.classList.remove('hidden');

        try {
            // 네이버 Local Search API 프록시 호출 (CF Worker)
            let items = [];
            try {
                const res = await fetch(`https://aitomo-navermap.cdy3088.workers.dev/?query=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    items = data.items || [];
                } else {
                    const errorData = await res.json().catch(() => ({}));
                    const errorMsg = errorData.error || errorData.message || res.statusText || '서버 응답 오류';
                    throw new Error(`API Error [${res.status}]: ${errorMsg}`);
                }
            } catch (err) {
                console.error("API 검색 실패:", err);
                searchResults.innerHTML = `<div class="p-4 text-center text-sm text-red-500 font-bold bg-red-50 rounded-xl">검색 오류가 발생했습니다.<br><span class="text-xs font-medium opacity-80 mt-1 block">${err.message}</span></div>`;
                return;
            }

            if (items.length === 0) {
                searchResults.innerHTML = '<div class="p-4 text-center text-sm text-textmuted">검색 결과가 없습니다.</div>';
                return;
            }

            searchResults.innerHTML = items.map((item, idx) => `
                <div class="p-3 border-b border-black/5 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors" data-idx="${idx}">
                    <div class="font-bold text-textmain text-sm">${item.title.replace(/<[^>]*>?/gm, '')}</div>
                    <div class="text-xs text-textmuted mt-0.5">${item.roadAddress || item.address}</div>
                </div>
            `).join('');

            // 검색 결과 클릭 이벤트
            searchResults.querySelectorAll('div[data-idx]').forEach(el => {
                el.addEventListener('click', () => {
                    const item = items[el.getAttribute('data-idx')];
                    
                    // 네이버 검색 API의 mapx, mapy는 KATECH(TM128) 좌표계입니다.
                    // 이를 Naver 지도 API의 TransCoord 객체를 이용해 WGS84 위경도 좌표로 변환합니다.
                    let lat = map.getCenter().lat();
                    let lng = map.getCenter().lng();
                    
                    // 네이버 검색 API의 mapx, mapy는 경도/위도 * 10^7 값 (WGS84)
                    if (item.mapx && item.mapy) {
                        lng = parseInt(item.mapx, 10) / 1e7;
                        lat = parseInt(item.mapy, 10) / 1e7;
                        console.log(`[좌표변환] ${item.title}: lat=${lat}, lng=${lng}`);
                    }
                    
                    currentSelectedPlace = {
                        placeName: item.title.replace(/<[^>]*>?/gm, ''),
                        address: item.roadAddress || item.address,
                        lat: lat,
                        lng: lng
                    };

                    // 선택된 장소로 지도 이동 (미리 확인 가능하도록)
                    map.setCenter(new naver.maps.LatLng(lat, lng));

                    selectedPlaceName.innerText = currentSelectedPlace.placeName;
                    selectedPlaceAddr.innerText = currentSelectedPlace.address;
                    
                    searchInput.parentElement.parentElement.classList.add('hidden');
                    searchResults.classList.add('hidden');
                    selectedPlaceContainer.classList.remove('hidden');
                });
            });

        } catch (e) {
            searchResults.innerHTML = '<div class="p-4 text-center text-sm text-red-500">검색 중 오류가 발생했습니다.</div>';
        }
    });

    btnReselect.addEventListener('click', () => {
        currentSelectedPlace = null;
        selectedPlaceContainer.classList.add('hidden');
        searchInput.parentElement.parentElement.classList.remove('hidden');
        searchInput.value = '';
        searchResults.classList.add('hidden');
    });

    // 등록 처리
    const btnSubmit = document.getElementById('btn-submit-report');
    btnSubmit.addEventListener('click', async () => {
        if (!currentSelectedPlace) return alert("장소를 검색하고 선택해주세요.");
        
        const categoryInput = document.querySelector('input[name="report-category"]:checked');
        if (!categoryInput) return alert("카테고리를 선택해주세요.");

        // 기타 선택 시 사용자 입력값 처리
        let categoryValue = categoryInput.value;
        let customCategoryName = null;
        if (categoryValue === 'etc') {
            const etcText = document.getElementById('etc-category-input').value.trim();
            if (etcText) {
                customCategoryName = etcText; // 표시 이름으로 활용
            }
        }

        const memo = document.getElementById('report-memo').value.trim();

        // 등록 버튼 로딩 상태
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<iconify-icon icon="line-md:loading-twotone-loop" class="text-xl"></iconify-icon> 등록 중...';
        btnSubmit.disabled = true;

        const tipData = {
            placeName: currentSelectedPlace.placeName,
            address: currentSelectedPlace.address,
            lat: currentSelectedPlace.lat,
            lng: currentSelectedPlace.lng,
            category: categoryValue,
            customCategory: customCategoryName || null,
            memo: memo,
            reporterNick: window.VoiceManager ? "WIKI 사용자" : "익명 사용자"
        };
        console.log('[addTip] 저장할 tipData:', tipData);

        const docId = await window.DataService.addTip(tipData);
        
        if (docId) {
            alert("동네꿀팁이 제보되었습니다! 🪙");
            closeModal();
            // 폼 초기화
            btnReselect.click();
            if(categoryInput) categoryInput.checked = false;
            document.getElementById('report-memo').value = '';
            document.getElementById('etc-category-input').value = '';
            document.getElementById('etc-category-input-wrap').classList.add('hidden');
            
            // 마커 다시 그리기
            const tips = await window.DataService.getTips();
            renderMarkers(tips);
        } else {
            alert("제보 등록에 실패했습니다. 다시 시도해주세요.");
        }

        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;
    });
}
