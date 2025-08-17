// Configuration for the web monitor demo
window.API_CONFIG = {
  // API endpoint configuration
  // Synology 서버에서는 CORS 설정이 되어 있어 직접 연결 가능
  BASE_URL: 'http://ec2-52-78-169-124.ap-northeast-2.compute.amazonaws.com:8080', // 실제 API 서버
  
  // WATCHER_USER_ID는 로그인한 사용자에 따라 동적으로 설정됨
  get WATCHER_USER_ID() {
    return localStorage.getItem('watcherUserId') || '3743690826'; // 기본값
  },
  
  // Update intervals (in milliseconds)
  UPDATE_INTERVAL: 10000, // 10 seconds
  
  // Feature flags
  ENABLE_MOCK_DATA: false, // false로 설정하여 실제 API 사용
  ENABLE_REAL_TIME_UPDATES: true,
  
  // Debug settings
  DEBUG_MODE: true,
  CONSOLE_LOGGING: true,
  
  // Testing modes
  API_TEST_MODE: 'real', // 'mock', 'real', 'mixed'
  SHOW_API_ERRORS: true,
  
  // Kakao Maps API configuration
  KAKAO_API: {
    REST_API_KEY: '38dfbdeae184d57cbb2aa76b517a5a64',
    GEOCODING_URL: 'https://dapi.kakao.com/v2/local/geo/coord2address.json',
    CACHE_DURATION: 300000, // 5분 캐시
    ENABLE_CACHE: true
  }
};

// Apply configuration
if (window.API_CONFIG.DEBUG_MODE) {
  console.log('API Configuration loaded:', window.API_CONFIG);
}