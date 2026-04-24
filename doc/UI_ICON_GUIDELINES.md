# AiTomo 프로젝트 UI 및 아이콘 작업 지침

본 문서는 AiTomo 애플리케이션 내의 UI 일관성을 유지하기 위해 작성된 디자인 가이드라인입니다. 모든 개발자 및 AI 어시스턴트는 새로운 기능 추가, UI 수정, 카테고리 확장을 진행할 때 본 지침을 엄격히 준수해야 합니다.

## 1. 아이콘 및 이모티콘 사용 지침

### 🚫 기본 이모지(Emoji) 사용 금지
과거 카테고리 표시 및 지도 마커 렌더링에 사용되었던 시스템 이모지(예: 📌, 🛝, 🍽️ 등)의 사용을 **전면 금지**합니다. 
OS 및 브라우저 환경에 따라 이모지의 렌더링 형태, 크기, 색상이 달라져 플랫폼 간 UI 파편화가 발생하기 때문입니다. (사용자 글로벌 룰: "의미없는 이모지 형태는 사용하지 말고 필요할 때는 구글 이모지를 활용해서 심플하게만 사용. 아이콘 기반으로 전체 지침화")

### ✅ Iconify (Solar Icons) 통일
모든 아이콘은 **Iconify의 `solar` 아이콘 세트**를 기반으로 작성해야 합니다.
DOM 요소 내에 `<iconify-icon icon="..."></iconify-icon>` 형태로 명시하여 사용합니다.

- **라인 스타일 (Linear)**: 텍스트 탭, 필터 버튼, 리스트 등 정보와 함께 배치되는 일반적인 아이콘
  - 예시: `solar:trees-linear`, `solar:hospital-linear`, `solar:chef-hat-linear`
- **채워진 스타일 (Bold/Duotone)**: 맵 마커(Marker) 내부, 강조 뱃지 등 시각적으로 또렷하게 보여야 하는 오브젝트 내부 아이콘
  - 예시: `solar:trees-bold`, `solar:hospital-bold`, `solar:chef-hat-bold`, `solar:map-point-bold`

---

## 2. 동네꿀팁 카테고리 지정 규약

카테고리는 추가/수정 시 반드시 아래 속성 객체 규약을 따릅니다. (`js/dongnae.js` 참고)

```javascript
// 올바른 예시: emoji 대신 icon 속성을 사용하여 iconify-icon과 매핑
const categoryStyles = {
    'playground': { color: '#5BA85B', name: '아기놀이터', icon: 'solar:trees-bold' },
    'hospital':   { color: '#E05555', name: '병원', icon: 'solar:hospital-bold' },
    'restaurant': { color: '#E87D3E', name: '맛집', icon: 'solar:chef-hat-bold' },
    'beauty':     { color: '#D97DB0', name: '미용', icon: 'solar:star-bold' },
    'etc':        { color: '#9E9E9E', name: '기타', icon: 'solar:map-point-bold' }
};
```

---

## 3. 코드 작성 가이드

- **마커 내 아이콘 렌더링**: 지도 마커와 같이 동적으로 생성되는 HTML 템플릿에서도 `span` 태그와 이모지를 혼용하지 말고 반드시 `<iconify-icon>` 태그를 사용하십시오.
- **클래스 기반 스타일링**: Tailwind CSS 클래스를 활용하여 크기와 색상을 지정합니다. 
  - 크기 예시: `text-sm`, `text-[16px]`, `text-2xl` 등
  - 색상 예시: `text-white`, `text-[#5BA85B]` 등

본 지침 파일은 이후 프론트엔드 작업에 지속적인 기준 역할을 수행합니다. 관련 컴포넌트 추가 및 디자인 개선 시 항시 참고 바랍니다.
