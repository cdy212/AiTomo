// js/dongnae.js
// 동네꿀팁 지도 렌더링 및 마커 제어 스크립트

let map = null;
let currentMarkers = [];
let currentInfoWindow = null;
let categoryFilters = 'all';

// 카테고리별 마커 색상 및 아이콘 매핑
const categoryStyles = {
    'playground': { color: '#5BA85B', name: '놀이터' },
    'pool': { color: '#3B9ECC', name: '수영장/키즈풀' },
    'hospital': { color: '#E05555', name: '병원/소아과' },
    'daycare': { color: '#8B6FD6', name: '어린이집' },
    'kindergarten': { color: '#C47FD0', name: '유치원' },
    'restaurant': { color: '#E87D3E', name: '맛집/카페' },
    'beauty': { color: '#D97DB0', name: '미용/피부과' },
    'etc': { color: '#9E9E9E', name: '기타' }
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

// 랭킹 리스트 렌더링
function renderRanking(tips) {
    const listContainer = document.getElementById('ranking-list');
    if (!listContainer) return;
    
    // 좋아요 순 정렬 후 Top 3 추출
    const sortedTips = [...tips].sort((a, b) => b.likes - a.likes).slice(0, 3);
    
    if (sortedTips.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-xs text-textmuted p-2">아직 데이터가 없습니다.</div>';
        return;
    }
    
    listContainer.innerHTML = sortedTips.map((tip, idx) => {
        const style = categoryStyles[tip.category] || categoryStyles['etc'];
        const numColor = idx === 0 ? 'text-accent' : 'text-gray-500';
        return `
            <div class="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-black/5 cursor-pointer hover:bg-gray-100 transition-colors" onclick="moveToMarker(${tip.lat}, ${tip.lng})">
                <div class="flex items-center gap-2">
                    <span class="font-black ${numColor} text-sm w-4 text-center">${idx + 1}</span>
                    <span class="font-bold text-sm text-textmain truncate max-w-[120px]">${tip.placeName}</span>
                </div>
                <div class="flex items-center gap-2 text-xs font-bold text-textmuted">
                    <span class="px-1.5 py-0.5 rounded" style="background-color: ${style.color}15; color: ${style.color}">${style.name.split('/')[0]}</span>
                    <span class="flex items-center gap-0.5 text-accent"><iconify-icon icon="solar:heart-bold"></iconify-icon> ${tip.likes}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 랭킹 항목 클릭 시 해당 마커로 이동하는 헬퍼 함수
window.moveToMarker = function(lat, lng) {
    if (map) {
        map.morph(new naver.maps.LatLng(lat, lng), 16);
    }
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

// 지도 마커 렌더링 함수
function renderMarkers(tips) {
    // 기존 마커 및 인포윈도우 제거
    currentMarkers.forEach(marker => marker.setMap(null));
    currentMarkers = [];
    if(currentInfoWindow) currentInfoWindow.close();

    // 랭킹 동시 업데이트
    renderRanking(tips);

    tips.forEach(tip => {
        // 필터 적용
        if (categoryFilters !== 'all' && tip.category !== categoryFilters) return;

        const style = categoryStyles[tip.category] || categoryStyles['etc'];
        const contentStr = `
            <div class="relative flex flex-col items-center group cursor-pointer transition-transform hover:-translate-y-1 hover:z-50">
                <div class="bg-white px-2 py-1 rounded-full shadow-md border border-[${style.color}] text-[11px] font-bold text-[${style.color}] whitespace-nowrap mb-1">
                    ${tip.placeName}
                </div>
                <div class="w-8 h-8 rounded-full shadow-lg flex items-center justify-center" style="background-color: ${style.color};">
                    <span class="text-white font-bold text-[10px]">${style.name.substring(0, 2)}</span>
                </div>
                <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style="border-top-color: ${style.color};"></div>
            </div>
        `;

        const marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(tip.lat, tip.lng),
            map: map,
            icon: {
                content: contentStr,
                anchor: new naver.maps.Point(16, 46)
            }
        });

        // 마커 클릭 이벤트 - 커스텀 InfoWindow 표시
        naver.maps.Event.addListener(marker, 'click', () => {
            if(currentInfoWindow) currentInfoWindow.close();

            const infoHtml = `
                <div class="bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-black/10 p-4 w-60 transform -translate-y-4">
                    <div class="flex items-start justify-between mb-2">
                        <div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded text-white" style="background-color: ${style.color}">${style.name}</span>
                            <h3 class="font-extrabold text-[15px] text-textmain mt-1.5 break-keep-all">${tip.placeName}</h3>
                        </div>
                    </div>
                    ${tip.memo ? `<div class="text-[12px] font-medium text-textmuted bg-gray-50 p-2.5 rounded-xl mb-3 break-keep-all line-clamp-3 leading-relaxed">${tip.memo}</div>` : ''}
                    <div class="text-[10px] text-textmuted font-bold mb-3 flex items-center gap-1"><iconify-icon icon="solar:user-circle-linear" class="text-sm"></iconify-icon> 제보자: ${tip.reporterNick}</div>
                    
                    <button onclick="window.likeTipHandler('${tip.id}')" class="w-full bg-accent/10 hover:bg-accent text-accent hover:text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors group/btn">
                        <iconify-icon icon="solar:heart-bold" class="text-lg group-active/btn:scale-125 transition-transform"></iconify-icon> 공감 (${tip.likes})
                    </button>
                </div>
            `;

            currentInfoWindow = new naver.maps.InfoWindow({
                content: infoHtml,
                borderWidth: 0,
                backgroundColor: 'transparent',
                disableAnchor: true,
                pixelOffset: new naver.maps.Point(0, -10)
            });

            currentInfoWindow.open(map, marker);
        });

        currentMarkers.push(marker);
    });
}

// 메인 초기화 실행
async function initializeDongnae() {
    try {
        const mapContainer = document.getElementById('map');
        mapContainer.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center bg-wbg text-textmuted gap-3"><div class="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div><span class="font-bold text-sm">현재 위치를 찾는 중...</span></div>';

        // 1. 위치 정보 획득 (실패시 기본 서울 좌표: 시청)
        let center = { lat: 37.5666805, lng: 126.9784147 };
        try {
            center = await fetchCurrentLocation();
        } catch (e) {
            console.warn("위치 정보를 가져올 수 없어 기본 좌표로 설정합니다.", e);
        }

        // 2. 지도 그리기
        mapContainer.innerHTML = ''; // 로딩 스피너 제거
        initMap(center.lat, center.lng);

        // 3. 데이터 로드 및 마커 렌더링
        if (window.DataService) {
            const tips = await window.DataService.getTips();
            renderMarkers(tips);
        }

        // 4. 현재 위치 버튼 이벤트 리스너 등록
        document.getElementById('btn-current-location').addEventListener('click', async () => {
            try {
                const pos = await fetchCurrentLocation();
                map.morph(new naver.maps.LatLng(pos.lat, pos.lng), 15);
            } catch(e) {
                alert("위치 정보를 가져올 수 없습니다.");
            }
        });

    } catch (e) {
        console.error("동네꿀팁 초기화 중 오류:", e);
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

    let currentSelectedPlace = null;

    btnSearch.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) return alert("상호명을 입력해주세요.");

        searchResults.innerHTML = '<div class="p-4 text-center text-sm text-textmuted">검색 중...</div>';
        searchResults.classList.remove('hidden');

        try {
            // 네이버 Local Search API 프록시 호출 (CF Worker)
            // 배포 전 로컬 테스트용 더미 데이터 폴백 적용
            let items = [];
            try {
                // 개발 환경에서는 이 URL이 안먹힐 수 있으므로 try-catch로 감쌈
                const res = await fetch(`https://aitomo-navermap.cdy3088.workers.dev/?query=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    items = data.items || [];
                } else {
                    throw new Error("Proxy error");
                }
            } catch (err) {
                console.warn("API 검색 실패, 테스트용 더미 데이터를 반환합니다.");
                items = [
                    { title: `<b>${query}</b> 본점`, roadAddress: '서울 성동구 왕십리로 123', mapx: '127032145', mapy: '37543210' },
                    { title: `<b>${query}</b> 2호점`, roadAddress: '서울 동대문구 천호대로 456', mapx: '127045678', mapy: '37567890' }
                ];
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
                    
                    // 임시: 현재 지도의 중앙 좌표 사용 (로컬 테스트용)
                    // 실제 상용화시에는 KATECH 좌표 변환 또는 Geocoding API가 필요함
                    const center = map.getCenter();
                    
                    currentSelectedPlace = {
                        placeName: item.title.replace(/<[^>]*>?/gm, ''),
                        address: item.roadAddress || item.address,
                        lat: center.lat(),
                        lng: center.lng()
                    };

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
            category: categoryInput.value,
            memo: memo,
            reporterNick: window.VoiceManager ? "WIKI 사용자" : "익명 사용자"
        };

        const docId = await window.DataService.addTip(tipData);
        
        if (docId) {
            alert("동네꿀팁이 제보되었습니다! 🪙");
            closeModal();
            // 폼 초기화
            btnReselect.click();
            if(categoryInput) categoryInput.checked = false;
            document.getElementById('report-memo').value = '';
            
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
