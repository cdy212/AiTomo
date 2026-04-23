# 네이버 지도 API 연동 및 트러블슈팅 가이드 (동네꿀팁)

## 개요
이 문서는 '동네꿀팁' 서비스 구현 과정에서 겪었던 네이버 지도(Map) 및 지역 검색(Local Search) API 연동 관련 주요 이슈, 해결 방법(Troubleshooting), 그리고 비즈니스 및 인프라 설정 노하우를 정리한 문서입니다. 향후 유사한 지도 기반 서비스를 기획하거나 설계할 때 참고 자료로 활용합니다.

---

## 1. 인프라 및 보안 설정 가이드

### 1-1. API 키 분리 및 관리 (중요)
네이버 클라우드 플랫폼(지도)과 네이버 개발자 센터(검색)는 발급 주체와 인증 방식이 다릅니다. 이 둘을 혼동하면 인증 에러(Error 200, Invalid Auth 등)가 발생합니다.

- **네이버 지도 API (Client-side):** 
  - `dongnae.html`에서 브라우저가 직접 로드합니다. (`ncpClientId` 사용)
  - **보안:** 웹 서비스 URL(예: `localhost:8000`, 운영 도메인)을 네이버 클라우드 콘솔에 정확히 등록해야만 CORS 및 인증 에러를 방지할 수 있습니다.
- **네이버 지역 검색 API (Server-side):**
  - 클라이언트 스크립트에 `Client Secret`을 노출하면 절대 안 됩니다.
  - **인프라 해결책:** Cloudflare Worker를 Proxy 서버로 세팅하여 브라우저의 요청을 중계합니다. Worker의 환경변수에 발급받은 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 안전하게 보관합니다.

### 1-2. Cloudflare Worker 기반 Proxy 통신
프론트엔드 환경에서 외부 검색 API를 찌르면 발생하는 CORS(교차 출처 리소스 공유) 에러를 방어하기 위해 Worker를 사용합니다.
- 사용자는 `https://[워커주소]/?query=검색어` 로 요청만 보내고, 워커가 실제 네이버 서버와 통신 후 JSON을 브라우저에 내려주는 브릿지 역할을 수행합니다.

---

## 2. 주요 트러블슈팅 (Troubleshooting) 내역

### 2-1. [이슈] 검색 결과 좌표가 지도에 비정상적으로 찍히는 현상
- **상황:** 네이버 지역 검색 API에서 반환하는 `mapx`, `mapy` 값을 그대로 `new naver.maps.LatLng(lat, lng)` 에 넣었더니 마커가 엉뚱한 곳에 찍힘.
- **원인 분석:** 
  - 처음에는 반환된 값이 `TM128 (KATECH)` 좌표계라 판단하여 `naver.maps.TransCoord.fromTM128ToLatLng` 함수(geocoder 서브모듈)를 동원하려 했으나 제대로 동작하지 않음.
  - 공식 문서 재확인 결과, 네이버 Local Search API의 응답 좌표는 TM128이 아니라 **WGS84 위경도 좌표의 소수점 표현을 없애기 위해 10^7 (10,000,000)을 곱한 정수값**임이 밝혀짐.
- **해결 방안 (코드 노하우):**
  - 불필요한 `geocoder` 서브모듈 로드를 제거하여 페이지 로딩 속도를 개선.
  - 반환된 정수값을 단순히 `1e7`로 나누어 정확한 위경도로 변환.
  ```javascript
  const lng = parseInt(item.mapx, 10) / 1e7;
  const lat = parseInt(item.mapy, 10) / 1e7;
  ```

### 2-2. [이슈] 지도 마커 렌더링 시 TypeError 발생 및 렌더링 중지
- **상황:** `renderMarkers` 함수 실행 중 `marker.setMap is not a function` 에러가 뜨면서 지도에 아무것도 나타나지 않음.
- **원인 분석:** 
  - 랭킹 리스트 클릭 시 해당 마커의 InfoWindow를 열어주기 위해 기존에 순수 마커 인스턴스 배열(`[marker, marker, ...]`)이었던 `currentMarkers`를 객체 배열(`[{marker, infoWindow, tip}, ...]`)로 구조 변경함.
  - 그러나 초기화 로직인 `currentMarkers.forEach(marker => marker.setMap(null))` 부분을 미처 수정하지 않아 객체 껍데기에 함수를 호출하려다 에러 발생.
- **해결 방안:** 배열 순회 로직을 객체 속성 접근 방식(`m.marker.setMap(null)`)으로 수정하여 해결. (구조체 변경 시 파급 효과 체크 필수)

### 2-3. [이슈] 익명 사용자의 제보 수정/삭제 권한 통제
- **상황:** 로그인 기능이 없는 익명 게시판 형태이므로, Firebase Security Rules의 기본 `auth.uid` 방식을 적용할 수 없어 누구나 남의 글을 수정/삭제할 수 있는 보안 취약점 발생.
- **비즈니스 & 인프라 해결책 (Device Fingerprint):**
  1. 클라이언트가 글을 작성할 때 난수화된 **`authorToken`**을 자동 생성.
  2. Firestore 문서 필드에 해당 토큰을 저장함과 동시에, 작성자의 브라우저 `localStorage`에 `{ 문서ID : authorToken }` 구조로 로컬 캐싱.
  3. 클라이언트 화면 렌더링 시, `localStorage`에 해당 문서의 토큰이 있는 사람에게만 [수정/삭제] 버튼 노출.
  4. 삭제/수정 요청 시 해당 토큰을 함께 서버로 전송. (완벽한 보안을 원할 경우 Firestore Rules에서 `resource.data.authorToken == request.resource.data.authorToken` 조건 추가).

---

## 3. 요약 및 시사점
- 외부 Map API와 Search API 연동 시 응답 좌표계 명세(1e7 곱연산 여부 등)를 가장 먼저 확정 지을 것.
- 프론트엔드 Only 프로젝트에서 Key 보호와 CORS 해결은 Serverless Proxy (CF Worker)가 가장 빠르고 저렴한 해답.
- 인증없는 서비스라도 `localStorage`와 고유 난수 토큰 발행 조합을 통해 기초적인 '본인 소유권'을 부여하고 UI를 분기할 수 있음.
