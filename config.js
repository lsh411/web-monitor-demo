// Configuration for the web monitor demo
window.API_CONFIG = {
  // AI Configuration - API 키는 백엔드 Parameter Store에서 관리
  AI_CONFIG: {
    ENABLED: true
  },

  // API endpoint configuration
  // Synology 서버에서는 CORS 설정이 되어 있어 직접 연결 가능
  BASE_URL: 'http://ec2-52-78-169-124.ap-northeast-2.compute.amazonaws.com:8080', // 실제 API 서버
  // BASE_URL: 'http://localhost:8080', // 로컬 테스트용
  
  // WATCHER_USER_ID는 로그인한 사용자에 따라 동적으로 설정됨
  get WATCHER_USER_ID() {
    return localStorage.getItem('watcherUserId') || '3743690826'; // 기본값
  },
  
  // Update intervals (in milliseconds)
  UPDATE_INTERVAL: 10000, // 10 seconds
  
  // Feature flags
  ENABLE_MOCK_DATA: new URLSearchParams(window.location.search).get('demo') === 'true' ? true : false, // 데모 모드면 자동으로 목업 데이터 사용
  ENABLE_REAL_TIME_UPDATES: true,
  
  // Debug settings
  DEBUG_MODE: true,
  CONSOLE_LOGGING: true,
  
  // Testing modes
  API_TEST_MODE: 'real', // 'mock', 'real', 'mixed'
  SHOW_API_ERRORS: true,
  
  // Kakao Maps API - API 키는 백엔드 Parameter Store에서 관리
  KAKAO_API: {
    CACHE_DURATION: 300000, // 5분 캐시
    ENABLE_CACHE: true
  },

  // 시설 위치 설정 (외출 판단 기준) - 대시보드(script.js)의 FACILITY_LOCATION과 동일
  FACILITY: {
    NAME: '은빛노인요양전문기관',
    LATITUDE: 37.501610,
    LONGITUDE: 127.148037,
    AUTO_DETECT: false,  // 고정 좌표 사용
    OUTING_THRESHOLD_KM: 0.04  // 40m 이상이면 외출로 판단 (대시보드와 동일)
  }
};

// Apply configuration
if (window.API_CONFIG.DEBUG_MODE) {
  console.log('API Configuration loaded:', window.API_CONFIG);
}