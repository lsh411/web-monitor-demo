/**
 * 외출 리포트 전용 스크립트
 * outing-report.html과 함께 사용
 */

// === 상태 변수 ===
let currentView = 'calendar'; // 캘린더 뷰만 사용
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let selectedResident = '';
let outingData = {};
let residents = [];
let totalResidentsCount = 0; // 전체 입소자 수 (API에서 동적으로 가져옴)

// === 입소자 프로필 정보 ===
// 데모 모드용 목업 프로필
const mockResidentProfiles = {
  '김영수': { emoji: '👴', bgColor: '#DBEAFE' },
  '박순자': { emoji: '👵', bgColor: '#FCE7F3' },
  '이철수': { emoji: '👴', bgColor: '#D1FAE5' },
  '최영희': { emoji: '👵', bgColor: '#FEF3C7' },
  '정미숙': { emoji: '👵', bgColor: '#E5E7EB' },
  '홍길동': { emoji: '👴', bgColor: '#FED7AA' }
};

// 실제 API에서 가져온 입소자 프로필 (wardedUserId -> profile 매핑)
let residentProfilesMap = {};

// 프로필 정보 가져오기
function getResidentProfile(nameOrId) {
  // 1. 실제 API 데이터에서 먼저 찾기 (wardedUserId 또는 이름으로)
  if (residentProfilesMap[nameOrId]) {
    return residentProfilesMap[nameOrId];
  }

  // 2. 이름으로 검색 (residentProfilesMap의 값에서 검색)
  for (const profile of Object.values(residentProfilesMap)) {
    if (profile.name === nameOrId) {
      return profile;
    }
  }

  // 3. 데모 모드용 목업 프로필에서 찾기
  if (mockResidentProfiles[nameOrId]) {
    return mockResidentProfiles[nameOrId];
  }

  // 4. 기본값 반환
  return { emoji: '👤', bgColor: '#E5E7EB' };
}

