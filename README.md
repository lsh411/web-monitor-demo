# 헬로온 대시보드 베타 버전

실제 AWS API와 연동하여 피보호자의 생체 데이터를 실시간으로 모니터링하는 대시보드입니다.

## 🚀 빠른 시작

### 1. 목업 데이터로 테스트

```html
<!-- index.html 의 API Configuration 부분 수정 -->
<script>
window.API_CONFIG = {
    BASE_URL: 'https://your-api-endpoint.com',
    WATCHER_USER_ID: 'watcher_001',
    UPDATE_INTERVAL: 5000,
    ENABLE_MOCK_DATA: true  // 목업 데이터 사용
};
</script>
```

### 2. 실제 API 연동

```html
<script>
window.API_CONFIG = {
    BASE_URL: 'https://api.hello-on.com',  // 실제 API 엔드포인트
    WATCHER_USER_ID: 'your_watcher_id',     // 실제 보호자 ID
    UPDATE_INTERVAL: 5000,                  // 업데이트 주기 (밀리초)
    ENABLE_MOCK_DATA: false                 // 실제 API 사용
};
</script>
```

## 📋 주요 기능

### 입소인 상태 목록 (`resident-table`)
- 피보호자 정보 실시간 표시
- 심박수, 산소포화도, 걸음수 자동 업데이트
- 상태에 따른 라벨 자동 변경 (일상생활, 운동, 수면, 이동, 경고)

### API 엔드포인트
- `/watcher/mappings` - 보호자와 연결된 피보호자 목록
- `/ward/user` - 피보호자 상세 정보
- `/watcher/latest` - 최신 생체 데이터
- `/watcher/event` - 이벤트 알림 데이터

## 🛠 설정 방법

### CORS 이슈 해결

#### 옵션 1: 프록시 서버 사용 (개발 환경)

```javascript
// 예: http-proxy-middleware 사용
const { createProxyMiddleware } = require('http-proxy-middleware');

app.use('/api', createProxyMiddleware({
  target: 'https://api.hello-on.com',
  changeOrigin: true,
  pathRewrite: { '^/api': '' }
}));
```

#### 옵션 2: 서버에서 CORS 헤더 설정

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type
```

## 📊 데이터 구조

### 매핑 정보 (Mapping)
```json
{
  "wardedUserId": "ward001",
  "activeYn": "o",
  "room": "101호"
}
```

### 피보호자 정보 (User)
```json
{
  "wardedUserId": "ward001",
  "userName": "김영수",
  "age": "77",
  "profileUrl": "https://..."
}
```

### 생체 데이터 (Bio Data)
```json
{
  "heartBeatList": [{ "heartBeat": 68 }],
  "oxygenStatusList": [{ "oxygenSaturation": 95 }],
  "stepsList": [{ "steps": 3482 }]
}
```

## 🔧 문제 해결

### 데이터가 표시되지 않을 때
1. 브라우저 개발자 도구(F12) > Console 확인
2. Network 탭에서 API 호출 상태 확인
3. `ENABLE_MOCK_DATA: true`로 변경하여 목업 데이터 테스트

### API 연결 실패 시
1. API 엔드포인트 URL 확인
2. WATCHER_USER_ID가 올바른지 확인
3. CORS 설정 확인
4. 네트워크 연결 상태 확인

## 📝 참고사항

- 업데이트 주기는 기본 5초로 설정되어 있으며, API 부하를 고려하여 조정 가능
- 수면 시간 데이터는 현재 더미 데이터로 표시 (추후 API 추가 예정)
- 이벤트 발생 시 상태 라벨이 자동으로 경고 상태로 변경

## 📞 지원

문제가 발생하거나 추가 기능이 필요한 경우 연락 주세요. 