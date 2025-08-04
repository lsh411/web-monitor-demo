const http = require('http');

const API_BASE = 'http://ec2-52-78-169-124.ap-northeast-2.compute.amazonaws.com:8080';
const PROXY_PORT = 3002; // 다른 포트 사용

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // API 요청 프록시
  const options = {
    hostname: 'ec2-52-78-169-124.ap-northeast-2.compute.amazonaws.com',
    port: 8080,
    path: req.url,
    method: req.method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    console.log(`[${new Date().toISOString()}] Response: ${proxyRes.statusCode}`);
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  });
  
  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
  console.log(`✅ 프록시 서버가 포트 ${PROXY_PORT}에서 실행 중입니다.`);
  console.log(`📡 http://localhost:${PROXY_PORT} → ${API_BASE}`);
}); 