// === 목업 데이터 ===
const mockOutingData = {
  '2025-12-01': [
    { name: '이철수', age: 72, room: '103호', time: '08:30~09:20', duration: '50분', location: '용인시 기흥구', distance: '300m' }
  ],
  '2025-12-02': [
    { name: '김영수', age: 77, room: '101호', time: '09:00~09:40', duration: '40분', location: '용인시 기흥구', distance: '120m' },
    { name: '박순자', age: 84, room: '102호', time: '10:30~11:00', duration: '30분', location: '용인시 수지구', distance: '200m' }
  ],
  '2025-12-03': [
    { name: '김영수', age: 77, room: '101호', time: '10:30~11:15', duration: '45분', location: '용인시 기흥구', distance: '150m' }
  ],
  '2025-12-04': [
    { name: '이철수', age: 72, room: '103호', time: '10:15~11:00', duration: '45분', location: '용인시 수지구', distance: '450m' },
    { name: '정미숙', age: 79, room: '105호', time: '14:00~14:45', duration: '45분', location: '용인시 기흥구', distance: '180m' }
  ],
  '2025-12-05': [
    { name: '박순자', age: 84, room: '102호', time: '10:00~10:40', duration: '40분', location: '용인시 수지구 공원', distance: '250m' }
  ],
  '2025-12-06': [
    { name: '이철수', age: 72, room: '103호', time: '14:00~14:50', duration: '50분', location: '용인시 기흥구', distance: '280m' },
    { name: '김영수', age: 77, room: '101호', time: '09:00~09:35', duration: '35분', location: '용인시 기흥구', distance: '100m' },
    { name: '홍길동', age: 81, room: '106호', time: '11:00~11:40', duration: '40분', location: '용인시 수지구', distance: '320m' }
  ],
  '2025-12-07': [
    { name: '김영수', age: 77, room: '101호', time: '14:20~15:05', duration: '45분', location: '용인시 수지구', distance: '350m' },
    { name: '최영희', age: 80, room: '104호', time: '09:00~11:30', duration: '2시간 30분', location: '용인시 처인구 병원', distance: '2.5km', warning: true }
  ],
  '2025-12-08': [
    { name: '이철수', age: 72, room: '103호', time: '09:00~09:45', duration: '45분', location: '용인시 기흥구', distance: '200m' }
  ],
  '2025-12-09': [
    { name: '이철수', age: 72, room: '103호', time: '15:30~16:20', duration: '50분', location: '용인시 수지구 병원', distance: '800m' },
    { name: '정미숙', age: 79, room: '105호', time: '10:00~10:30', duration: '30분', location: '용인시 기흥구', distance: '150m' }
  ],
  '2025-12-10': [
    { name: '김영수', age: 77, room: '101호', time: '09:00~09:30', duration: '30분', location: '용인시 기흥구', distance: '80m' },
    { name: '최영희', age: 80, room: '104호', time: '11:20~11:45', duration: '25분', location: '용인시 기흥구', distance: '60m' }
  ],
  '2025-12-11': [
    { name: '박순자', age: 84, room: '102호', time: '14:00~14:35', duration: '35분', location: '용인시 기흥구', distance: '180m' }
  ],
  '2025-12-12': [
    { name: '김영수', age: 77, room: '101호', time: '15:45~16:30', duration: '45분', location: '용인시 기흥구 병원', distance: '500m' },
    { name: '이철수', age: 72, room: '103호', time: '10:00~10:35', duration: '35분', location: '용인시 수지구', distance: '400m' },
    { name: '박순자', age: 84, room: '102호', time: '09:00~09:25', duration: '25분', location: '용인시 기흥구', distance: '100m' },
    { name: '최영희', age: 80, room: '104호', time: '14:00~14:40', duration: '40분', location: '용인시 기흥구', distance: '220m' }
  ],
  '2025-12-13': [
    { name: '박순자', age: 84, room: '102호', time: '09:30~10:05', duration: '35분', location: '용인시 기흥구', distance: '150m' },
    { name: '이철수', age: 72, room: '103호', time: '10:00~10:45', duration: '45분', location: '용인시 기흥구', distance: '300m' },
    { name: '최영희', age: 80, room: '104호', time: '14:00~14:30', duration: '30분', location: '용인시 기흥구', distance: '180m' }
  ],
  '2025-12-14': [
    { name: '김영수', age: 77, room: '101호', time: '11:00~11:35', duration: '35분', location: '용인시 기흥구', distance: '150m' },
    { name: '홍길동', age: 81, room: '106호', time: '09:00~12:00', duration: '3시간', location: '용인시 처인구 종합병원', distance: '5km', warning: true },
    { name: '정미숙', age: 79, room: '105호', time: '14:30~15:10', duration: '40분', location: '용인시 수지구', distance: '350m' },
    { name: '박순자', age: 84, room: '102호', time: '10:00~10:25', duration: '25분', location: '용인시 기흥구', distance: '120m' },
    { name: '이철수', age: 72, room: '103호', time: '15:00~15:40', duration: '40분', location: '용인시 기흥구', distance: '250m' }
  ],
  '2025-12-15': [
    { name: '이철수', age: 72, room: '103호', time: '08:00~10:30', duration: '2시간 30분', location: '용인시 처인구', distance: '3km', warning: true }
  ],
  '2025-12-16': [
    { name: '김영수', age: 77, room: '101호', time: '10:00~10:40', duration: '40분', location: '용인시 기흥구', distance: '200m' },
    { name: '박순자', age: 84, room: '102호', time: '14:00~14:30', duration: '30분', location: '용인시 수지구', distance: '180m' }
  ],
  '2025-12-17': [
    { name: '정미숙', age: 79, room: '105호', time: '09:30~10:15', duration: '45분', location: '용인시 기흥구', distance: '220m' }
  ],
  '2025-12-18': [
    { name: '이철수', age: 72, room: '103호', time: '11:00~11:45', duration: '45분', location: '용인시 수지구', distance: '400m' },
    { name: '최영희', age: 80, room: '104호', time: '15:00~15:35', duration: '35분', location: '용인시 기흥구', distance: '150m' }
  ],
  '2025-12-19': [
    { name: '김영수', age: 77, room: '101호', time: '09:00~09:30', duration: '30분', location: '용인시 기흥구', distance: '100m' },
    { name: '박순자', age: 84, room: '102호', time: '10:30~11:00', duration: '30분', location: '용인시 기흥구', distance: '150m' },
    { name: '홍길동', age: 81, room: '106호', time: '14:00~14:45', duration: '45분', location: '용인시 수지구', distance: '280m' }
  ],
  '2025-12-20': [
    { name: '이철수', age: 72, room: '103호', time: '10:00~10:50', duration: '50분', location: '용인시 기흥구', distance: '300m' }
  ],
  '2025-12-21': [
    { name: '김영수', age: 77, room: '101호', time: '09:00~09:40', duration: '40분', location: '용인시 기흥구', distance: '180m' },
    { name: '박순자', age: 84, room: '102호', time: '10:00~10:30', duration: '30분', location: '용인시 수지구', distance: '200m' },
    { name: '이철수', age: 72, room: '103호', time: '14:00~14:45', duration: '45분', location: '용인시 기흥구', distance: '250m' },
    { name: '최영희', age: 80, room: '104호', time: '11:00~13:30', duration: '2시간 30분', location: '용인시 처인구 병원', distance: '2km', warning: true },
    { name: '정미숙', age: 79, room: '105호', time: '15:30~16:00', duration: '30분', location: '용인시 기흥구', distance: '150m' },
    { name: '홍길동', age: 81, room: '106호', time: '09:30~10:10', duration: '40분', location: '용인시 수지구', distance: '320m' }
  ],
  '2025-12-22': [
    { name: '정미숙', age: 79, room: '105호', time: '10:00~10:35', duration: '35분', location: '용인시 기흥구', distance: '180m' }
  ],
  '2025-12-23': [
    { name: '김영수', age: 77, room: '101호', time: '11:00~11:40', duration: '40분', location: '용인시 수지구', distance: '350m' },
    { name: '이철수', age: 72, room: '103호', time: '09:00~09:45', duration: '45분', location: '용인시 기흥구', distance: '200m' }
  ],
  '2025-12-24': [
    { name: '박순자', age: 84, room: '102호', time: '14:00~14:30', duration: '30분', location: '용인시 기흥구', distance: '150m' },
    { name: '최영희', age: 80, room: '104호', time: '10:00~10:40', duration: '40분', location: '용인시 수지구', distance: '280m' },
    { name: '홍길동', age: 81, room: '106호', time: '15:00~15:45', duration: '45분', location: '용인시 기흥구', distance: '220m' }
  ],
  '2025-12-25': [
    { name: '김영수', age: 77, room: '101호', time: '10:00~10:30', duration: '30분', location: '용인시 기흥구', distance: '100m' },
    { name: '박순자', age: 84, room: '102호', time: '11:00~11:25', duration: '25분', location: '용인시 기흥구', distance: '120m' },
    { name: '이철수', age: 72, room: '103호', time: '09:00~09:35', duration: '35분', location: '용인시 수지구', distance: '300m' },
    { name: '최영희', age: 80, room: '104호', time: '14:00~14:40', duration: '40분', location: '용인시 기흥구', distance: '180m' }
  ],
  '2025-12-26': [
    { name: '정미숙', age: 79, room: '105호', time: '10:30~11:15', duration: '45분', location: '용인시 기흥구', distance: '200m' }
  ],
  '2025-12-27': [
    { name: '이철수', age: 72, room: '103호', time: '09:00~09:50', duration: '50분', location: '용인시 기흥구', distance: '280m' },
    { name: '홍길동', age: 81, room: '106호', time: '14:00~14:40', duration: '40분', location: '용인시 수지구', distance: '350m' }
  ],
  '2025-12-28': [
    { name: '김영수', age: 77, room: '101호', time: '10:00~10:45', duration: '45분', location: '용인시 기흥구', distance: '180m' },
    { name: '박순자', age: 84, room: '102호', time: '11:30~12:00', duration: '30분', location: '용인시 수지구', distance: '220m' },
    { name: '최영희', age: 80, room: '104호', time: '09:00~11:30', duration: '2시간 30분', location: '용인시 처인구 병원', distance: '2.5km', warning: true }
  ],
  '2025-12-29': [
    { name: '이철수', age: 72, room: '103호', time: '14:00~14:50', duration: '50분', location: '용인시 기흥구', distance: '300m' }
  ],
  '2025-12-30': [
    { name: '김영수', age: 77, room: '101호', time: '09:30~10:10', duration: '40분', location: '용인시 기흥구', distance: '150m' },
    { name: '정미숙', age: 79, room: '105호', time: '11:00~11:35', duration: '35분', location: '용인시 수지구', distance: '280m' }
  ],
  '2025-12-31': [
    { name: '박순자', age: 84, room: '102호', time: '10:00~10:30', duration: '30분', location: '용인시 기흥구', distance: '120m' },
    { name: '이철수', age: 72, room: '103호', time: '15:00~15:40', duration: '40분', location: '용인시 기흥구', distance: '200m' },
    { name: '홍길동', age: 81, room: '106호', time: '09:00~09:45', duration: '45분', location: '용인시 수지구', distance: '350m' }
  ]
};

// === API 호출 함수 ===

/**
 * 외출 데이터 조회 (월별)
 */
async function fetchOutingData(year, month) {
  // 데모 모드면 목업 데이터 반환
  if (window.API_CONFIG?.ENABLE_MOCK_DATA) {
    console.log('[OUTING] 데모 모드 - 목업 데이터 사용');
    // 목업 데이터에서 고유 입소자 수 계산
    const uniqueResidents = new Set();
    for (const events of Object.values(mockOutingData)) {
      for (const event of events) {
        uniqueResidents.add(event.name);
      }
    }
    totalResidentsCount = uniqueResidents.size;
    console.log('[OUTING] 데모 모드 전체 입소자 수:', totalResidentsCount);
    outingData = mockOutingData;
    return mockOutingData;
  }

  // 실제 API 호출
  try {
    const mappings = await fetchMappings();
    if (!mappings || mappings.length === 0) {
      console.warn('[OUTING] 입소자 매핑 없음');
      totalResidentsCount = 0;
      return {};
    }

    // 전체 입소자 수 저장
    totalResidentsCount = mappings.length;
    console.log('[OUTING] 전체 입소자 수:', totalResidentsCount);

    // 입소자 프로필 정보 저장
    residentProfilesMap = {};
    for (const m of mappings) {
      const gender = m.gender === 'M' || m.gender === 'male' ? 'male' : 'female';
      residentProfilesMap[m.wardedUserId] = {
        name: m.userName,
        emoji: m.profileEmoji || (gender === 'female' ? '👵' : '👴'),
        bgColor: m.profileColor || '#E5E7EB'
      };
    }
    console.log('[OUTING] 입소자 프로필 로드 완료:', residentProfilesMap);

    // 월의 시작일/종료일 계산
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const result = {};

    // 각 입소자별로 위치 데이터 조회
    for (const mapping of mappings) {
      try {
        const locationData = await fetchLocationPeriod(mapping.wardedUserId, fromDate, toDate);
        if (locationData && locationData.length > 0) {
          const outings = processLocationData(locationData, mapping);
          // 날짜별로 분류
          for (const outing of outings) {
            if (!result[outing.date]) {
              result[outing.date] = [];
            }
            result[outing.date].push(outing);
          }
        }
      } catch (err) {
        console.error(`[OUTING] ${mapping.userName} 위치 데이터 조회 실패:`, err);
      }
    }

    console.log('[OUTING] 외출 데이터 처리 완료:', Object.keys(result).length, '일');
    outingData = result;
    return result;
  } catch (err) {
    console.error('[OUTING] 외출 데이터 조회 실패:', err);
    // 오류 시 목업 데이터로 폴백
    outingData = mockOutingData;
    return mockOutingData;
  }
}

