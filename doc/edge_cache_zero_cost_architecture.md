# Cloudflare Edge Cache를 활용한 외부 API 비용 제로화 (Zero-Cost Optimization)

## 개요
이 문서는 외부 서드파티 API(예: 네이버 검색 API 등)를 호출할 때 발생하는 **호출 쿼터(Quota) 한도 초과 문제**와 데이터베이스에 그 결과를 캐싱할 때 발생하는 **Write 및 Storage 비용 문제**를 동시에 해결하기 위한 **범용 아키텍처 노하우**입니다. 다른 프로젝트 설계 시에도 본 아키텍처를 우선적으로 검토하여 인프라 비용을 최소화합니다.

## 1. 기존 방식의 한계

### 1-1. 매번 실시간으로 API 호출 시 (No Cache)
- 사용자가 접속할 때마다 외부 API를 호출하면, 트래픽 스파이크 시 외부 API의 일일 제공 한도를 순식간에 초과하여 서비스 장애(Error)를 유발합니다.
- 외부 API 서버를 거치므로 클라이언트 응답 속도(Latency)가 저하됩니다.

### 1-2. DB에 캐싱할 시 (DB Cache)
- API 응답 결과를 자체 DB(예: Firestore)에 저장해두고 꺼내 쓰는 방법은 흔히 사용됩니다.
- 하지만 Firebase/Firestore 같은 서버리스 NoSQL 환경에서는 데이터를 저장할 때 발생하는 **문서 쓰기(Document Write) 비용**과 누적되는 **스토리지 비용**이 발생합니다.
- 데이터가 방대해질수록 유지비용 상승의 원인이 됩니다.

---

## 2. 해결 아키텍처: Cloudflare Edge Cache + Proxy Worker

위 두 가지 문제를 완벽하게 해결하기 위해 **Cloudflare Worker**를 프록시로 세우고, 내장된 **Edge Cache API (`caches.default`)**를 사용하는 전략입니다.

### 2-1. 아키텍처 다이어그램 및 플로우

1. **Client Request:** 
   클라이언트(브라우저)는 서드파티 API에 직접 접근하지 않고, 우리의 Cloudflare Worker 엔드포인트(예: `/api/search`)로 요청을 보냅니다.
2. **Edge Cache 검사 (Cache Hit/Miss):** 
   워커 스크립트는 `caches.default.match(request)` 함수를 통해 사용자와 가장 가까운 엣지(Edge) 노드에 이미 캐시된 응답이 있는지 확인합니다.
3. **Cache Miss (데이터 없음) -> 외부 API 호출 1회:** 
   캐시가 없다면 워커가 서드파티 API를 1회 호출하여 데이터를 가져옵니다. 
   가져온 응답 객체에 강력한 `Cache-Control` 헤더(예: `public, max-age=2592000` // 30일)를 덮어씌워 Edge 노드에 저장(Cache Put)한 뒤 클라이언트에 반환합니다.
4. **Cache Hit (데이터 있음) -> 비용 0원, 속도 MAX:** 
   이후 한 달 동안 전 세계 어떤 사용자가 동일한 요청을 하더라도 워커는 서드파티 API를 호출하지 않고 엣지에 저장된 JSON/데이터를 빛의 속도로 즉각 반환합니다.

### 2-2. 주요 장점
- **비용 0원:** Cloudflare Worker의 기본 캐싱 기능을 사용하므로 자체 DB 비용이 전혀 들지 않으며, 워커 무료 할당량(일 10만 건) 내에서 완벽히 무료로 처리 가능합니다.
- **외부 API 쿼터 절대 방어:** 캐시 유지 기간 동안 외부 API를 절대 다시 호출하지 않으므로, 호출 횟수를 1/1000 수준으로 낮출 수 있습니다.
- **초고속 응답:** 데이터가 지리적으로 가까운 CDN 엣지에서 바로 서빙되므로 Latency가 획기적으로 단축됩니다.

---

## 3. 적용 가이드 (Worker 예시 코드)

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    // 1. Edge 캐시 확인
    let response = await cache.match(cacheKey);

    if (!response) {
      // 2. Cache Miss: 외부 API 실제 호출
      const targetApiUrl = `https://openapi.naver.com/v1/search/image${url.search}`;
      
      const apiResponse = await fetch(targetApiUrl, {
        headers: {
          'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET
        }
      });

      // 3. 응답 복사 후 Cache-Control 헤더 주입
      response = new Response(apiResponse.body, apiResponse);
      response.headers.set('Cache-Control', 'public, max-age=2592000'); // 30일 유지

      // 4. 비동기로 캐시에 저장 (ctx.waitUntil 사용)
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    // Cache Hit 시 바로 반환
    return response;
  }
};
```

## 4. 적용 기준 및 범용성
이 전략은 다음 조건에 해당하는 기능을 설계할 때 **반드시 최우선으로 검토**해야 합니다.
- 응답 데이터가 실시간으로 변하지 않고 정적/반정적인 경우 (예: 장소의 썸네일 이미지, 뉴스 요약본, 메뉴판 데이터 등)
- 데이터베이스에 저장하기에는 단순 읽기(Read) 비중이 압도적으로 높고 쓰기(Write) 가치가 떨어지는 데이터
- 호출 당 과금이 발생하거나 무료 쿼터 제한이 빡빡한 외부 API 연동 시
