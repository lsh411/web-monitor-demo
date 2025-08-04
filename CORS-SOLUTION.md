# CORS 문제 해결 가이드

## 문제 상황
브라우저에서 AWS API 서버로 직접 요청할 때 CORS (Cross-Origin Resource Sharing) 에러가 발생합니다.

```
Access to fetch at 'http://ec2-52-78-169-124.ap-northeast-2.compute.amazonaws.com:8080/...' 
from origin 'http://127.0.0.1:8000' has been blocked by CORS policy
```

## 해결 방법: 프록시 서버 사용 (포트 3001)

### 1. Node.js 프록시 서버 실행 (추천) ✅
```bash
# 프록시 서버 실행 (포트 3001)
node simple-proxy.js
```

### 2. Python 프록시 서버 실행 (대안)
```bash
# Python 프록시 서버 (포트 3001 - 현재 사용 안함)
python3 proxy-server.py
```

### 3. 웹 애플리케이션 실행
```bash
# 다른 터미널에서 웹 서버 실행
python -m http.server 8000
```

### 4. 브라우저에서 접속
- 대시보드: http://127.0.0.1:8000/dashboard.html
- 관리기록: http://127.0.0.1:8000/test-local.html
- API 테스트: http://127.0.0.1:8000/test-api-check.html

## 동작 원리

```
브라우저 → localhost:3001 (프록시) → AWS API 서버
         ←                          ←
```

프록시 서버가:
1. 브라우저의 요청을 받아서
2. CORS 헤더를 추가하고
3. 실제 API 서버로 전달
4. 응답을 다시 브라우저로 전달

## 설정 확인

### config.js
```javascript
window.API_CONFIG = {
  BASE_URL: 'http://localhost:3001', // 프록시 서버 URL (포트 3001)
  ENABLE_MOCK_DATA: false, // 실제 API 사용
  // ...
};
```

## 문제 해결

### 1. "Failed to fetch" 에러
- 프록시 서버가 실행 중인지 확인
- `lsof -i :3001` 명령으로 포트 확인 (Node.js 프록시)
- `lsof -i :3001` 명령으로 포트 확인 (Python 프록시)

### 2. API 서버 연결 실패
- AWS 서버가 실행 중인지 확인
- 네트워크 연결 확인

### 3. 목업 데이터로 전환
- 개발 테스트 패널에서 "목업 데이터 토글" 클릭
- 또는 `config.js`에서 `ENABLE_MOCK_DATA: true` 설정 