/**
 * 좌표를 주소로 변환 (역지오코딩) - 백엔드 프록시 사용
 */
const locationCache = {};

async function getLocationNameFromCoords(lat, lng) {
  const cacheKey = `${lat.toFixed(5)}_${lng.toFixed(5)}`;

  // 캐시 확인
  if (locationCache[cacheKey]) {
    return locationCache[cacheKey];
  }

  try {
    const BASE_URL = window.API_CONFIG?.BASE_URL || '';
    const response = await fetch(`${BASE_URL}/watcher/geocode/reverse?lat=${lat}&lng=${lng}`);

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const result = await response.json();

    let locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (result.code === '1000' && result.response) {
      const data = result.response;
      // 도로명 주소 (건물명) 우선, 없으면 지번 주소
      if (data.roadAddress) {
        locationName = data.roadAddress;
      } else if (data.address) {
        locationName = data.address;
      }
    }

    // 캐시 저장
    locationCache[cacheKey] = locationName;
    return locationName;

  } catch (err) {
    console.error('[OUTING] 역지오코딩 실패:', err);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * 위치 데이터 기간 조회 API
 */
async function fetchLocationPeriod(wardedUserId, fromDate, toDate) {
  const config = window.API_CONFIG;
  const url = `${config.BASE_URL}/watcher/period?wardedUserId=${wardedUserId}&fromDate=${fromDate}&toDate=${toDate}&bioDataTypes=LOCATION`;

  console.log('[OUTING] 위치 API 호출:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`API 오류: ${response.status}`);
  }

  const data = await response.json();
  if (data.code === '1000' && data.response) {
    return data.response.location || [];
  }
  return [];
}

/**
 * 원시 위치 데이터를 외출 이벤트로 변환
 * @param {Array} locations - API에서 받은 위치 데이터
 * @param {Object} resident - 입소자 정보
 * @returns {Array} 외출 이벤트 배열
 */
function processLocationData(locations, resident) {
  if (!locations || locations.length === 0) return [];

  // 제외된 위치 데이터 필터링 (excludedYn === 'Y'인 데이터 제외)
  const filteredLocations = locations.filter(loc => loc.excludedYn !== 'Y');

  console.log(`[OUTING] ${resident.userName} 원시 위치 데이터:`, locations.length, '건, 제외 후:', filteredLocations.length, '건');

  if (filteredLocations.length === 0) return [];

  console.log(`[OUTING] ${resident.userName} 첫 번째 데이터:`, filteredLocations[0]);
  console.log(`[OUTING] ${resident.userName} 마지막 데이터:`, filteredLocations[filteredLocations.length - 1]);

  const config = window.API_CONFIG?.FACILITY || {};
  const outingThreshold = config.OUTING_THRESHOLD_KM || 0.05; // 50m

  // 시설 기준 좌표 결정
  let facilityLat, facilityLng;

  if (config.AUTO_DETECT && filteredLocations.length > 0) {
    // 자동 추정: 가장 많이 머문 위치를 시설로 추정
    // 위치를 그리드로 나누어 가장 빈도가 높은 그리드의 중심을 사용
    const gridSize = 0.001; // 약 100m 그리드
    const grid = {};

    for (const loc of filteredLocations) {
      const gridKey = `${Math.round(loc.latitude / gridSize)}_${Math.round(loc.longitude / gridSize)}`;
      if (!grid[gridKey]) {
        grid[gridKey] = { count: 0, lat: 0, lng: 0 };
      }
      grid[gridKey].count++;
      grid[gridKey].lat += loc.latitude;
      grid[gridKey].lng += loc.longitude;
    }

    // 가장 빈도가 높은 그리드 찾기
    let maxCount = 0;
    let facilityGrid = null;
    for (const [key, data] of Object.entries(grid)) {
      if (data.count > maxCount) {
        maxCount = data.count;
        facilityGrid = data;
      }
    }

    if (facilityGrid) {
      facilityLat = facilityGrid.lat / facilityGrid.count;
      facilityLng = facilityGrid.lng / facilityGrid.count;
      console.log(`[OUTING] 시설 위치 자동 추정: ${facilityLat.toFixed(6)}, ${facilityLng.toFixed(6)} (${maxCount}회 측정)`);
    } else {
      facilityLat = config.LATITUDE || 37.5665;
      facilityLng = config.LONGITUDE || 126.9780;
    }
  } else {
    // 설정된 좌표 사용
    facilityLat = config.LATITUDE || 37.5665;
    facilityLng = config.LONGITUDE || 126.9780;
  }

  // 시간순 정렬
  const sorted = [...filteredLocations].sort((a, b) =>
    new Date(a.registrationDateTime) - new Date(b.registrationDateTime)
  );

  const outings = [];
  let currentOuting = null;

  // 날짜 문자열 추출 함수 (로컬 시간 기준)
  const getDateStr = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  for (const loc of sorted) {
    // calculateDistance는 km 단위를 반환
    const distanceKm = calculateDistance(facilityLat, facilityLng, loc.latitude, loc.longitude);
    const distanceM = distanceKm * 1000; // m로 변환

    // 정확도 및 위치 제공자(locationProvider) 기반 필터링
    // 1000m 이내 외출은 GPS 검증된 데이터만 인정
    const accuracy = loc.accuracy || null;
    const locationProvider = loc.locationProvider || null;
    if (distanceM <= 1000 && distanceM > outingThreshold * 1000) {
      // 시설에서 40m~1000m 사이 (외출 의심 구간)
      // GPS 검증이 필요한 구간: locationProvider가 'gps'가 아니면 스킵
      if (locationProvider !== 'gps') {
        // 'fused_unverified'이거나 null이면 외출로 인정하지 않음
        // (실내에서 WiFi/Cell 기반 위치가 오탐으로 잡힌 경우)
        console.log(`[OUTING] 외출 의심 구간 GPS 미검증 스킵: ${distanceM.toFixed(0)}m, provider=${locationProvider}`);
        continue;
      }
      // GPS 검증된 경우에도 정확도 검증
      if (accuracy === null || accuracy > 40) {
        continue;
      }
    }

    const isOutside = distanceKm > outingThreshold;
    const locTime = new Date(loc.registrationDateTime);

    if (isOutside) {
      if (!currentOuting) {
        // 외출 시작
        currentOuting = {
          startTime: locTime,
          endTime: locTime,
          maxDistance: distanceM,
          lastLat: loc.latitude,
          lastLng: loc.longitude,
          dateStr: getDateStr(locTime),
          locations: [{ // 위치 이력 저장
            time: locTime,
            lat: loc.latitude,
            lng: loc.longitude,
            distance: distanceM,
            accuracy: loc.accuracy || null,
            locationProvider: loc.locationProvider || null,
            bioKey: loc.bioKey || null
          }]
        };
      } else {
        // 날짜가 바뀌었는지 확인
        const newDateStr = getDateStr(locTime);
        if (newDateStr !== currentOuting.dateStr) {
          // 날짜가 바뀌면 이전 외출을 당일 23:59:59로 종료
          const endOfDay = new Date(currentOuting.startTime);
          endOfDay.setHours(23, 59, 59, 999);
          currentOuting.endTime = endOfDay;

          const durationMs = currentOuting.endTime - currentOuting.startTime;
          const durationMin = Math.round(durationMs / 60000);
          if (durationMin >= 5) {
            outings.push(createOutingEvent(currentOuting, resident, durationMin));
          }

          // 새 날짜의 외출은 00:00부터 시작
          const startOfNewDay = new Date(locTime);
          startOfNewDay.setHours(0, 0, 0, 0);
          currentOuting = {
            startTime: startOfNewDay,
            endTime: locTime,
            maxDistance: distanceM,
            lastLat: loc.latitude,
            lastLng: loc.longitude,
            dateStr: newDateStr,
            locations: [{
              time: locTime,
              lat: loc.latitude,
              lng: loc.longitude,
              distance: distanceM,
              accuracy: loc.accuracy || null,
              locationProvider: loc.locationProvider || null,
              bioKey: loc.bioKey || null
            }]
          };
        } else {
          // 같은 날짜 내 외출 진행 중
          currentOuting.endTime = locTime;
          // 위치 이력 추가
          currentOuting.locations.push({
            time: locTime,
            lat: loc.latitude,
            lng: loc.longitude,
            distance: distanceM,
            accuracy: loc.accuracy || null,
            locationProvider: loc.locationProvider || null,
            bioKey: loc.bioKey || null
          });
          if (distanceM > currentOuting.maxDistance) {
            currentOuting.maxDistance = distanceM;
            currentOuting.lastLat = loc.latitude;
            currentOuting.lastLng = loc.longitude;
          }
        }
      }
    } else if (currentOuting) {
      // 외출 종료 (시설 안으로 복귀)
      const durationMs = currentOuting.endTime - currentOuting.startTime;
      const durationMin = Math.round(durationMs / 60000);

      if (durationMin >= 5) { // 5분 이상만 기록
        outings.push(createOutingEvent(currentOuting, resident, durationMin));
      }
      currentOuting = null;
    }
  }

  // 마지막 외출이 아직 진행 중인 경우
  if (currentOuting) {
    const durationMs = currentOuting.endTime - currentOuting.startTime;
    const durationMin = Math.round(durationMs / 60000);
    if (durationMin >= 5) {
      outings.push(createOutingEvent(currentOuting, resident, durationMin));
    }
  }

  console.log(`[OUTING] ${resident.userName} 외출 처리 결과: ${outings.length}건`, outings);
  return outings;
}

/**
 * 시간을 HH:MM 형식으로 포맷팅
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷팅 (로컬 시간 기준)
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 외출 이벤트 객체 생성
 */
function createOutingEvent(outing, resident, durationMin) {
  const dateStr = formatDate(outing.startTime);
  const startTimeStr = formatTime(outing.startTime);
  const endTimeStr = formatTime(outing.endTime);

  let durationStr;
  if (durationMin >= 60) {
    const hours = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    durationStr = mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  } else {
    durationStr = `${durationMin}분`;
  }

  let distanceStr;
  if (outing.maxDistance >= 1000) {
    distanceStr = `${(outing.maxDistance / 1000).toFixed(1)}km`;
  } else {
    distanceStr = `${Math.round(outing.maxDistance)}m`;
  }

  return {
    date: dateStr,
    name: resident.userName,
    age: parseInt(resident.age) || 0,
    room: resident.room || '미지정',
    time: `${startTimeStr}~${endTimeStr}`,
    duration: durationStr,
    distance: distanceStr,
    warning: durationMin >= 120, // 2시간 이상이면 경고
    lat: outing.lastLat,
    lng: outing.lastLng,
    locations: outing.locations || [] // 위치 이력 포함
  };
}

// === 데이터 처리 함수 ===

/**
 * 필터된 데이터 가져오기
 */
function getFilteredData() {
  console.log('[OUTING] getFilteredData - outingData:', outingData);
  console.log('[OUTING] 필터 조건:', `${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  console.log('[OUTING] outingData의 모든 키:', Object.keys(outingData));

  const filtered = {};
  for (const [date, events] of Object.entries(outingData)) {
    if (date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)) {
      const filteredEvents = selectedResident
        ? events.filter(e => e.name === selectedResident)
        : events;
      if (filteredEvents.length > 0) {
        filtered[date] = filteredEvents;
      }
    }
  }
  console.log('[OUTING] 필터 결과:', filtered);
  return filtered;
}

/**
 * 요약 카드 업데이트
 */
function updateSummary() {
  const data = getFilteredData();
  let totalCount = 0;
  let totalMinutes = 0;
  const residentSet = new Set();
  let days = 0;

  for (const [date, events] of Object.entries(data)) {
    days++;
    for (const event of events) {
      totalCount++;
      residentSet.add(event.name);
      // 시간 파싱
      const match = event.duration.match(/(\d+)시간\s*(\d+)?분?|(\d+)분/);
      if (match) {
        if (match[1]) totalMinutes += parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
        else if (match[3]) totalMinutes += parseInt(match[3]);
      }
    }
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const avgMinutes = totalCount > 0 ? Math.round(totalMinutes / totalCount) : 0;
  const percentage = totalResidentsCount > 0 ? ((residentSet.size / totalResidentsCount) * 100).toFixed(1) : '0.0';

  document.getElementById('total-count').textContent = `${totalCount}건`;
  document.getElementById('total-count-sub').textContent = '이번 달 전체';

  document.getElementById('total-time').textContent = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  document.getElementById('total-time-sub').textContent = `평균 ${avgMinutes}분/회`;

  document.getElementById('total-residents').textContent = `${residentSet.size}명 / ${totalResidentsCount}명`;
  document.getElementById('total-residents-sub').textContent = `${percentage}% 외출 경험`;

  document.getElementById('total-days').textContent = `${days}일`;
  document.getElementById('total-days-sub').textContent = '이번 달 기준';
}

// === UI 렌더링 함수 ===

/**
 * 리스트 뷰 렌더링
 */
function renderList() {
  const data = getFilteredData();
  const residentMap = {};

  // 입소자별로 그룹화
  for (const [date, events] of Object.entries(data)) {
    console.log(`[OUTING] 날짜 ${date}의 이벤트:`, events);
    for (const event of events) {
      console.log(`[OUTING] 이벤트 처리: ${event.name}, date=${date}`);
      if (!residentMap[event.name]) {
        residentMap[event.name] = {
          ...event,
          outings: []
        };
      }
      residentMap[event.name].outings.push({ date, ...event });
    }
  }
  console.log('[OUTING] residentMap:', residentMap);
  for (const [name, r] of Object.entries(residentMap)) {
    console.log(`[OUTING] ${name}: outings.length = ${r.outings.length}`, r.outings);
  }

  let html = '';
  let index = 0;
  for (const [name, resident] of Object.entries(residentMap)) {
    const totalMinutes = resident.outings.reduce((sum, o) => {
      const match = o.duration.match(/(\d+)시간\s*(\d+)?분?|(\d+)분/);
      if (match) {
        if (match[1]) return sum + parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
        if (match[3]) return sum + parseInt(match[3]);
      }
      return sum;
    }, 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;

    // 프로필 정보 가져오기 (name은 residentMap의 키값)
    const profile = getResidentProfile(name);

    // 메인 행
    html += `
      <tr class="resident-row" id="resident-row-${index}">
        <td>
          <div class="resident-cell">
            <div class="resident-profile" style="background: ${profile.bgColor};">${profile.emoji}</div>
            <div class="resident-info">
              <div class="resident-name">${resident.name}</div>
              <div class="resident-meta">${resident.age}세 · ${resident.room}</div>
            </div>
          </div>
        </td>
        <td><span class="outing-count">${resident.outings.length}회</span></td>
        <td><span class="outing-duration">${timeStr}</span></td>
        <td><button class="detail-btn" id="detail-btn-${index}">상세보기</button></td>
      </tr>
    `;

    // 상세 행
    html += `
      <tr class="detail-row" id="detail-row-${index}">
        <td colspan="4">
          <div class="detail-list">
            ${resident.outings.map(o => {
              const d = new Date(o.date);
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              return `
                <div class="detail-item">
                  <span class="detail-date">${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})</span>
                  <span class="detail-time">${o.time}</span>
                  <span class="detail-location">📍 ${o.location}</span>
                  <span class="detail-distance">${o.distance}</span>
                  <span class="detail-duration">${o.duration}</span>
                </div>
              `;
            }).join('')}
          </div>
        </td>
      </tr>
    `;
    index++;
  }

  const tableBody = document.getElementById('outing-table-body');
  if (html) {
    tableBody.innerHTML = html;
    // 이벤트 리스너 추가
    for (let i = 0; i < index; i++) {
      const row = document.getElementById(`resident-row-${i}`);
      const btn = document.getElementById(`detail-btn-${i}`);
      if (row) {
        row.addEventListener('click', () => toggleTableDetail(i));
      }
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleTableDetail(i);
        });
      }
    }
  } else {
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:40px;">외출 기록이 없습니다</td></tr>';
  }
}

/**
 * 표 상세 토글
 */
function toggleTableDetail(index) {
  const detailRow = document.getElementById(`detail-row-${index}`);
  const btn = document.getElementById(`detail-btn-${index}`);

  if (!detailRow) return;

  if (detailRow.classList.contains('active')) {
    detailRow.classList.remove('active');
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '상세보기';
    }
  } else {
    detailRow.classList.add('active');
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = '접기';
    }
  }
}

/**
 * 캘린더 뷰 렌더링
 */
function renderCalendar() {
  const data = getFilteredData();
  const grid = document.getElementById('calendar-grid');

  const weekdayHtml = `
    <div class="calendar-weekday sunday">일</div>
    <div class="calendar-weekday">월</div>
    <div class="calendar-weekday">화</div>
    <div class="calendar-weekday">수</div>
    <div class="calendar-weekday">목</div>
    <div class="calendar-weekday">금</div>
    <div class="calendar-weekday saturday">토</div>
  `;

  const firstDay = new Date(currentYear, currentMonth - 1, 1);
  const lastDay = new Date(currentYear, currentMonth, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();

  let daysHtml = '';

  // 이전 달
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    daysHtml += `<div class="calendar-day other-month"><span class="day-number">${prevMonthLastDay - i}</span></div>`;
  }

  // 현재 달
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth - 1, day);
    const dayOfWeek = date.getDay();
    const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = data[dateKey] || [];

    let dayClass = 'calendar-day';
    if (dayOfWeek === 0) dayClass += ' sunday';
    if (dayOfWeek === 6) dayClass += ' saturday';
    if (today.getFullYear() === currentYear && today.getMonth() === currentMonth - 1 && today.getDate() === day) {
      dayClass += ' today';
    }

    let eventsHtml = '';
    if (events.length > 0) {
      dayClass += ' has-outing';
      if (events.some(e => e.warning)) dayClass += ' has-warning';

      // 입소자별로 그룹화하여 외출 횟수 계산
      const groupedByResident = {};
      events.forEach(event => {
        if (!groupedByResident[event.name]) {
          groupedByResident[event.name] = {
            count: 0,
            hasWarning: false
          };
        }
        groupedByResident[event.name].count++;
        if (event.warning) groupedByResident[event.name].hasWarning = true;
      });

      eventsHtml = '<div class="day-events">';
      for (const [name, info] of Object.entries(groupedByResident)) {
        let itemClass = 'day-outing-item';
        if (info.hasWarning) itemClass += ' warning';
        eventsHtml += `
          <div class="${itemClass}">
            <span class="day-outing-name">${name}</span>
            <span class="day-outing-count">${info.count}회</span>
          </div>`;
      }
      eventsHtml += '</div>';
    }

    daysHtml += `
      <div class="${dayClass}" onclick="showDayDetail('${dateKey}')">
        <span class="day-number">${day}</span>
        ${eventsHtml}
      </div>
    `;
  }

  // 다음 달
  const totalCells = startDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    daysHtml += `<div class="calendar-day other-month"><span class="day-number">${i}</span></div>`;
  }

  grid.innerHTML = weekdayHtml + daysHtml;
}

// === 이벤트 핸들러 ===

/**
 * 월 변경
 */
function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear++;
  } else if (currentMonth < 1) {
    currentMonth = 12;
    currentYear--;
  }
  document.getElementById('month-title').textContent = `${currentYear}년 ${currentMonth}월`;

  // 데이터 새로 로드
  fetchOutingData(currentYear, currentMonth).then(() => {
    updateSummary();
    if (currentView === 'list') renderList();
    else renderCalendar();
  });
}

/**
 * 입소자 필터
 */
function filterByResident() {
  selectedResident = document.getElementById('filter-resident').value;
  updateSummary();
  if (currentView === 'list') renderList();
  else renderCalendar();
}

/**
 * 뷰 전환
 */
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.view-toggle-btn[data-view="${view}"]`).classList.add('active');
  document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));
  document.getElementById(`${view}-view`).classList.add('active');

  if (view === 'calendar') renderCalendar();
  else renderList();
}

