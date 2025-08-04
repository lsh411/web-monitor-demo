const http = require('http');
const https = require('https');

const API_BASE_URL = 'http://ec2-52-78-169-124.ap-northeast-2.compute.amazonaws.com:8080';
const PROXY_PORT = 3001;

const server = http.createServer((req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리 (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API 요청 프록시
  const apiUrl = API_BASE_URL + req.url;
  console.log(`Proxying request to: ${apiUrl}`);

  const options = {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...req.headers
    }
  };

  // 실제 API로 요청 전달
  const proxyReq = http.request(apiUrl, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Proxy server error' }));
  });

  // 요청 본문 전달
  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
  console.log(`🚀 프록시 서버가 포트 ${PROXY_PORT}에서 실행 중입니다.`);
  console.log(`📡 API 요청을 ${API_BASE_URL}로 전달합니다.`);
  console.log(`\n사용법: http://localhost:${PROXY_PORT}를 API 엔드포인트로 사용하세요.`);
}); 