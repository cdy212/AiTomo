/**
 * Cloudflare Worker Proxy for Naver Search APIs
 * 
 * [라우팅 규칙]
 * - 기본 요청 (?query=...) → 네이버 지역(Local) 검색 API
 * - /image 경로 (?query=...) → 네이버 이미지 검색 API (Edge Cache 30일 캐싱)
 * 
 * [Edge Cache 전략]
 * - 이미지 검색 결과는 자주 변하지 않으므로 Cloudflare Edge Cache에 30일간 캐싱합니다.
 * - Cache Hit 시 네이버 API를 전혀 호출하지 않아 일일 쿼터(25,000회) 소모를 극단적으로 줄입니다.
 * - Firestore 등 DB에 저장하지 않으므로 DB 비용 0원을 유지합니다.
 */

export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        const url = new URL(request.url);
        const pathname = url.pathname;

        // ──────────────────────────────────────────────
        // 라우팅: /image → 네이버 이미지 검색 (Edge Cache 적용)
        // ──────────────────────────────────────────────
        if (pathname.endsWith('/image')) {
            return handleImageSearch(request, env, ctx, url);
        }

        // ──────────────────────────────────────────────
        // 라우팅: 기본 → 네이버 지역(Local) 검색 (기존 로직)
        // ──────────────────────────────────────────────
        return handleLocalSearch(request, env, url);
    }
};

// 지역 검색 핸들러 (기존)
async function handleLocalSearch(request, env, url) {
    try {
        const query = url.searchParams.get("query");
        if (!query) {
            return new Response(JSON.stringify({ error: "Query parameter is required" }), {
                status: 400,
                headers: corsHeaders()
            });
        }

        const targetUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;
        const response = await fetch(targetUrl, {
            headers: {
                "X-Naver-Client-Id": "jdwOgvTVMLsFKO5vNAIL",
                "X-Naver-Client-Secret": "9eIvR1eNB9"
            }
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: corsHeaders()
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), {
            status: 500,
            headers: corsHeaders()
        });
    }
}

// 이미지 검색 핸들러 (Edge Cache 30일)
async function handleImageSearch(request, env, ctx, url) {
    try {
        const query = url.searchParams.get("query");
        if (!query) {
            return new Response(JSON.stringify({ error: "Query parameter is required" }), {
                status: 400,
                headers: corsHeaders()
            });
        }

        // Edge Cache 키: 쿼리 파라미터 기반으로 고유하게 생성
        const cacheKey = new Request(`https://cache.aitomo-navermap/image?query=${encodeURIComponent(query)}`);
        const cache = caches.default;

        // 1. Edge Cache 확인 (Cache Hit)
        let cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            const body = await cachedResponse.json();
            return new Response(JSON.stringify(body), { headers: corsHeaders() });
        }

        // 2. Cache Miss: 네이버 이미지 검색 API 실제 호출 (최대 10장)
        const targetUrl = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=10&sort=sim`;
        const apiResponse = await fetch(targetUrl, {
            headers: {
                "X-Naver-Client-Id": "jdwOgvTVMLsFKO5vNAIL",
                "X-Naver-Client-Secret": "9eIvR1eNB9"
            }
        });

        const data = await apiResponse.json();

        // 3. Edge Cache에 30일 저장 (ctx.waitUntil로 비동기 처리 → 응답 속도에 영향 없음)
        const responseToCache = new Response(JSON.stringify(data), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=2592000" // 30일
            }
        });
        ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

        return new Response(JSON.stringify(data), {
            status: apiResponse.status,
            headers: corsHeaders()
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: "Image search failed", details: err.message }), {
            status: 500,
            headers: corsHeaders()
        });
    }
}

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    };
}