/**
 * 날짜 상세 모달 표시
 */
function showDayDetail(dateKey) {
  const data = getFilteredData();
  const events = data[dateKey];
  if (!events || events.length === 0) return;

  const [year, month, day] = dateKey.split('-');
  const date = new Date(year, month - 1, day);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  document.getElementById('detail-title').textContent = `${parseInt(month)}월 ${parseInt(day)}일 (${dayNames[date.getDay()]}) 외출 내역`;

  // 현재 날짜 키 저장 (외출 제외 시 사용)
  window._currentDetailDateKey = dateKey;

  let html = '';
  events.forEach((event, eventIdx) => {
    const profile = getResidentProfile(event.name);
    const locations = event.locations || [];
    const locationCount = locations.length;
    // bioKey 목록 추출 (외출 제외 API 호출용)
    const bioKeys = locations.map(loc => loc.bioKey).filter(k => k);
    const hasBioKeys = bioKeys.length > 0;

    html += `
      <div class="day-detail-item" data-event-idx="${eventIdx}" data-bio-keys='${JSON.stringify(bioKeys)}'>
        <div class="detail-header" onclick="toggleOutingLocations(${eventIdx})">
          <div class="detail-profile" style="background: ${profile.bgColor};">${profile.emoji}</div>
          <div class="detail-info">
            <div class="detail-name">${event.name}</div>
            <div class="detail-meta">${event.age}세 · ${event.room} · ${event.distance}</div>
          </div>
          <div class="detail-time">
            <div class="detail-time-value">${event.duration}</div>
            <div class="detail-time-label">${event.time}</div>
          </div>
          ${hasBioKeys ? `<button class="exclude-outing-btn" onclick="excludeOuting(event, ${eventIdx})" title="이 외출 기록을 제외합니다">외출 아님</button>` : ''}
          <div class="detail-expand-icon">▼</div>
        </div>
        <div class="detail-locations" id="locations-${eventIdx}" style="display: none;">
          <div class="locations-header">
            <span>위치 이력 (${locationCount}건)</span>
          </div>
          <div class="locations-list" id="locations-list-${eventIdx}">
            ${renderLocationsList(locations, eventIdx)}
          </div>
        </div>
      </div>
    `;
  });

  document.getElementById('detail-list').innerHTML = html;
  document.getElementById('day-detail-modal').classList.add('active');
}

