# 커피라운지 DEV 개발 플랜 (0_qna_dev.html)

> 파일: `0_qna_dev.html`  
> 원본 보존: `0_qna.html` (수정 금지)  
> DataService: `js/dataService.js` (Firebase + LocalStorage Fallback)

---

## 전체 단계 개요

| Step | 내용 | 상태 |
|------|------|------|
| 1 | 글쓰기 (마이크/텍스트/이미지/카테고리/익명·로그인) | 완료 |
| 1-b | DataService 연동 (Firebase 저장, 새로고침 유지) | 완료 |
| 2 | 실시간 피드 + 본인 글 수정·삭제 | 완료 |
| 3 | 공감 / 답변 남기기 (다른 사람) | 완료 |
| 4 | 답변 입력창 (인라인 슬라이드다운) | Step 3에 통합 완료 |
| 5 | 시간 표시 (1시간/3시간/6시간/12시간/하루/이틀...) | 완료 (선적용) |

---

## Step 1 — 글쓰기 기능 (완료: 2026-04-22)

### 구현 항목
- [x] 하단 고정 입력바 (마이크 + 텍스트 + 이미지 + 전송)
- [x] Web Speech API 한국어 음성 인식 (녹음 중 빨간 펄스 표시)
- [x] 이미지 첨부 (최대 3장, 미리보기 + X 제거)
- [x] 카테고리 바텀시트 (9개 카테고리)
- [x] 익명 / 로그인 상태 분기 (아바타 색상, 이름 반영)
- [x] 더미 데이터 2개 (원본 디자인 동일)
- [x] 시간 표시 포맷 (Step 5 형식 선적용)

### 미완 (다음 PR에 반영)
- [ ] DataService 연동 → 새로고침 후에도 데이터 유지 **(현재 작업 중)**

---

## Step 1-b — DataService 연동 (진행 중: 2026-04-22)

### 작업 내용
- `dataService.js`를 `type="module"`로 로드하고 `DataServiceReady` 이벤트 수신
- `addPost()` → Firestore `coffeeLounge` 컬렉션에 글 저장
- `getPosts()` → 페이지 로드 시 최신 20개 불러오기
- 이미지: Base64 dataUrl을 Firestore 문서에 `images[]` 배열로 저장
- Fallback: Firebase 연결 실패 시 LocalStorage에 자동 저장

### DataService API 매핑
| 기능 | 메서드 | 상태 |
|------|--------|------|
| 목록 조회 | `DataService.getPosts('coffeeLounge')` | 완료 |
| 글 등록 | `DataService.addPost('coffeeLounge', data)` | 완료 |
| 글 수정 | `DataService.updatePost('coffeeLounge', id, data)` | 완료 |
| 글 삭제 | `DataService.deletePost('coffeeLounge', id)` | 완료 |
| 공감 | `DataService.likePost('coffeeLounge', id)` | 완료 |
| 답변 조회 | `DataService.getReplies('coffeeLounge', id)` | 완료 |
| 답변 등록 | `DataService.addReply('coffeeLounge', id, data)` | 완료 |

---

## Step 2 — 실시간 피드 + 수정·삭제 (예정)

- 글 등록 후 피드 상단에 즉시 추가 (애니메이션)
- 본인 글에만 수정/삭제 버튼 노출
- 수정: 인라인 텍스트 편집 모드
- 삭제: 확인 후 Firestore에서 제거 + 피드에서 즉시 제거

---

## Step 3 — 공감 / 답변 남기기 (예정)

- 내 글이 아닌 경우: 공감(하트) + 답변 남기기 버튼 노출
- 공감: 중복 불가 (localStorage로 이미 누른 여부 추적)
- 답변 수: 서브컬렉션 replies 개수 표시

---

## Step 4 — 답변 입력창 인라인 (예정)

- "답변 남기기" 클릭 시 해당 글 아래 슬라이드다운 입력창 표시
- 마이크 + 텍스트 + 이미지 지원 (하단 입력바와 동일 UX)
- 등록 시 replies 서브컬렉션에 저장 + 즉시 화면에 추가

---

## Step 5 — 시간 표시 단위 (예정)

| 경과 시간 | 표시 |
|-----------|------|
| 1분 미만 | 방금 전 |
| 1~59분 | N분 전 |
| 1~2시간 | 1시간 전 |
| 3~5시간 | 3시간 전 |
| 6~11시간 | 6시간 전 |
| 12~23시간 | 12시간 전 |
| 1~1.9일 | 하루 전 |
| 2~2.9일 | 이틀 전 |
| 3일 이상 | N일 전 |
