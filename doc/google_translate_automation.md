# 구글 웹사이트 번역기(Google Translate Widget) 완전 자동화 및 숨김 처리 가이드

본 문서는 `aiTomo` 프로젝트에서 사용된 구글 번역기 자동화 기법을 정리한 것입니다. 이 로직은 API 키 발급이나 비용 없이 프론트엔드 레벨에서 모든 화면을 다국어(한국어/일본어 등)로 자동 번역할 때 매우 유용하게 재사용할 수 있습니다.

## 1. 개요 및 핵심 개념
구글 웹사이트 번역기(Google Website Translator)는 보통 화면에 위젯(Select 박스)을 노출시켜 사용자가 언어를 선택하게 합니다. 그러나 UI의 일관성을 위해 위젯과 번역 평가 팝업(풍선)을 완벽히 숨기고, 우리가 만든 커스텀 버튼으로 이 위젯을 "원격 제어(Headless Control)"하는 것이 이 아키텍처의 핵심입니다.

## 2. 작동 원리
1. **위젯 주입**: `js/translateManager.js`가 구글 번역기 스크립트를 동적으로 로드합니다.
2. **UI 강제 숨김**: CSS(`!important` 남용)를 활용하여 구글이 생성하는 모든 프레임, 팝업, 툴팁을 강제로 가립니다.
3. **Headless Control**: 커스텀 버튼(예: `KR | JP` 토글 버튼) 클릭 시 자바스크립트가 숨겨진 구글 번역기의 `<select class="goog-te-combo">` 요소를 찾아서 값을 바꾸고 `change` 이벤트를 강제로 발생시킵니다.
4. **상태 동기화**: `localStorage`를 이용해 마지막 선택 언어를 기억하고, 다른 페이지로 이동해도 즉시 번역을 수행합니다.

## 3. 핵심 코드 구현

### A. CSS 강제 숨김 처리 (translateManager.js 내 동적 주입)
구글 번역기는 최상단에 `body`의 `top` 속성을 변형시키는 배너를 띄우고, 마우스 오버 시 툴팁(`goog-tooltip`)을 보여줍니다. 이를 완벽히 차단해야 합니다.
```css
/* 번역기 위젯 셀렉트 박스 숨김 */
.goog-te-banner-frame.skiptranslate, 
#google_translate_element { display: none !important; }

/* 구글 툴팁 및 평가 풍선 숨김 */
.goog-tooltip,
.goog-tooltip:hover { display: none !important; }
.goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }

/* 원본 텍스트 말풍선 및 우측 하단 팝업 완벽 차단 */
#goog-gt-tt, .goog-te-balloon-frame { display: none !important; opacity: 0 !important; visibility: hidden !important; width: 0 !important; height: 0 !important; }

/* 레이아웃 밀림 방지 */
body { top: 0px !important; position: static !important; }
```

### B. JavaScript 강제 번역 트리거 (Headless Control)
숨겨진 구글 `select` 엘리먼트를 제어하는 함수입니다.
```javascript
doGoogleTranslate(targetLangCode) {
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return; // 아직 로드되지 않은 경우 재시도 로직 필요

    // 현재 구글 번역기에 선택된 값과 목표 언어가 다를 경우에만 실행
    if (combo.value !== targetLangCode) {
        combo.value = targetLangCode;
        // 구글 번역기는 'change' 이벤트를 감지하여 번역을 수행하므로 수동 트리거
        combo.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }
}
```

## 4. 모듈(translateManager.js) 사용 방법
다른 프로젝트에서 이 모듈을 사용할 때는 아래와 같이 호출하면 됩니다.

```javascript
// 1. 모듈 로드 및 초기화
const script = document.createElement('script');
script.src = 'js/translateManager.js';
script.onload = () => {
    // 2. 현재 설정된 언어 가져오기
    const currentLang = window.TranslateManager.getLang();

    // 3. 언어 토글 실행 (ko -> ja, ja -> ko)
    const newLang = window.TranslateManager.toggleLang();
};
document.head.appendChild(script);

// 4. 상태 변경 이벤트 리스닝 (UI 업데이트 용)
window.addEventListener('aitomo_lang_changed', (e) => {
    console.log("변경된 언어:", e.detail); // 'ko' or 'ja'
});
```

## 5. 한계점 및 주의사항
1. **로딩 지연**: 구글 스크립트 비동기 로딩 탓에 최초 1~2초간 번역되지 않은 원본 텍스트가 노출될 수 있습니다. (Preloader로 가리는 것 권장)
2. **이벤트 리스너 오작동**: 리액트(React)나 뷰(Vue) 같은 SPA 프레임워크에서는 DOM 요소가 재생성되므로 번역이 풀리거나 이벤트가 꼬일 수 있습니다. 바닐라 JS 프로젝트나 정적 페이지에 가장 적합합니다.
3. **구글 정책**: 구글 번역기 위젯은 공식적으로 서비스 지원이 중단(Deprecated)된 상태지만 여전히 작동합니다. 향후 완전히 차단될 경우 Google Cloud Translation API로 마이그레이션 해야 합니다.