/**
 * 위치 이력 리스트 렌더링 (최신순)
 */
function renderLocationsList(locations, eventIdx) {
  if (!locations || locations.length === 0) {
    return '<div class="location-item-empty">위치 데이터가 없습니다.</div>';
  }

  // 최신순 정렬
  const sorted = [...locations].sort((a, b) => new Date(b.time) - new Date(a.time));

  return sorted.map((loc, locIdx) => {
    const time = new Date(loc.time);
    const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    const distanceStr = loc.distance >= 1000
      ? `${(loc.distance / 1000).toFixed(1)}km`
      : `${Math.round(loc.distance)}m`;
    const accuracyStr = loc.accuracy ? `(±${Math.round(loc.accuracy)}m)` : '';

    // 위치 제공자 표시 (gps: GPS 검증됨, fused: 일반, fused_unverified: 미검증)
    let providerBadge = '';
    if (loc.locationProvider === 'gps') {
      providerBadge = '<span class="provider-badge gps">GPS</span>';
    } else if (loc.locationProvider === 'fused_unverified') {
      providerBadge = '<span class="provider-badge unverified">미검증</span>';
    }

    return `
      <div class="location-item" onclick="toggleLocationMap(${eventIdx}, ${locIdx}, ${loc.lat}, ${loc.lng}, '${timeStr}', '${distanceStr}')">
        <div class="location-time">${timeStr}</div>
        <div class="location-distance">기관에서 ${distanceStr}</div>
        <div class="location-address" id="addr-${eventIdx}-${locIdx}">주소 조회중...</div>
        <div class="location-accuracy">${accuracyStr} ${providerBadge}</div>
      </div>
      <div class="location-map-container" id="map-${eventIdx}-${locIdx}" style="display: none;"></div>
    `;
  }).join('');
}

