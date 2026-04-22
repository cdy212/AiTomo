/**
 * Cloudflare Worker Proxy for Naver Local Search API
 * 
 * 목적: 프론트엔드 브라우저에서 네이버 Local Search API를 직접 호출할 때 발생하는 CORS 에러 우회 및 
 * 네이버 API Key(Client ID, Secret)를 서버 환경변수에 숨겨 보안을 유지하기 위함.
 * 
 * 설정 방법 (wrangler):
 * 1. 환경변수 등록:
 *    wrangler secret put NAVER_CLIENT_ID
 *    wrangler secret put NAVER_CLIENT_SECRET
 * 2. 배포:
 *    wrangler deploy
 */

export default {
    async fetch(request, env) {
      // CORS 처리를 위한 OPTIONS 요청 사전 대응
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
  
      try {
        const url = new URL(request.url);
        const query = url.searchParams.get("query");
  
        if (!query) {
          return new Response(JSON.stringify({ error: "Query parameter is required" }), {
            status: 400,
            headers: corsHeaders()
          });
        }
  
        // 네이버 지역 검색 API URL 구성 (최대 5개 조회)
        const targetUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;
  
        // 네이버 API 요청 (환경변수에서 키 주입)
        const response = await fetch(targetUrl, {
          headers: {
            "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
            "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET
          }
        });
  
        const data = await response.json();
  
        // 응답 반환
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
  };
  
  function corsHeaders() {
    return {
      "Access-Control-Allow-Origin": "*", // 실제 운영 환경에서는 허용할 도메인(예: https://aitomo.pages.dev)으로 제한 권장
      "Content-Type": "application/json"
    };
  }
