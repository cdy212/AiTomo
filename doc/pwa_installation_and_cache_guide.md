# PWA 설치 유도 및 서비스 워커(Service Worker) 캐시 최적화 가이드

본 문서는 `aiTomo` 프로젝트 진행 중 발생한 PWA(Progressive Web App) 설치 유도 로직과, 로컬 개발/업데이트 시 발생하는 서비스 워커의 강력한 캐시 문제를 해결하기 위한 범용적인 아키텍처를 정리한 것입니다.

## 1. PWA 설치 팝업 제어 (beforeinstallprompt)
웹앱을 네이티브 앱처럼 바탕화면에 설치하도록 유도하는 기능은 모바일 UX에서 매우 중요합니다.

### 핵심 구현 로직
- 브라우저가 PWA 설치 조건을 만족하면 `beforeinstallprompt` 이벤트를 발생시킵니다.
- 이 이벤트를 기본 동작(`e.preventDefault()`)으로 막은 뒤, `deferredPrompt` 변수에 저장합니다.
- 우리가 직접 디자인한 UI(플로팅 팝업, 헤더 설치 버튼 등)를 노출합니다.
- 사용자가 "설치하기" 버튼을 눌렀을 때 `deferredPrompt.prompt()`를 호출하여 브라우저 네이티브 설치 창을 띄웁니다.

### 사용자 피로도 관리
팝업을 계속 띄우면 사용자 경험(UX)을 해칠 수 있으므로, '닫기' 버튼을 클릭하면 `localStorage`에 현재 시간(밀리초)을 저장하고 **24시간 동안은 팝업을 띄우지 않도록(하루 동안 보이지 않기)** 설정하는 것이 중요합니다.

---

## 2. Service Worker 캐시 정책 전환 (Cache-First -> Network-First)
PWA를 위해 `sw.js`를 등록하면, 기본적으로 **Cache-First(캐시 우선)** 전략이 사용되는 경우가 많습니다. 이는 오프라인 지원에는 좋지만, **"수정 사항이 배포되어도 사용자가 새로고침 시 이전 화면을 보는 문제(캐시비움 현상)"**의 주범입니다.

### 해결 방안: Network-First 전략 적용
HTML 뷰 파일이나 잦은 업데이트가 발생하는 리소스는 **Network-First(네트워크 우선)** 전략으로 전환해야 합니다.

```javascript
self.addEventListener('fetch', event => {
  // GET 요청 및 자사 도메인 요청만 가로챔
  event.respondWith(
    fetch(event.request).then(response => {
      // 1. 네트워크 연결 성공 시: 최신 데이터를 가져와서 캐시에 업데이트(put) 후 반환
      if (response && response.status === 200) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
      }
      return response;
    }).catch(() => {
      // 2. 오프라인이거나 네트워크 실패 시: 캐시된 응답 반환
      return caches.match(event.request);
    })
  );
});
```

### 캐시 버전 관리 및 초기화 (`activate` 이벤트)
업데이트를 강제해야 할 때는 `CACHE_NAME` 버전을 올리고(`v1 -> v2`), 이전 버전 캐시를 모두 지우는 로직을 `activate` 단계에 넣어야 즉시 적용됩니다.

---

## 3. 동적 HTML 컴포넌트 내 스크립트 실행 버그 (loadComponent)
`fetch`를 통해 `components/nav.html` 등의 공통 헤더를 불러올 때, `innerHTML`로 HTML을 삽입하면 브라우저 보안 정책상 내부의 `<script>` 태그가 실행되지 않습니다. (이로 인해 번역 매니저나 이벤트 리스너가 작동하지 않는 버그 발생)

### 해결 방안 (스크립트 강제 재파싱)
```javascript
async function loadComponent(id, url) {
    const response = await fetch(url);
    document.getElementById(id).innerHTML = await response.text();
    
    // 삽입된 스크립트 태그를 찾아서 새로 생성 후 교체 (강제 실행)
    Array.from(document.getElementById(id).querySelectorAll('script')).forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}
```
이 방식은 향후 어떤 프로젝트에서 바닐라 JS(Vanilla JS)로 컴포넌트를 분리할 때 반드시 포함되어야 할 필수 아키텍처입니다.