/**
 * 외출 건의 위치 이력 펼침/접기
 */
function toggleOutingLocations(eventIdx) {
  const locationsDiv = document.getElementById(`locations-${eventIdx}`);
  const detailItem = document.querySelector(`.day-detail-item[data-event-idx="${eventIdx}"]`);
  const expandIcon = detailItem.querySelector('.detail-expand-icon');

  if (locationsDiv.style.display === 'none') {
    // 다른 모든 위치 이력 숨기기
    document.querySelectorAll('.detail-locations').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('.detail-expand-icon').forEach(el => {
      el.textContent = '▼';
    });

    locationsDiv.style.display = 'block';
    expandIcon.textContent = '▲';

    // 주소 조회 시작
    loadAddressesForEvent(eventIdx);
  } else {
    locationsDiv.style.display = 'none';
    expandIcon.textContent = '▼';
  }
}

/**
 * 특정 외출 건의 모든 위치 주소 조회
 */
async function loadAddressesForEvent(eventIdx) {
  const addressElements = document.querySelectorAll(`[id^="addr-${eventIdx}-"]`);

  for (const el of addressElements) {
    if (el.textContent === '주소 조회중...') {
      const idParts = el.id.split('-');
      const locIdx = parseInt(idParts[2]);

      // 해당 위치의 좌표 가져오기 (data 속성에서)
      const locationItem = el.closest('.location-item');
      const onclickAttr = locationItem.getAttribute('onclick');
      const match = onclickAttr.match(/toggleLocationMap\(\d+,\s*\d+,\s*([\d.]+),\s*([\d.]+)/);

      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);

        try {
          const address = await getLocationNameFromCoords(lat, lng);
          el.textContent = address;
        } catch (err) {
          el.textContent = '주소 조회 실패';
        }
      }
    }
  }
}

/**
 * 위치 항목 클릭 시 지도 토글
 */
function toggleLocationMap(eventIdx, locIdx, lat, lng, timeStr, distanceStr) {
  const mapContainer = document.getElementById(`map-${eventIdx}-${locIdx}`);

  if (mapContainer.style.display === 'none') {
    // 다른 모든 지도 숨기기
    document.querySelectorAll('.location-map-container').forEach(el => {
      el.style.display = 'none';
    });

    mapContainer.style.display = 'block';
    mapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">지도 로딩 중...</div>';

    // 카카오맵 초기화
    if (window.kakao && window.kakao.maps) {
      setTimeout(() => {
        const facilityConfig = window.API_CONFIG?.FACILITY || {};
        const facilityLat = facilityConfig.LATITUDE || 37.501610;
        const facilityLng = facilityConfig.LONGITUDE || 127.148037;

        const mapOption = {
          center: new kakao.maps.LatLng(lat, lng),
          level: 4
        };

        mapContainer.innerHTML = '';
        const map = new kakao.maps.Map(mapContainer, mapOption);

        // 현재 위치 마커
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(lat, lng)
        });
        marker.setMap(map);

        // 인포윈도우
        const iwContent = `<div style="padding:8px; font-size:12px;">
                             <strong>${timeStr}</strong><br>
                             기관에서 ${distanceStr}
                           </div>`;
        const infowindow = new kakao.maps.InfoWindow({ content: iwContent });
        infowindow.open(map, marker);

        // 시설 마커 (별 모양)
        const facilityMarkerImage = new kakao.maps.MarkerImage(
          'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
          new kakao.maps.Size(24, 35)
        );

        const facilityMarker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(facilityLat, facilityLng),
          image: facilityMarkerImage,
          title: facilityConfig.NAME || '시설'
        });
        facilityMarker.setMap(map);

        // 시설 인포윈도우
        const facilityIwContent = `<div style="padding:6px; font-size:11px;">
                                     <strong>${facilityConfig.NAME || '시설'}</strong>
                                   </div>`;
        const facilityInfowindow = new kakao.maps.InfoWindow({ content: facilityIwContent });
        facilityInfowindow.open(map, facilityMarker);

        // 두 마커가 모두 보이도록 조정
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(new kakao.maps.LatLng(lat, lng));
        bounds.extend(new kakao.maps.LatLng(facilityLat, facilityLng));
        map.setBounds(bounds);

        // 두 지점 사이에 점선 그리기
        const linePath = [
          new kakao.maps.LatLng(facilityLat, facilityLng),
          new kakao.maps.LatLng(lat, lng)
        ];

        const polyline = new kakao.maps.Polyline({
          path: linePath,
          strokeWeight: 2,
          strokeColor: '#FF6B6B',
          strokeOpacity: 0.6,
          strokeStyle: 'dashed'
        });
        polyline.setMap(map);

      }, 100);
    } else {
      mapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">카카오맵을 로드할 수 없습니다.</div>';
    }
  } else {
    mapContainer.style.display = 'none';
  }
}

/**
 * 날짜 상세 모달 닫기
 */
async function closeDayDetail() {
  document.getElementById('day-detail-modal').classList.remove('active');

  // 데이터 다시 로드하여 뷰 업데이트 (외출 아님 처리 반영)
  await fetchOutingData(currentYear, currentMonth);
  updateSummary();
  if (currentView === 'calendar') {
    renderCalendar();
  } else {
    renderList();
  }
}

/**
 * 인쇄
 */
function printReport() {
  document.body.classList.add('printing');
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing');
  }, 50);
}

/**
 * 페이지 이동
 */
function navigateTo(page) {
  const urlParams = new URLSearchParams(window.location.search);
  const isDemoMode = urlParams.get('demo') === 'true' || window.API_CONFIG?.ENABLE_MOCK_DATA;

  // userType에 따라 대시보드 페이지 분기
  if (page === 'dashboard.html') {
    const userType = localStorage.getItem('userType');
    if (userType === 'silvercare') {
      page = 'dashboard-poc.html';
    } else if (userType === 'silvercare2') {
      page = 'dashboard-v2.html';
    }
  }

  // 데모 모드 유지
  if (isDemoMode) {
    page += (page.includes('?') ? '&' : '?') + 'demo=true';
  }
  window.location.href = page;
}

/**
 * 로그아웃
 */
function logout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userType');
  window.location.href = 'index.html';
}

/**
 * 입소자 select 동적 생성
 */
async function populateResidentSelect() {
  const select = document.getElementById('filter-resident');
  if (!select) return;

  // 기존 옵션 유지 (전체 입소자)
  select.innerHTML = '<option value="">전체 입소자</option>';

  try {
    let residentList = [];

    if (window.API_CONFIG?.ENABLE_MOCK_DATA) {
      // 목업 데이터에서 입소자 추출
      const uniqueResidents = new Map();
      for (const events of Object.values(mockOutingData)) {
        for (const event of events) {
          if (!uniqueResidents.has(event.name)) {
            uniqueResidents.set(event.name, { name: event.name, room: event.room });
          }
        }
      }
      residentList = Array.from(uniqueResidents.values());
    } else {
      // 실제 API에서 입소자 목록 가져오기
      const mappings = await fetchMappings();
      residentList = mappings.map(m => ({ name: m.userName, room: m.room || '미지정' }));
    }

    // 정렬 후 옵션 추가
    residentList.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    for (const resident of residentList) {
      const option = document.createElement('option');
      option.value = resident.name;
      option.textContent = `${resident.name} (${resident.room})`;
      select.appendChild(option);
    }
  } catch (err) {
    console.error('[OUTING] 입소자 목록 로드 실패:', err);
  }
}

// === 초기화 ===
async function initOutingReport() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth() + 1;
  document.getElementById('month-title').textContent = `${currentYear}년 ${currentMonth}월`;

  // Settings 버튼 바인딩
  const settingsBtn = document.querySelector('.settings-btn');
  if (settingsBtn && typeof openResidentManagementModal === 'function') {
    settingsBtn.addEventListener('click', openResidentManagementModal);
  }

  // 모달 외부 클릭시 닫기
  document.getElementById('day-detail-modal').addEventListener('click', function(e) {
    if (e.target === this) closeDayDetail();
  });

  // 입소자 select 동적 생성
  await populateResidentSelect();

  // 외출 데이터 로드
  await fetchOutingData(currentYear, currentMonth);

  updateSummary();
  renderCalendar(); // 캘린더 뷰만 사용

  console.log('[OUTING] 외출 리포트 초기화 완료');
}

// === 제외 내역 관리 기능 ===

// 제외된 위치 데이터 캐시
let excludedLocationsCache = [];

/**
 * 제외 내역 모달 표시
 */
async function showExcludedHistory() {
  const modal = document.getElementById('excluded-modal');
  const listEl = document.getElementById('excluded-list');
  const emptyEl = document.getElementById('excluded-empty');

  modal.classList.add('active');
  listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #9CA3AF;">로딩 중...</div>';
  emptyEl.style.display = 'none';

  try {
    // 제외된 위치 데이터 조회
    const excludedData = await fetchExcludedLocations();

    if (!excludedData || excludedData.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    // 날짜별로 그룹화
    const grouped = groupExcludedByDate(excludedData);
    excludedLocationsCache = excludedData;

    let html = '';
    for (const [dateKey, items] of Object.entries(grouped)) {
      const [year, month, day] = dateKey.split('-');
      const date = new Date(year, month - 1, day);
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

      for (const item of items) {
        const profile = getResidentProfile(item.wardedUserId);
        const excludedAt = item.excludedAt ? new Date(item.excludedAt).toLocaleString('ko-KR') : '';

        html += `
          <div class="excluded-item" data-bio-keys='${JSON.stringify(item.bioKeys)}'>
            <div class="excluded-item-info">
              <div class="excluded-item-name">${item.userName || '알 수 없음'}</div>
              <div class="excluded-item-meta">${parseInt(month)}월 ${parseInt(day)}일 (${dayNames[date.getDay()]}) · ${item.time || ''}</div>
              <div class="excluded-item-date">제외 처리: ${excludedAt} ${item.excludedBy ? `(${item.excludedBy})` : ''}</div>
            </div>
            <button class="restore-btn" onclick="restoreOuting(this)">원복</button>
          </div>
        `;
      }
    }

    listEl.innerHTML = html;
    emptyEl.style.display = 'none';

  } catch (err) {
    console.error('[OUTING] 제외 내역 조회 실패:', err);
    listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #EF4444;">조회 실패</div>';
  }
}

/**
 * 제외된 위치 데이터 조회 (API에서 excludedYn='Y'인 데이터만)
 */
async function fetchExcludedLocations() {
  if (window.API_CONFIG?.ENABLE_MOCK_DATA) {
    console.log('[OUTING] 데모 모드 - 제외 내역 없음');
    return [];
  }

  const config = window.API_CONFIG;
  const fromDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const toDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  try {
    const mappings = await fetchMappings();
    if (!mappings || mappings.length === 0) return [];

    const allExcluded = [];

    for (const mapping of mappings) {
      const locationData = await fetchLocationPeriod(mapping.wardedUserId, fromDate, toDate);
      if (locationData && locationData.length > 0) {
        // excludedYn='Y'인 데이터만 필터
        const excluded = locationData.filter(loc => loc.excludedYn === 'Y');
        if (excluded.length > 0) {
          // 연속된 제외 데이터를 그룹화
          const groups = groupConsecutiveExcluded(excluded, mapping);
          allExcluded.push(...groups);
        }
      }
    }

    return allExcluded;
  } catch (err) {
    console.error('[OUTING] 제외 위치 조회 실패:', err);
    return [];
  }
}

/**
 * 연속된 제외 데이터를 그룹화
 */
function groupConsecutiveExcluded(locations, resident) {
  if (!locations || locations.length === 0) return [];

  // 시간순 정렬
  const sorted = [...locations].sort((a, b) =>
    new Date(a.registrationDateTime) - new Date(b.registrationDateTime)
  );

  const groups = [];
  let currentGroup = null;

  for (const loc of sorted) {
    const locTime = new Date(loc.registrationDateTime);
    const dateStr = `${locTime.getFullYear()}-${String(locTime.getMonth() + 1).padStart(2, '0')}-${String(locTime.getDate()).padStart(2, '0')}`;

    if (!currentGroup || currentGroup.dateStr !== dateStr) {
      // 새 그룹 시작
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        dateStr,
        wardedUserId: resident.wardedUserId,
        userName: resident.userName,
        bioKeys: [loc.bioKey],
        startTime: locTime,
        endTime: locTime,
        excludedBy: loc.excludedBy,
        excludedAt: loc.excludedAt
      };
    } else {
      // 같은 날짜 그룹에 추가
      currentGroup.bioKeys.push(loc.bioKey);
      currentGroup.endTime = locTime;
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  // 시간 문자열 생성
  for (const group of groups) {
    const startStr = `${String(group.startTime.getHours()).padStart(2, '0')}:${String(group.startTime.getMinutes()).padStart(2, '0')}`;
    const endStr = `${String(group.endTime.getHours()).padStart(2, '0')}:${String(group.endTime.getMinutes()).padStart(2, '0')}`;
    group.time = `${startStr}~${endStr}`;
  }

  return groups;
}

/**
 * 날짜별로 그룹화
 */
function groupExcludedByDate(items) {
  const grouped = {};
  for (const item of items) {
    if (!grouped[item.dateStr]) {
      grouped[item.dateStr] = [];
    }
    grouped[item.dateStr].push(item);
  }
  // 날짜 내림차순 정렬
  const sortedKeys = Object.keys(grouped).sort().reverse();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = grouped[key];
  }
  return result;
}

/**
 * 제외 내역 모달 닫기
 */
async function closeExcludedHistory() {
  document.getElementById('excluded-modal').classList.remove('active');

  // 데이터 다시 로드하여 뷰 업데이트 (원복 처리 반영)
  await fetchOutingData(currentYear, currentMonth);
  updateSummary();
  if (currentView === 'calendar') {
    renderCalendar();
  } else {
    renderList();
  }
}

/**
 * 외출 원복 (제외 해제)
 */
async function restoreOuting(btnEl) {
  const item = btnEl.closest('.excluded-item');
  const bioKeysStr = item.getAttribute('data-bio-keys');

  let bioKeys = [];
  try {
    bioKeys = JSON.parse(bioKeysStr);
  } catch (err) {
    console.error('[OUTING] bioKeys 파싱 실패:', err);
    return;
  }

  if (!bioKeys || bioKeys.length === 0) {
    alert('원복할 데이터가 없습니다.');
    return;
  }

  const confirmed = confirm(`이 외출 기록(${bioKeys.length}건 위치)을 원복하시겠습니까?`);
  if (!confirmed) return;

  // 데모 모드
  if (window.API_CONFIG?.ENABLE_MOCK_DATA) {
    console.log('[OUTING] 데모 모드 - 원복 시뮬레이션:', bioKeys);
    item.remove();
    return;
  }

  // 실제 API 호출
  try {
    btnEl.disabled = true;
    btnEl.textContent = '처리 중...';

    const config = window.API_CONFIG;
    const response = await fetch(`${config.BASE_URL}/watcher/locations/include`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bioKeys })
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const result = await response.json();
    console.log('[OUTING] 원복 완료:', result);

    // UI에서 해당 항목 제거
    item.remove();

    // 리스트가 비었는지 확인
    const listEl = document.getElementById('excluded-list');
    if (listEl.children.length === 0) {
      document.getElementById('excluded-empty').style.display = 'block';
    }

  } catch (err) {
    console.error('[OUTING] 원복 실패:', err);
    alert('원복 처리에 실패했습니다: ' + err.message);
    btnEl.disabled = false;
    btnEl.textContent = '원복';
  }
}

// === 외출 제외 기능 ===

/**
 * 외출 제외 처리 (외출 아님 버튼 클릭)
 * @param {Event} e - 클릭 이벤트
 * @param {number} eventIdx - 외출 이벤트 인덱스
 */
async function excludeOuting(e, eventIdx) {
  e.stopPropagation(); // 상세 토글 방지

  const detailItem = document.querySelector(`.day-detail-item[data-event-idx="${eventIdx}"]`);
  if (!detailItem) {
    console.error('[OUTING] 외출 아이템을 찾을 수 없음:', eventIdx);
    return;
  }

  const bioKeysStr = detailItem.getAttribute('data-bio-keys');
  let bioKeys = [];
  try {
    bioKeys = JSON.parse(bioKeysStr);
  } catch (err) {
    console.error('[OUTING] bioKeys 파싱 실패:', err);
    return;
  }

  if (!bioKeys || bioKeys.length === 0) {
    alert('위치 데이터가 없어 제외할 수 없습니다.');
    return;
  }

  // 확인 대화상자
  const residentName = detailItem.querySelector('.detail-name')?.textContent || '';
  const confirmed = confirm(`${residentName}의 이 외출 기록(${bioKeys.length}건 위치)을 "외출 아님"으로 처리하시겠습니까?`);
  if (!confirmed) return;

  // 데모 모드면 로컬에서만 처리
  if (window.API_CONFIG?.ENABLE_MOCK_DATA) {
    console.log('[OUTING] 데모 모드 - 외출 제외 시뮬레이션:', bioKeys);
    // UI에서 해당 항목 숨기기
    detailItem.style.opacity = '0.5';
    detailItem.innerHTML = `
      <div class="detail-header excluded">
        <div class="excluded-text">✓ 외출 아님으로 처리되었습니다 (데모)</div>
      </div>
    `;
    return;
  }

  // 실제 API 호출
  try {
    const btn = detailItem.querySelector('.exclude-outing-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '처리 중...';
    }

    const config = window.API_CONFIG;
    const watcherId = localStorage.getItem('userId') || config.WATCHER_USER_ID || 'admin';

    const response = await fetch(`${config.BASE_URL}/watcher/locations/exclude`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bioKeys: bioKeys,
        excludedBy: watcherId
      })
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const result = await response.json();
    console.log('[OUTING] 외출 제외 완료:', result);

    // 성공 시 UI 업데이트
    detailItem.style.opacity = '0.5';
    detailItem.innerHTML = `
      <div class="detail-header excluded">
        <div class="excluded-text">✓ 외출 아님으로 처리되었습니다</div>
      </div>
    `;

    // outingData에서 해당 외출 제거 (새로고침 없이 반영)
    const dateKey = window._currentDetailDateKey;
    if (dateKey && outingData[dateKey]) {
      outingData[dateKey].splice(eventIdx, 1);
      if (outingData[dateKey].length === 0) {
        delete outingData[dateKey];
      }
    }

    // 요약 카드 업데이트
    updateSummary();

    // 캘린더/리스트 뷰 업데이트
    if (currentView === 'calendar') {
      renderCalendar();
    } else {
      renderList();
    }

  } catch (err) {
    console.error('[OUTING] 외출 제외 실패:', err);
    alert('외출 제외 처리에 실패했습니다: ' + err.message);

    const btn = detailItem.querySelector('.exclude-outing-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '외출 아님';
    }
  }
}

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', initOutingReport);
