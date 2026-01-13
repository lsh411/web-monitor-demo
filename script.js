// === List controls ===
const recordListBody = document.getElementById('record-list-body');

// 현재 상세 화면에 표시 중인 레코드 정보
let currentDisplayedRecord = null;
let currentDisplayedType = null;

const refreshBtn = document.getElementById('refresh-btn');
if(refreshBtn){
  refreshBtn.addEventListener('click', async ()=>{
    console.log('Refreshing record data...');
    
    // Show loading
    const active=document.querySelector('.sidebar-menu li.active');
    const key=active?active.dataset.type:'unconfirmed';
    
    recordListBody.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">새로고침 중...</div>';
    
    try {
      await fetchRecordData();
      renderList(key);
      syncSidebarCounts();
      selectAllCb.checked=false;
    } catch (error) {
      console.error('Error refreshing data:', error);
      recordListBody.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">새로고침 실패</div>';
    }
  });
}
// === Record.html dynamic list logic ===
const sidebarMenuItems = document.querySelectorAll('.sidebar-menu li');

// Dynamic record data - will be populated from API calls
let recordData = {
  unconfirmed: [],
  confirmed: [],
  resolved: [],
  resolved_action: [],   // 조치완료
  resolved_noissue: []   // 이슈없음
};

// Event type to record mapping
const eventTypeMapping = {
  'FALL_DETECTED': {
    title: '낙상이 스마트워치로 확인 되었습니다.',
    desc: '도움이 필요하신지 확인이 필요합니다.',
    msg: '스마트워치에서 낙상 신호가 감지되었습니다.<br>입소자의 안전을 확인해 주세요.'
  },
  'HIGH_HEART_RATE_DETECTED': {
    title: '심박수가 비정상적으로 높습니다.',
    desc: '심박수가 일상생활 상태에서 120BPM 이상으로…',
    msg: '심박수가 일상생활 상태에서 120BPM 이상으로 올라갔습니다.<br>도움이 필요하신지 확인이 필요합니다.'
  },
  'LOW_HEART_RATE_DETECTED': {
    title: '심박수가 비정상적으로 낮습니다.',
    desc: '심박수가 40BPM 이하로 내려갔습니다.',
    msg: '심박수가 40BPM 이하로 내려갔습니다.<br>즉시 확인이 필요합니다.'
  }
};

// localStorage 캐시 관리 함수들
const CACHE_KEYS = {
  PROCESSED_EVENTS: 'recordData_processedEvents'
};

// === Dashboard V2 전역 캐시 (API 중복 호출 방지) ===
// 롤백: cp script.js.backup_before_cache_optimization script.js
window.dashboardCache = {
  residents: null,
  devices: null,
  events: null,
  bioData: {},        // wardedUserId별 캐시
  lastFetched: null,  // 마지막 fetch 시간
  isLoading: false,
  loadingPromise: null
};

// 통합 데이터 로더 함수 - 모든 API를 한 번만 호출하고 캐시
async function loadDashboardData(forceRefresh = false) {
  const cache = window.dashboardCache;
  const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'http://localhost:8080';
  const WATCHER_USER_ID = window.API_CONFIG?.WATCHER_USER_ID;

  // 이미 로딩 중이면 기존 Promise 대기
  if (cache.isLoading && cache.loadingPromise) {
    console.log('📦 캐시 로딩 중... 대기');
    await cache.loadingPromise;
    return cache;
  }

  // 캐시가 유효하면 재사용 (5초 이내)
  const cacheValidDuration = 5000;
  if (!forceRefresh && cache.lastFetched &&
      (Date.now() - cache.lastFetched) < cacheValidDuration &&
      cache.residents !== null) {
    console.log('📦 캐시된 데이터 사용 (', Math.round((Date.now() - cache.lastFetched) / 1000), '초 전 데이터)');
    return cache;
  }

  cache.isLoading = true;
  console.log('🔄 통합 데이터 로드 시작...');
  const startTime = Date.now();

  cache.loadingPromise = (async () => {
    try {
      // 병렬로 기본 API 호출 (1회씩만)
      const [residentsRes, devicesRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/watcher/residents?watcherUserId=${WATCHER_USER_ID}`),
        fetch(`${API_BASE_URL}/watcher/devices?watcherUserId=${WATCHER_USER_ID}`),
        fetch(`${API_BASE_URL}/watcher/event?watcherUserId=${WATCHER_USER_ID}`)
      ]);

      // 결과 파싱
      const [residentsJson, devicesJson, eventsJson] = await Promise.all([
        residentsRes.json(),
        devicesRes.json(),
        eventsRes.json()
      ]);

      cache.residents = residentsJson.code === '1000' ? residentsJson.response || [] : [];
      cache.devices = devicesJson.code === '1000' ? devicesJson.response || [] : [];
      cache.events = eventsJson.code === '1000' ? eventsJson.response || [] : [];

      console.log(`✅ 기본 API 완료: residents=${cache.residents.length}, devices=${cache.devices.length}, events=${cache.events.length}`);

      // 연결된 워치의 bioData 병렬 호출 (activeYn 필터링된 입소자만)
      const activeResidentIds = new Set(
        cache.residents
          .filter(r => r.activeYn?.toLowerCase() === 'y')
          .map(r => r.wardedUserId)
      );

      const connectedDevices = cache.devices.filter(d =>
        d.connectedResident && activeResidentIds.has(d.connectedResident.wardedUserId)
      );

      cache.bioData = {}; // 초기화

      // 외출 분석을 위해 어제~내일 날짜 범위 계산
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fromDateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      const toDateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      const bioPromises = connectedDevices.map(async device => {
        const wardedUserId = device.connectedResident.wardedUserId;
        const deviceId = device.deviceId; // 워치 ID - API 호출에 사용
        try {
          // 1. 기본 bioData 조회 (심박, 걸음수 등)
          const res = await fetch(`${API_BASE_URL}/watcher?wardedUserId=${deviceId}`);
          const json = await res.json();

          let bioData = {};
          if (json.code === '1000' && json.response) {
            bioData = json.response;
          }

          // 2. 위치 데이터는 period API로 어제~내일 범위 조회 (어제부터 이어진 외출 처리를 위해)
          try {
            const locationRes = await fetch(`${API_BASE_URL}/watcher/period?wardedUserId=${deviceId}&bioDataTypes=LOCATION&fromDate=${fromDateStr}&toDate=${toDateStr}`);
            const locationJson = await locationRes.json();
            if (locationJson.code === '1000' && locationJson.response?.location) {
              bioData.location = locationJson.response.location;
              console.log(`📍 [위치] ${device.connectedResident.userName}: period API로 ${bioData.location.length}개 로드 (${fromDateStr}~${toDateStr})`);
            }
          } catch (locErr) {
            console.error(`⚠️ 위치 period API 실패 (${deviceId}):`, locErr);
          }

          // 캐시 키는 wardedUserId(입소자 ID)로 저장 (테이블에서 조회 시 사용)
          cache.bioData[wardedUserId] = {
            ...bioData,
            residentName: device.connectedResident.userName,
            room: device.connectedResident.room || '미지정',
            wardedUserId,
            deviceId
          };
        } catch (e) {
          console.error(`❌ bioData 로드 실패 (deviceId=${deviceId}, wardedUserId=${wardedUserId}):`, e);
        }
      });
      await Promise.all(bioPromises);

      cache.lastFetched = Date.now();
      const elapsed = Date.now() - startTime;
      console.log(`✅ 통합 데이터 로드 완료 (${elapsed}ms): bioData=${Object.keys(cache.bioData).length}명`);

    } catch (e) {
      console.error('❌ 통합 데이터 로드 실패:', e);
    } finally {
      cache.isLoading = false;
      cache.loadingPromise = null;
    }
  })();

  await cache.loadingPromise;
  return cache;
}

function saveProcessedEventToCache(eventId, category, recordData) {
  try {
    const processedEvents = JSON.parse(localStorage.getItem(CACHE_KEYS.PROCESSED_EVENTS) || '{}');
    processedEvents[eventId] = {
      category: category,
      timestamp: new Date().toISOString(),
      recordData: recordData
    };
    localStorage.setItem(CACHE_KEYS.PROCESSED_EVENTS, JSON.stringify(processedEvents));
    console.log(`✅ 이벤트 ${eventId}가 ${category} 카테고리로 캐시에 저장되었습니다.`);
  } catch (error) {
    console.error('❌ 캐시 저장 오류:', error);
  }
}

function getProcessedEventFromCache(eventId) {
  try {
    const processedEvents = JSON.parse(localStorage.getItem(CACHE_KEYS.PROCESSED_EVENTS) || '{}');
    return processedEvents[eventId] || null;
  } catch (error) {
    console.error('❌ 캐시 읽기 오류:', error);
    return null;
  }
}

function removeProcessedEventFromCache(eventId) {
  try {
    const processedEvents = JSON.parse(localStorage.getItem(CACHE_KEYS.PROCESSED_EVENTS) || '{}');
    if (processedEvents[eventId]) {
      delete processedEvents[eventId];
      localStorage.setItem(CACHE_KEYS.PROCESSED_EVENTS, JSON.stringify(processedEvents));
      console.log(`✅ 이벤트 ${eventId}가 캐시에서 삭제되었습니다.`);
    }
  } catch (error) {
    console.error('❌ 캐시 삭제 오류:', error);
  }
}

function clearOldCacheEntries() {
  try {
    const processedEvents = JSON.parse(localStorage.getItem(CACHE_KEYS.PROCESSED_EVENTS) || '{}');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    let cleanedCount = 0;
    Object.keys(processedEvents).forEach(eventId => {
      const cacheEntry = processedEvents[eventId];
      if (new Date(cacheEntry.timestamp) < oneDayAgo) {
        delete processedEvents[eventId];
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      localStorage.setItem(CACHE_KEYS.PROCESSED_EVENTS, JSON.stringify(processedEvents));
      console.log(`🧹 ${cleanedCount}개의 오래된 캐시 항목을 정리했습니다.`);
    }
  } catch (error) {
    console.error('❌ 캐시 정리 오류:', error);
  }
}

function clearAllCache() {
  try {
    localStorage.removeItem(CACHE_KEYS.PROCESSED_EVENTS);
    console.log('🗑️ 모든 캐시 데이터가 초기화되었습니다.');
    return true;
  } catch (error) {
    console.error('❌ 캐시 초기화 오류:', error);
    return false;
  }
}

function getCacheInfo() {
  try {
    const processedEvents = JSON.parse(localStorage.getItem(CACHE_KEYS.PROCESSED_EVENTS) || '{}');
    const eventCount = Object.keys(processedEvents).length;
    
    console.log(`📊 캐시 정보:`);
    console.log(`- 저장된 이벤트 수: ${eventCount}개`);
    
    if (eventCount > 0) {
      const categories = {};
      Object.values(processedEvents).forEach(event => {
        categories[event.category] = (categories[event.category] || 0) + 1;
      });
      
      console.log('- 카테고리별 분포:', categories);
      console.log('- 상세 데이터:', processedEvents);
    }
    
    return { eventCount, processedEvents };
  } catch (error) {
    console.error('❌ 캐시 정보 조회 오류:', error);
    return null;
  }
}

// Fetch real record data from API
async function fetchRecordData() {
  console.log('🔄 Fetching record data...');

  try {
    // 오래된 캐시 항목 정리
    clearOldCacheEntries();

    // dashboardCache에 bioData 로드 (위치 정보 등을 위해)
    if (typeof loadDashboardData === 'function') {
      await loadDashboardData();
      console.log('📍 dashboardCache bioData 로드됨:', Object.keys(window.dashboardCache?.bioData || {}));
    }
    
    // Get mappings to get list of residents
    const mappings = await fetchMappings();
    console.log('📋 받은 매핑 데이터:', mappings);
    console.log('📊 매핑 데이터 개수:', mappings.length);
    
    if (mappings.length === 0) {
      const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
      if (ENABLE_MOCK_DATA) {
        console.log('🎭 목업 모드: 매핑이 없어서 샘플 데이터 생성');
        generateSampleRecordData();
      } else {
        console.log('🌐 실제 API 모드: 매핑이 없음. 빈 상태 유지');
        recordData = {
          unconfirmed: [],
          confirmed: [],
          resolved: [],
          resolved_action: [],
          resolved_noissue: []
        };
      }
      return;
    }

    // Update global wardedUsers with mapping data
    wardedUsers = mappings.map(mapping => ({
      wardedUserId: mapping.wardedUserId,
      userName: mapping.userName,
      age: mapping.age,
      profileUrl: mapping.userProfileUrl,
      gender: mapping.gender,
      phoneNo: mapping.phoneNo,
      room: mapping.room || '미지정'
    }));
    console.log('✅ wardedUsers populated from real mappings:', wardedUsers.length, 'users');

    // Get events data
    const events = await fetchEvents();
    console.log('Events fetched:', events);

    // Reset record data
    recordData = {
      unconfirmed: [],
      confirmed: [],
      resolved: [],
      resolved_action: [],
      resolved_noissue: []
    };

    // If no events, handle based on mode
    if (events.length === 0) {
      const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
      if (ENABLE_MOCK_DATA) {
        console.log('🎭 목업 모드: 이벤트가 없어서 샘플 이벤트 생성');
        await generateSampleEventsFromMappings(mappings);
      } else {
        console.log('🌐 실제 API 모드: 이벤트가 없음. 빈 상태 유지');
        recordData = {
          unconfirmed: [],
          confirmed: [],
          resolved: [],
          resolved_action: [],
          resolved_noissue: []
        };
      }
      return;
    }

    let cacheHitCount = 0;

    // Process events and create record entries
    console.log('🔍 이벤트 처리 시작. 총 이벤트 수:', events.length);
    console.log('🔍 매핑된 wardedUserId 목록:', mappings.map(m => m.wardedUserId));
    console.log('🔍 이벤트 wardedUserId 목록:', events.map(e => e.wardedUserId));

    for (const event of events) {
      const resident = mappings.find(m => m.wardedUserId === event.wardedUserId);
      if (!resident) {
        console.log(`⚠️ 이벤트 ${event.eventKey || event.eventId} 매핑 없음: wardedUserId=${event.wardedUserId}`);
        continue;
      }

      // dashboardCache에서 bioData 가져오기 (대시보드에서 이미 로드됨)
      // bioData 키는 originalWardedUserId(resident_xxx)이므로 변환 필요
      const bioDataKey = resident.originalWardedUserId || event.wardedUserId;
      const cachedBioData = window.dashboardCache?.bioData?.[bioDataKey] || null;
      const record = await createRecordFromEvent(event, resident, cachedBioData);

      // eventKey 저장 (API 응답에서 eventKey 사용)
      record.eventKey = event.eventKey;

      // DB 상태 필드 우선 사용 (백엔드 API에서 받은 status)
      const dbStatus = event.status;

      // DB 상태가 있으면 DB 상태 우선, 없으면 캐시 확인
      if (dbStatus && dbStatus !== 'UNCONFIRMED') {
        // DB에 CONFIRMED 또는 RESOLVED 상태가 있으면 해당 카테고리로 분류
        if (dbStatus === 'CONFIRMED') {
          // 확인자 정보 추가
          record.confirmedBy = event.confirmedBy;
          record.confirmedAt = event.confirmedAt;
          record.reply = { written: false, author: event.confirmedBy || '', avatar: '', content: event.note || '' };
          recordData.confirmed.push(record);
          console.log(`📋 이벤트 ${event.eventKey} DB상태 CONFIRMED로 분류`);
        } else if (dbStatus === 'RESOLVED_ACTION') {
          // 조치완료 - 실제 위험 확인 후 조치한 경우
          record.resolvedBy = event.resolvedBy;
          record.resolvedAt = event.resolvedAt;
          record.resolveType = 'action';
          record.reply = { written: true, author: event.resolvedBy || '관리자', avatar: 'assets/helper_kim.png', content: event.note || '상황 확인 및 조치 완료되었습니다.' };
          recordData.resolved_action.push(record);
          console.log(`📋 이벤트 ${event.eventKey} DB상태 RESOLVED_ACTION으로 분류 (조치완료)`);
        } else if (dbStatus === 'RESOLVED_NOISSUE') {
          // 이슈없음 - 오탐지 또는 이슈 없음으로 처리한 경우
          record.resolvedBy = event.resolvedBy;
          record.resolvedAt = event.resolvedAt;
          record.resolveType = 'noissue';
          record.reply = { written: true, author: event.resolvedBy || '관리자', avatar: 'assets/helper_kim.png', content: event.note || '이슈 없음' };
          recordData.resolved_noissue.push(record);
          console.log(`📋 이벤트 ${event.eventKey} DB상태 RESOLVED_NOISSUE로 분류 (이슈없음)`);
        } else if (dbStatus === 'RESOLVED') {
          // 기존 RESOLVED 데이터 (레거시) - 조치완료로 기본 분류
          record.resolvedBy = event.resolvedBy;
          record.resolvedAt = event.resolvedAt;
          record.resolveType = 'action';
          record.reply = { written: true, author: event.resolvedBy || '관리자', avatar: 'assets/helper_kim.png', content: event.note || '상황 확인 및 조치 완료되었습니다.' };
          recordData.resolved_action.push(record);
          console.log(`📋 이벤트 ${event.eventKey} DB상태 RESOLVED(레거시)로 분류 → 조치완료로 이동`);
        }
      } else {
        // DB 상태가 UNCONFIRMED이거나 없으면 미확인으로 분류
        // 캐시 로직 비활성화 - DB 상태를 신뢰함
        /*
        const cachedStatus = getProcessedEventFromCache(event.eventId || event.eventKey);

        if (cachedStatus) {
          // 캐시에서 처리 상태 복원
          if (cachedStatus.recordData && cachedStatus.recordData.reply) {
            record.reply = cachedStatus.recordData.reply;
          }
          recordData[cachedStatus.category].push(record);
          cacheHitCount++;
          console.log(`🔄 이벤트 ${event.eventKey}를 캐시에서 ${cachedStatus.category}로 복원`);
        } else {
        */
        // 새로운 이벤트는 미확인으로 분류
        recordData.unconfirmed.push(record);
        console.log(`📋 이벤트 ${event.eventKey} 미확인으로 분류`);
        // }
      }
    }

    // Sort by time (most recent first)
    Object.keys(recordData).forEach(key => {
      recordData[key].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });

    console.log('✅ Record data populated:', recordData);
    console.log(`🔄 ${cacheHitCount}개의 레코드가 캐시에서 복원되었습니다.`);

  } catch (error) {
    console.error('Error fetching record data:', error);
    // Only fallback to sample data if in mock mode
    if (window.API_CONFIG?.ENABLE_MOCK_DATA) {
      generateSampleRecordData();
    } else {
      // In real API mode, show empty state or error message
      recordData = {
        unconfirmed: [],
        confirmed: [],
        resolved: [],
        resolved_action: [],
        resolved_noissue: []
      };
      console.log('Real API mode: No fallback to mock data');
    }
  }
}

// Generate sample record data for testing when API is not available
function generateSampleRecordData() {
  console.log('Generating sample record data for testing...');
  
  // Update global wardedUsers with mock user data
  wardedUsers = Object.values(mockData.users).map(user => ({
    wardedUserId: user.wardedUserId,
    userName: user.userName,
    age: user.age,
    profileUrl: user.userProfileUrl,
    room: mockData.mappings.find(m => m.wardedUserId === user.wardedUserId)?.room || '미지정'
  }));
  console.log('✅ wardedUsers populated from mock data:', wardedUsers.length, 'users');
  
  const now = new Date();
  const sampleEvents = [
    {
      eventId: 'sample_1',
      wardedUserId: 'ward001',
      eventType: 'HIGH_HEART_RATE_DETECTED',
      registrationDateTime: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 min ago
      status: 'UNCONFIRMED'
    },
    {
      eventId: 'sample_2', 
      wardedUserId: 'ward002',
      eventType: 'FALL_DETECTED',
      registrationDateTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      status: 'CONFIRMED'
    },
    {
      eventId: 'sample_3',
      wardedUserId: 'ward003', 
      eventType: 'LOW_HEART_RATE_DETECTED',
      registrationDateTime: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      status: 'RESOLVED'
    }
  ];

  recordData = {
    unconfirmed: [],
    confirmed: [],
    resolved: [],
    resolved_action: [],
    resolved_noissue: []
  };

  // Create sample records using mock data
  sampleEvents.forEach(event => {
    const mockResident = mockData.users[event.wardedUserId] || {
      userName: 'Sample User',
      userProfileUrl: 'assets/status_01.png',
      room: '101호'
    };

    const record = {
      time: new Date(event.registrationDateTime).toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      }),
      img: mockResident.userProfileUrl || 'assets/status_01.png',
      name: mockResident.userName,
      title: eventTypeMapping[event.eventType]?.title || '알 수 없는 이벤트',
      desc: eventTypeMapping[event.eventType]?.desc || '상세 정보가 없습니다.',
      right: timeAgo(event.registrationDateTime),
      timestamp: event.registrationDateTime,
      eventId: event.eventKey || event.eventId,
      wardedUserId: event.wardedUserId,
      detail: {
        msg: eventTypeMapping[event.eventType]?.msg || '이벤트가 감지되었습니다.',
        caller: mockResident.userName,
        location: '1층 거실',
        map: 'assets/map_101.png',
        vitals: [
          { label: '심박수', value: '120 bpm', img: 'assets/graph_hr.png', time: '방금' },
          { label: '산소포화도', value: '95%', img: 'assets/graph_o2.png', time: '5분전' },
          { label: '걸음수', value: '3,450', img: 'assets/graph_steps.png', time: '오늘' }
        ]
      }
    };

    // Add status-specific properties
    if (event.status === 'CONFIRMED') {
      record.manager = '담당자';
      record.progress = '확인 중';
      record.reply = { written: false, author: '', avatar: '', content: '' };
    } else if (event.status === 'RESOLVED') {
      record.manager = '담당자';
      record.progress = '완료';
      record.reply = {
        written: true,
        author: '관리자',
        avatar: 'assets/helper_kim.png',
        content: '상황 확인 및 조치 완료되었습니다.'
      };
    }

    // Add to appropriate category
    if (event.status === 'UNCONFIRMED') {
      recordData.unconfirmed.push(record);
    } else if (event.status === 'CONFIRMED') {
      recordData.confirmed.push(record);
    } else if (event.status === 'RESOLVED') {
      recordData.resolved.push(record);
    }
  });

  console.log('Sample record data generated:', recordData);
}

// Generate sample events from existing mappings for testing
async function generateSampleEventsFromMappings(mappings) {
  console.log('Creating sample events from existing mappings...');
  
  // Update global wardedUsers with mapping data
  wardedUsers = mappings.map(mapping => ({
    wardedUserId: mapping.wardedUserId,
    userName: mapping.userName,
    age: mapping.age,
    profileUrl: mapping.userProfileUrl,
    gender: mapping.gender,
    phoneNo: mapping.phoneNo,
    room: mapping.room || '미지정'
  }));
  console.log('✅ wardedUsers populated from sample events:', wardedUsers.length, 'users');
  
  const eventTypes = ['HIGH_HEART_RATE_DETECTED', 'FALL_DETECTED', 'LOW_HEART_RATE_DETECTED'];
  const statuses = ['UNCONFIRMED', 'CONFIRMED', 'RESOLVED'];
  const now = new Date();

  recordData = {
    unconfirmed: [],
    confirmed: [],
    resolved: [],
    resolved_action: [],
    resolved_noissue: []
  };

  // Create 1-2 events per resident (up to first 5 residents)
  const limitedMappings = mappings.slice(0, 5);
  
  for (let i = 0; i < limitedMappings.length; i++) {
    const mapping = limitedMappings[i];
    const eventType = eventTypes[i % eventTypes.length];
    const status = statuses[i % statuses.length];
    
    const sampleEvent = {
      eventId: `sample_${i}`,
      wardedUserId: mapping.wardedUserId,
      eventType: eventType,
      registrationDateTime: new Date(now.getTime() - (i * 30 + 10) * 60 * 1000).toISOString(),
      status: status
    };

    try {
      const bioData = await fetchLatestBioData(mapping.wardedUserId);
      const record = await createRecordFromEvent(sampleEvent, mapping, bioData);
      
      if (status === 'UNCONFIRMED') {
        recordData.unconfirmed.push(record);
      } else if (status === 'CONFIRMED') {
        recordData.confirmed.push(record);
      } else if (status === 'RESOLVED') {
        recordData.resolved.push(record);
      }
    } catch (error) {
      console.error(`Error creating record for ${mapping.wardedUserId}:`, error);
    }
  }

  console.log('Sample events from mappings created:', recordData);
}

// Create record entry from event data
async function createRecordFromEvent(event, resident, bioData) {
  console.log('📝 createRecordFromEvent - resident:', resident);
  console.log('📝 createRecordFromEvent - bioData:', bioData);
  console.log('📝 createRecordFromEvent - event:', event);

  const eventTime = new Date(event.registrationDateTime);
  const timeStr = eventTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const timeAgoStr = timeAgo(event.registrationDateTime);
  
  // Get configuration
  const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
  
  // Get event type details
  const eventTypeDetails = eventTypeMapping[event.eventType] || {
    title: '알 수 없는 이벤트',
    desc: '상세 정보가 없습니다.',
    msg: '이벤트가 감지되었습니다.'
  };

  // Create vitals array from bio data
  const vitals = [];
  
  if (bioData) {
    if (bioData.heartBeat && bioData.heartBeat.length > 0) {
      vitals.push({
        label: '심박수',
        value: `${bioData.heartBeat[0].heartBeat} bpm`,
        img: 'assets/graph_hr.png',
        time: timeAgo(bioData.heartBeat[0].registrationDateTime)
      });
    }
    
    if (bioData.oxygenStatus && bioData.oxygenStatus.length > 0) {
      vitals.push({
        label: '산소포화도',
        value: `${bioData.oxygenStatus[0].oxygenSaturation}%`,
        img: 'assets/graph_o2.png',
        time: timeAgo(bioData.oxygenStatus[0].registrationDateTime)
      });
    } else if (ENABLE_MOCK_DATA) {
      vitals.push({
        label: '산소포화도',
        value: `${95 + Math.floor(Math.random() * 5)}%`,
        img: 'assets/graph_o2.png',
        time: '방금 전'
      });
    }
    
    if (bioData.steps && bioData.steps.length > 0 && bioData.steps[0].stepsDaily != null) {
      vitals.push({
        label: '걸음수',
        value: bioData.steps[0].stepsDaily.toLocaleString(),
        img: 'assets/graph_steps.png',
        time: dateAgo(bioData.steps[0].step_date)
      });
    } else {
      // 걸음수 데이터가 없어도 카드는 표시
      vitals.push({
        label: '걸음수',
        value: '--',
        img: 'assets/graph_steps.png',
        time: '데이터 없음'
      });
    }
  } else {
    // bioData가 없는 경우에도 기본 카드들 표시
    vitals.push({
      label: '심박수',
      value: '--',
      img: 'assets/graph_hr.png',
      time: '데이터 없음'
    });
    vitals.push({
      label: '걸음수',
      value: '--',
      img: 'assets/graph_steps.png',
      time: '데이터 없음'
    });
  }

  // 수면 데이터 제거됨 - 걸음수는 이미 위에서 추가됨

  // Get location from bio data or use default
  let location = '미확인';
  if (bioData && bioData.location && bioData.location.length > 0) {
    const lat = bioData.location[0].latitude;
    const lng = bioData.location[0].longitude;
    location = await getLocationName(lat, lng);
  } else {
    // Use default locations based on room
    const roomLocations = {
      '101호': '1층 거실',
      '102호': '1층 화장실', 
      '103호': '1층 운동실',
      '104호': '1층 식당',
      '105호': '1층 복도',
      '201호': '2층 거실',
      '202호': '2층 욕실',
      '203호': '2층 복도'
    };
    location = roomLocations[resident.room] || '시설 내';
  }

  // 프로필 이미지 결정: userProfileUrl이 없으면 profileEmoji+profileColor로 대체
  let profileImg = resident.userProfileUrl;
  if (!profileImg && resident.profileEmoji && resident.profileColor) {
    // 이모지+색상 조합으로 프로필 표시 (CSS로 처리)
    profileImg = `emoji:${resident.profileEmoji}:${resident.profileColor}`;
  }
  if (!profileImg) {
    profileImg = 'assets/status_01.png';
  }

  const record = {
    time: timeStr,
    img: profileImg,
    profileEmoji: resident.profileEmoji,
    profileColor: resident.profileColor,
    name: resident.userName,
    title: eventTypeDetails.title,
    desc: eventTypeDetails.desc,
    right: timeAgoStr,
    timestamp: event.registrationDateTime,
    eventId: event.eventKey || event.eventId, // API는 eventKey 사용, 샘플 데이터는 eventId 사용
    wardedUserId: event.wardedUserId,
    detail: {
      msg: eventTypeDetails.msg,
      caller: resident.userName,
      location: location,
      locationCoords: bioData && bioData.location && bioData.location.length > 0 ? {
        lat: bioData.location[0].latitude,
        lng: bioData.location[0].longitude
      } : null,
      map: 'assets/map_101.png', // Default map
      vitals: vitals
    }
  };

  // Add manager info for confirmed/resolved events
  if (event.status === 'CONFIRMED') {
    record.manager = '담당자';
    record.progress = '확인 중';
    record.reply = { written: false, author: '', avatar: '', content: '' };
  } else if (event.status === 'RESOLVED') {
    record.manager = '담당자';
    record.progress = '완료';
    record.reply = {
      written: true,
      author: '관리자',
      avatar: 'assets/helper_kim.png',
      content: '상황 확인 및 조치 완료되었습니다.'
    };
  }

  return record;
}

// Initialize record data on page load
async function initializeRecordData() {
  console.log('Initializing record data...');

  // Show loading message
  if (recordListBody) {
    recordListBody.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">데이터를 불러오는 중...</div>';
  }

  try {
    await fetchRecordData();

    // URL에서 eventKey 파라미터 확인 (토스트 알림에서 전달됨)
    const urlParams = new URLSearchParams(window.location.search);
    const targetEventKey = urlParams.get('eventKey');

    // Render initial list
    renderList('unconfirmed');
    syncSidebarCounts();

    // Select record based on eventKey or first record
    setTimeout(() => {
      if (targetEventKey) {
        // eventKey로 해당 항목 찾아서 선택
        selectRecordByEventKey(targetEventKey);
      } else {
        // 기본: 첫 번째 항목 선택
        const firstRow = recordListBody.querySelector('.record-row');
        if (firstRow) {
          firstRow.click();
        }
      }
    }, 100);

  } catch (error) {
    console.error('Error initializing record data:', error);
    if (recordListBody) {
      recordListBody.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">데이터 로드 실패</div>';
    }
  }
}

// eventKey로 해당 레코드를 찾아 선택하는 함수
function selectRecordByEventKey(eventKey) {
  console.log('🔍 eventKey로 레코드 찾기:', eventKey);

  // 모든 카테고리에서 해당 eventKey를 가진 레코드 찾기 (서브탭 포함)
  const categories = ['unconfirmed', 'confirmed', 'resolved_action', 'resolved_noissue'];
  let targetCategory = null;

  for (const category of categories) {
    const found = recordData[category].find(r =>
      r.eventId === eventKey || r.eventKey === eventKey
    );
    if (found) {
      targetCategory = category;
      break;
    }
  }

  if (targetCategory) {
    console.log('✅ 레코드 발견, 카테고리:', targetCategory);
    // 해당 메뉴로 전환하고 항목 선택
    switchToMenuAndSelectItem(targetCategory, eventKey);
  } else {
    console.log('⚠️ eventKey에 해당하는 레코드를 찾지 못함, 첫 번째 항목 선택');
    const firstRow = recordListBody.querySelector('.record-row');
    if (firstRow) {
      firstRow.click();
    }
  }
}

// ===== GLOBAL API FUNCTIONS (moved from DOMContentLoaded) =====

// AWS API 호출 함수들
async function fetchMappings() {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const WATCHER_USER_ID = window.API_CONFIG?.WATCHER_USER_ID || 'watcher_001';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;

    console.log('🔍 fetchMappings 호출됨');
    console.log('📡 API_BASE_URL:', API_BASE_URL);
    console.log('🎭 ENABLE_MOCK_DATA:', ENABLE_MOCK_DATA);

    // 데모 컨트롤러가 있으면 우선적으로 사용
    if (window.demoController && typeof window.demoController.getDemoMappings === 'function') {
        console.log('🎮 데모 컨트롤러 모드: 26명 데이터 반환');
        return window.demoController.getDemoMappings();
    }

    if (ENABLE_MOCK_DATA) {
        console.log('🎭 목업 모드: mockData.mappings 반환');
        return mockData.mappings;
    }

    console.log('🌐 실제 API 호출 시작 (B2B 방식: residents + devices)...');
    try {
        // B2B 방식: residents와 devices API를 사용하여 매핑 구성
        const [residentsRes, devicesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/watcher/residents?watcherUserId=${WATCHER_USER_ID}`, {
                headers: {'Content-Type': 'application/json'}
            }),
            fetch(`${API_BASE_URL}/watcher/devices?watcherUserId=${WATCHER_USER_ID}`, {
                headers: {'Content-Type': 'application/json'}
            })
        ]);

        const residentsData = await residentsRes.json();
        const devicesData = await devicesRes.json();

        console.log('📋 Residents data:', residentsData);
        console.log('📋 Devices data:', devicesData);
        console.log('📋 Residents wardedUserIds:', residentsData.response?.map(r => r.wardedUserId));
        console.log('📋 ConnectedResident wardedUserIds:', devicesData.response?.filter(d => d.connectedResident).map(d => d.connectedResident.wardedUserId));

        if (residentsData.code === "1000" && devicesData.code === "1000") {
            const residents = residentsData.response || [];
            const devices = devicesData.response || [];

            // 연결된 디바이스에서 매핑 생성
            // deviceId가 카카오 ID 형태이므로 이벤트의 wardedUserId와 매칭됨
            const mappings = devices
                .filter(d => d.connectedResident)
                .map(d => {
                    const resident = d.connectedResident;
                    // residents에서 추가 정보 가져오기
                    const residentInfo = residents.find(r => r.wardedUserId === resident.wardedUserId) || {};
                    return {
                        // deviceId를 wardedUserId로 사용 (이벤트 매칭용)
                        wardedUserId: d.deviceId,
                        // 원래 wardedUserId도 보관
                        originalWardedUserId: resident.wardedUserId,
                        userName: resident.userName || residentInfo.userName,
                        age: resident.age || residentInfo.age,
                        userProfileUrl: resident.userProfileUrl || residentInfo.userProfileUrl,
                        profileEmoji: resident.profileEmoji || residentInfo.profileEmoji,
                        profileColor: resident.profileColor || residentInfo.profileColor,
                        gender: resident.gender || residentInfo.gender,
                        phoneNo: resident.phoneNo || residentInfo.phoneNo,
                        room: resident.room || residentInfo.room || '미지정',
                        deviceId: d.deviceId,
                        activeYn: 'y'
                    };
                });

            console.log('✅ B2B 방식 매핑 생성 완료:', mappings.length, '명 (deviceId를 wardedUserId로 사용)');
            console.log('📋 매핑 wardedUserId(deviceId) 목록:', mappings.map(m => m.wardedUserId));
            return mappings;
        } else {
            console.warn('⚠️ API returned error code:', residentsData.code, devicesData.code);
        }
    } catch (error) {
        console.error('❌ Error fetching mappings:', error.message);
        if (window.API_CONFIG?.SHOW_API_ERRORS) {
            console.log('🔧 실제 API 연결 실패. 실제 서버가 실행 중인지 확인하세요.');
        }
    }
    return [];
}

async function fetchEvents() {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const WATCHER_USER_ID = window.API_CONFIG?.WATCHER_USER_ID || 'watcher_001';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;

    // 데모 컨트롤러가 있으면 우선적으로 사용
    if (window.demoController && typeof window.demoController.getDemoEvents === 'function') {
        console.log('🎮 데모 컨트롤러 모드: 이벤트 데이터 반환');
        return await window.demoController.getDemoEvents();
    }

    if (ENABLE_MOCK_DATA) {
        return mockData.events;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/watcher/event?watcherUserId=${WATCHER_USER_ID}`, {
            headers: {'Content-Type': 'application/json'}
        });
        const data = await response.json();
        if (data.code === "1000") {
            return data.response;
        }
    } catch (error) {
        console.error('Error fetching events:', error);
    }
    return [];
}

// 이벤트 상태 변경 API 함수들
async function confirmEventAPI(eventKey, watcherUserId, note = '') {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;

    console.log(`📞 이벤트 확인 API 호출: ${eventKey}`);

    if (ENABLE_MOCK_DATA) {
        console.log('🎭 목업 모드: 확인 처리 시뮬레이션');
        return { success: true, mockMode: true };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/watcher/event/${eventKey}/confirm`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: watcherUserId, note })
        });

        const data = await response.json();
        console.log('확인 API 응답:', data);

        if (data.code === "1000") {
            return { success: true, data: data.response };
        } else {
            console.error('확인 API 오류:', data.message);
            return { success: false, error: data.message };
        }
    } catch (error) {
        console.error('확인 API 호출 실패:', error);
        return { success: false, error: error.message };
    }
}

async function resolveEventAPI(eventKey, watcherUserId, note = '', resolveType = 'action') {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;

    // resolveType 변환: 'action' -> 'ACTION', 'noissue' -> 'NOISSUE'
    const resolveTypeUpper = resolveType === 'noissue' ? 'NOISSUE' : 'ACTION';

    console.log(`📞 이벤트 해결 API 호출: ${eventKey}, resolveType: ${resolveTypeUpper}`);

    if (ENABLE_MOCK_DATA) {
        console.log('🎭 목업 모드: 해결 처리 시뮬레이션');
        return { success: true, mockMode: true };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/watcher/event/${eventKey}/resolve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: watcherUserId, note, resolveType: resolveTypeUpper })
        });

        const data = await response.json();
        console.log('해결 API 응답:', data);

        if (data.code === "1000") {
            return { success: true, data: data.response };
        } else {
            console.error('해결 API 오류:', data.message);
            return { success: false, error: data.message };
        }
    } catch (error) {
        console.error('해결 API 호출 실패:', error);
        return { success: false, error: error.message };
    }
}

async function unconfirmEventAPI(eventKey) {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;

    console.log(`📞 이벤트 미확인 복귀 API 호출: ${eventKey}`);

    if (ENABLE_MOCK_DATA) {
        console.log('🎭 목업 모드: 미확인 복귀 시뮬레이션');
        return { success: true, mockMode: true };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/watcher/event/${eventKey}/unconfirm`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        console.log('미확인 복귀 API 응답:', data);

        if (data.code === "1000") {
            return { success: true, data: data.response };
        } else {
            console.error('미확인 복귀 API 오류:', data.message);
            return { success: false, error: data.message };
        }
    } catch (error) {
        console.error('미확인 복귀 API 호출 실패:', error);
        return { success: false, error: error.message };
    }
}

// 전역 스코프에 상태 변경 API 함수 노출
window.confirmEventAPI = confirmEventAPI;
window.resolveEventAPI = resolveEventAPI;
window.unconfirmEventAPI = unconfirmEventAPI;

async function fetchLatestBioData(wardedUserId) {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
    
    // 데모 컨트롤러가 있으면 우선적으로 사용
    if (window.demoController && typeof window.demoController.getDemoBioData === 'function') {
        console.log('🎮 데모 컨트롤러 모드: 바이오 데이터 반환');
        return window.demoController.getDemoBioData(wardedUserId);
    }
    
    if (ENABLE_MOCK_DATA) {
        // 목업 데이터에 약간의 변동 추가
        const baseBio = mockData.bioData[wardedUserId];
        if (!baseBio) return null;
        
        return {
            ...baseBio,
            heartBeat: [{ heartBeat: baseBio.heartBeat[0].heartBeat + Math.floor(Math.random() * 10 - 5), registrationDateTime: new Date().toISOString() }],
            oxygenStatus: [],
            steps: [{ stepsDaily: baseBio.steps[0].stepsDaily + Math.floor(Math.random() * 100), step_date: new Date().toISOString().split('T')[0] }]
        };
    }
    
    try {
        const url = `${API_BASE_URL}/watcher?wardedUserId=${wardedUserId}`;
        console.log('Fetching bio data from:', url);
        
        const response = await fetch(url, { headers: {'Content-Type': 'application/json'} });
        console.log('Bio data response status:', response.status);
        
        const data = await response.json();
        console.log(`Bio data for ${wardedUserId}:`, data);
        
        if (data.code === "1000") {
            console.log('Bio data response:', data.response);
            
            // bodyTemperature가 비어있으면 period API로 피부온 데이터 가져오기
            if ((!data.response.bodyTemperature || data.response.bodyTemperature.length === 0)) {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const fromDate = today.toISOString().split('T')[0];
                const toDate = tomorrow.toISOString().split('T')[0];
                
                const tempUrl = `${API_BASE_URL}/watcher/period?wardedUserId=${wardedUserId}&bioDataTypes=BODY_TEMPERATURE&fromDate=${fromDate}&toDate=${toDate}`;
                console.log('Fetching temperature data from period API:', tempUrl);
                
                try {
                    const tempResponse = await fetch(tempUrl, { headers: {'Content-Type': 'application/json'} });
                    const tempData = await tempResponse.json();
                    
                    if (tempData.code === "1000" && tempData.response && tempData.response.bodyTemperature) {
                        console.log(`Temperature data found: ${tempData.response.bodyTemperature.length} records`);
                        data.response.bodyTemperature = tempData.response.bodyTemperature;
                    }
                } catch (tempError) {
                    console.error('Error fetching temperature data:', tempError);
                }
            }
            
            return data.response;
        } else {
            console.log('API error:', data);
        }
    } catch (error) {
        console.error('Error fetching bio data:', error);
    }
    return null;
}

// 전역 스코프에 함수들 즉시 노출 (데모 모드를 위해)
window.fetchMappings = fetchMappings;
window.fetchEvents = fetchEvents;
window.fetchLatestBioData = fetchLatestBioData;
window.fetchTodayLocationData = fetchTodayLocationData;

// 목업 데이터 (개발/테스트용)
const mockData = {
    mappings: [
        { wardedUserId: 'ward001', activeYn: 'o', room: '101호', userName: '김영수', age: '77', userProfileUrl: 'assets/status_01.png' },
        { wardedUserId: 'ward002', activeYn: 'o', room: '101호', userName: '김순자', age: '84', userProfileUrl: 'assets/status_02.png' },
        { wardedUserId: 'ward003', activeYn: 'o', room: '101호', userName: '신영자', age: '82', userProfileUrl: 'assets/status_03.png' },
        { wardedUserId: 'ward004', activeYn: 'o', room: '102호', userName: '김정석', age: '78', userProfileUrl: 'assets/status_04.png' },
        { wardedUserId: 'ward005', activeYn: 'o', room: '102호', userName: '서영숙', age: '84', userProfileUrl: 'assets/status_05.png' }
    ],
    users: {
        'ward001': { wardedUserId: 'ward001', userName: '김영수', age: '77', userProfileUrl: 'assets/status_01.png' },
        'ward002': { wardedUserId: 'ward002', userName: '김순자', age: '84', userProfileUrl: 'assets/status_02.png' },
        'ward003': { wardedUserId: 'ward003', userName: '신영자', age: '82', userProfileUrl: 'assets/status_03.png' },
        'ward004': { wardedUserId: 'ward004', userName: '김정석', age: '78', userProfileUrl: 'assets/status_04.png' },
        'ward005': { wardedUserId: 'ward005', userName: '서영숙', age: '84', userProfileUrl: 'assets/status_05.png' }
    },
    bioData: {
        'ward001': {
            heartBeat: [{ heartBeat: 68 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
            oxygenStatus: [],
            steps: [{ stepsDaily: 3482 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
        },
        'ward002': {
            heartBeat: [{ heartBeat: 72 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
            oxygenStatus: [],
            steps: [{ stepsDaily: 4200 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
        },
        'ward003': {
            heartBeat: [{ heartBeat: 70 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
            oxygenStatus: [],
            steps: [{ stepsDaily: 3800 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
        },
        'ward004': {
            heartBeat: [{ heartBeat: 65 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
            oxygenStatus: [],
            steps: [{ stepsDaily: 2100 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
        },
        'ward005': {
            heartBeat: [{ heartBeat: 69 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
            oxygenStatus: [],
            steps: [{ stepsDaily: 3300 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
        }
    },
    events: {
        'FALL_DETECTED': {
            eventId: 'event_001',
            eventType: 'FALL_DETECTED',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        'HIGH_HEART_RATE_DETECTED': {
            eventId: 'event_002',
            eventType: 'HIGH_HEART_RATE_DETECTED',
            timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString()
        },
        'LOW_HEART_RATE_DETECTED': {
            eventId: 'event_003',
            eventType: 'LOW_HEART_RATE_DETECTED',
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
        }
    }
};

// Global utility functions

/**
 * Estimate core body temperature (°C) from skin temp, air temp, and heart rate.
 * Model: Tcore = Tskin + a + b*(Tskin - Tair) + c*(HR - HR0)
 * Adjusted parameters to compensate for watch ambient temperature being higher than actual
 * Defaults: a=4.3, b=0.30, c=0.011, HR0=60 bpm
 */
function estimateCoreTemp3(skinTemp, airTemp, heartRate, opts = {}) {
    const a   = Number.isFinite(opts.a)   ? opts.a   : 4.3;  // Middle ground between 3.8 and 4.8
    const b   = Number.isFinite(opts.b)   ? opts.b   : 0.30; // Middle ground between 0.25 and 0.35
    const c   = Number.isFinite(opts.c)   ? opts.c   : 0.011; // Middle ground between 0.010 and 0.012
    const HR0 = Number.isFinite(opts.HR0) ? opts.HR0 : 60;

    const tcore = skinTemp + a + b * (skinTemp - airTemp) + c * (heartRate - HR0);

    // 물리적으로 말이 되는 범위로 클램프
    const clamped = Math.min(Math.max(tcore, 34.5), 41.5); // Minimum at 34.5
    return Number(clamped.toFixed(1)); // 소수점 1자리
}

function timeAgo(dateString, isCalculated = false) {
    const date = new Date(dateString);
    const now = new Date();
    const difference = now - date; // milliseconds
    
    const minutes = Math.floor(difference / 60000);
    const hours = Math.floor(difference / 3600000);
    const days = Math.floor(difference / 86400000);
    
    if (isCalculated && minutes > 60) {
        if (minutes % 15 === 0) {
            return '방금 전';
        }
        return `${minutes % 15}분 전`;
    }
    
    if (days > 1) {
        return `${days}일 전`;
    } else if (days === 1) {
        return '1일 전';
    } else if (hours > 1) {
        return `${hours}시간 전`;
    } else if (hours === 1) {
        return '1시간 전';
    } else if (minutes > 1) {
        return `${minutes}분 전`;
    } else if (minutes === 1) {
        return '1분 전';
    } else {
        return '방금 전';
    }
}

function dateAgo(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    const difference = today - date; // milliseconds
    const days = Math.floor(difference / 86400000);
    
    if (days === 0) {
        return '오늘';
    } else if (days === 1) {
        return '1일전';
    } else {
        return `${days}일전`;
    }
}

function formatAge(age) {
    const ageNum = parseInt(String(age));
    if (!isNaN(ageNum)) {
        return `${ageNum}세`;
    }
    return String(age) + '세';
}

// 위치 캐시 전역 변수
if (!window.locationCache) {
    window.locationCache = {};
}

// 은빛노인요양전문기관 위치 설정
const FACILITY_LOCATION = {
    name: '은빛노인요양전문기관',
    lat: 37.501610,
    lng: 127.148037,
    buffer: 0.04 // 40m 버퍼 (GPS 오차 감안)
};

// 두 지점 사이의 거리 계산 (km)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 위치 정보 포맷팅 (이모지 포함) - outing-report.js와 동일한 정확도 기반 필터링 적용
function formatLocationWithDistance(lat, lng, locationName, accuracy = null) {
    const distanceKm = calculateDistance(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng, lat, lng);
    const distanceM = distanceKm * 1000;
    const outingThreshold = FACILITY_LOCATION.buffer; // 40m (0.04km)

    // 정확도 기반 외출 판단 (outing-report.js와 동일한 로직)
    let isOutside = false;
    if (distanceKm > outingThreshold) {
        if (distanceM > 1000) {
            // 1km 이상이면 정확도 관계없이 외출
            isOutside = true;
        } else if (accuracy !== null && accuracy <= 40) {
            // 40m~1000m이고 정확도 40m 이하면 외출
            isOutside = true;
        }
        // accuracy가 없거나 40m 초과면 외출로 판단하지 않음
    }

    if (!isOutside) {
        // 기관 내에 있음 (또는 정확도 부족으로 외출 불확실)
        return `<span class="location-emoji">🏥</span>기관`;
    } else {
        // 기관 밖에 있음
        const distanceText = distanceKm < 1 ?
            `${Math.round(distanceM)}m` :
            `${distanceKm.toFixed(1)}km`;
        return `<span class="location-emoji">🚶</span>${locationName} (${distanceText})`;
    }
}

// 카카오맵 표시 함수 (시간 정보 포함)
function showLocationMapWithTime(lat, lng, locationName, residentName, timeStr) {
    const modal = document.getElementById('location-modal');
    const mapContainer = document.getElementById('map-container');
    const modalTitle = modal.querySelector('.modal-title');
    const locationNameEl = document.getElementById('location-name');
    const locationDistanceEl = document.getElementById('location-distance');
    
    if (!modal || !mapContainer) return;
    
    // 모달 표시
    modal.classList.remove('hidden');
    
    // 모달 제목 설정: (이름)님 (날짜)(시간) 위치
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`;
    modalTitle.textContent = `${residentName}님 ${dateStr} ${timeStr} 위치`;
    
    // 위치 정보 표시 (주소만)
    const distance = calculateDistance(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng, lat, lng);
    if (distance <= FACILITY_LOCATION.buffer) {
        locationDistanceEl.textContent = '(기관 내 위치)';
        locationNameEl.textContent = '기관';
    } else {
        const distanceText = distance < 1 ? 
            `${Math.round(distance * 1000)}m` : 
            `${distance.toFixed(1)}km`;
        locationDistanceEl.textContent = `(기관에서 ${distanceText} 떨어진 위치)`;
        // buildingName이 있으면 함께 표기
        if (locationName && typeof locationName === 'object') {
            if (locationName.building) {
                locationNameEl.textContent = `${locationName.full} (${locationName.building})`;
            } else {
                locationNameEl.textContent = locationName.full || locationName.simple || '위치 정보 없음';
            }
        } else {
            locationNameEl.textContent = locationName || '위치 정보 없음';
        }
    }
    
    // 지도 생성
    const tryCreateMap = () => {
        // 카카오맵 API가 로드되었는지 확인
        if (typeof kakao === 'undefined' || !kakao.maps) {
            console.error('카카오맵 API가 로드되지 않았습니다. 재시도 중...');
            // 500ms 후 재시도 (최대 5번)
            if (!window.mapRetryCount) window.mapRetryCount = 0;
            if (window.mapRetryCount < 5) {
                window.mapRetryCount++;
                setTimeout(tryCreateMap, 500);
                return;
            } else {
                mapContainer.innerHTML = '<p style="text-align: center; padding: 20px;">지도를 불러올 수 없습니다.<br>카카오맵 API 키를 확인해주세요.</p>';
                return;
            }
        }
        
        // 카카오맵 API 로드 성공
        console.log('카카오맵 API 로드 확인, 지도 생성 시작');
        window.mapRetryCount = 0;
        
        const mapOption = {
            center: new kakao.maps.LatLng(lat, lng),
            level: 3
        };
        
        const map = new kakao.maps.Map(mapContainer, mapOption);
        
        // 현재 위치 마커
        const markerPosition = new kakao.maps.LatLng(lat, lng);
        const marker = new kakao.maps.Marker({
            position: markerPosition,
            map: map
        });
        
        // 기관 위치 마커 (다른 색상)
        const facilityMarkerImage = new kakao.maps.MarkerImage(
            'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
            new kakao.maps.Size(24, 35)
        );
        
        const facilityMarker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng),
            map: map,
            image: facilityMarkerImage
        });
        
        // 두 마커가 모두 보이도록 지도 범위 조정
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(markerPosition);
        bounds.extend(new kakao.maps.LatLng(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng));
        map.setBounds(bounds);
    };
    
    // 지도 생성 시도
    setTimeout(tryCreateMap, 100);
}

// 카카오맵 표시 함수 (기존 버전 - 호환성 유지)
function showLocationMap(lat, lng, locationName, residentName) {
    const modal = document.getElementById('location-modal');
    const mapContainer = document.getElementById('map-container');
    const locationNameEl = document.getElementById('location-name');
    const locationDistanceEl = document.getElementById('location-distance');
    
    if (!modal || !mapContainer) return;
    
    // 모달 표시
    modal.classList.remove('hidden');
    
    // 위치 정보 표시
    const distance = calculateDistance(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng, lat, lng);
    if (distance <= FACILITY_LOCATION.buffer) {
        locationDistanceEl.textContent = '(기관 내 위치)';
        locationNameEl.textContent = '기관';
    } else {
        const distanceText = distance < 1 ? 
            `${Math.round(distance * 1000)}m` : 
            `${distance.toFixed(1)}km`;
        locationDistanceEl.textContent = `(기관에서 ${distanceText} 떨어진 위치)`;
        // buildingName이 있으면 함께 표기
        if (locationName && typeof locationName === 'object') {
            if (locationName.building) {
                locationNameEl.textContent = `${locationName.full} (${locationName.building})`;
            } else {
                locationNameEl.textContent = locationName.full || locationName.simple || '위치 정보 없음';
            }
        } else {
            locationNameEl.textContent = locationName || '위치 정보 없음';
        }
    }
    
    // 지도 생성
    const tryCreateMap = () => {
        // 카카오맵 API가 로드되었는지 확인
        if (typeof kakao === 'undefined' || !kakao.maps) {
            console.error('카카오맵 API가 로드되지 않았습니다. 재시도 중...');
            // 500ms 후 재시도 (최대 5번)
            if (!window.mapRetryCount) window.mapRetryCount = 0;
            if (window.mapRetryCount < 5) {
                window.mapRetryCount++;
                setTimeout(tryCreateMap, 500);
                return;
            } else {
                mapContainer.innerHTML = '<p style="text-align: center; padding: 20px;">지도를 불러올 수 없습니다.<br>카카오맵 API 키를 확인해주세요.</p>';
                return;
            }
        }
        
        // 카카오맵 API 로드 성공
        console.log('카카오맵 API 로드 확인, 지도 생성 시작');
        window.mapRetryCount = 0;
        
        const mapOption = {
            center: new kakao.maps.LatLng(lat, lng),
            level: 3
        };
        
        const map = new kakao.maps.Map(mapContainer, mapOption);
        
        // 현재 위치 마커
        const markerPosition = new kakao.maps.LatLng(lat, lng);
        const marker = new kakao.maps.Marker({
            position: markerPosition,
            map: map
        });
        
        // 기관 위치 마커 (다른 색상)
        const facilityMarkerImage = new kakao.maps.MarkerImage(
            'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
            new kakao.maps.Size(24, 35)
        );
        
        const facilityMarker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng),
            map: map,
            image: facilityMarkerImage
        });
        
        // 두 마커가 모두 보이도록 지도 범위 조정
        const bounds = new kakao.maps.LatLngBounds();
        bounds.extend(markerPosition);
        bounds.extend(new kakao.maps.LatLng(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng));
        map.setBounds(bounds);
    };
    
    // 지도 생성 시도
    setTimeout(tryCreateMap, 100);
}

// 외출 시간 포맷팅 함수
function formatOutingDuration(totalMinutes) {
    if (totalMinutes < 60) {
        return `${totalMinutes}분`;
    } else {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (minutes === 0) {
            return `${hours}시간`;
        } else {
            return `${hours}시간 ${minutes}분`;
        }
    }
}

// 외출 리포트 분석 함수 (outing-report.js와 동일한 로직 적용 - 연속된 외출을 구간으로 그룹화)
// 어제부터 이어진 외출도 오늘 00:00부터 계산하여 포함
function analyzeOutingReport(locationData) {
    if (!locationData || locationData.length === 0) {
        return { hasOuting: false, status: '데이터 없음', outings: [], totalDuration: 0 };
    }

    console.log('📊 외출 분석 시작, 위치 데이터 개수:', locationData.length);

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 제외된 위치 데이터 필터링 (excludedYn === 'Y'인 데이터 제외)
    const nonExcludedData = locationData.filter(loc => loc.excludedYn !== 'Y');
    console.log(`제외 처리 후 데이터: ${nonExcludedData.length}개 (원본: ${locationData.length}개)`);

    // 전체 데이터를 시간순 정렬 (어제부터 이어진 외출 파악을 위해)
    const sortedLocations = [...nonExcludedData].sort((a, b) =>
        new Date(a.registrationDateTime) - new Date(b.registrationDateTime)
    );

    if (sortedLocations.length === 0) {
        return { hasOuting: false, status: '데이터 없음', outings: [], totalDuration: 0 };
    }

    const outings = [];
    let totalOutingMinutes = 0;
    let currentOuting = null; // 현재 진행 중인 외출 구간
    const outingThreshold = FACILITY_LOCATION.buffer; // 40m (0.04km)

    // 날짜 문자열 추출 함수
    const getDateStr = (date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // 위치 데이터를 순회하며 외출 구간 분석
    for (let i = 0; i < sortedLocations.length; i++) {
        const loc = sortedLocations[i];
        const distanceKm = calculateDistance(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng, loc.latitude, loc.longitude);
        const distanceM = distanceKm * 1000; // m로 변환

        // 정확도 기반 필터링: 1000m 이내 외출은 정확도 40m 이하만 인정
        const accuracy = loc.accuracy || null;
        if (distanceM <= 1000 && distanceM > outingThreshold * 1000) {
            // 시설에서 40m~1000m 사이의 데이터는 정확도 검증 필요
            if (accuracy === null || accuracy > 40) {
                // 정확도가 없거나 40m 초과면 이 데이터 포인트 스킵
                continue;
            }
        }

        const isOutside = distanceKm > outingThreshold;
        const locTime = new Date(loc.registrationDateTime);
        const locDateStr = getDateStr(locTime);

        if (isOutside) {
            // 외출 위치 발견
            if (!currentOuting) {
                // 새로운 외출 구간 시작
                currentOuting = {
                    startTime: locTime,
                    endTime: locTime,
                    maxDistance: distanceKm,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    dateStr: locDateStr,
                    locations: [{
                        time: locTime,
                        lat: loc.latitude,
                        lng: loc.longitude,
                        distance: distanceM,
                        accuracy: accuracy,
                        bioKey: loc.bioKey || null
                    }]
                };
            } else {
                // 날짜가 바뀌었는지 확인 (outing-report.js와 동일한 처리)
                if (locDateStr !== currentOuting.dateStr) {
                    // 날짜가 바뀌면 이전 외출을 당일 23:59:59로 종료
                    const endOfDay = new Date(currentOuting.startTime);
                    endOfDay.setHours(23, 59, 59, 999);
                    currentOuting.endTime = endOfDay;

                    const durationMs = currentOuting.endTime - currentOuting.startTime;
                    const durationMin = Math.round(durationMs / 60000);

                    // 이전 날짜의 외출은 오늘이 아니면 저장하지 않음
                    if (currentOuting.dateStr === todayDateStr && durationMin >= 5) {
                        totalOutingMinutes += durationMin;
                        outings.push({
                            latitude: currentOuting.latitude,
                            longitude: currentOuting.longitude,
                            time: currentOuting.startTime.toISOString(),
                            endTime: currentOuting.endTime.toISOString(),
                            distance: currentOuting.maxDistance,
                            duration: durationMin,
                            locations: currentOuting.locations
                        });
                    }

                    // 새 날짜의 외출은 00:00부터 시작
                    const startOfNewDay = new Date(locTime);
                    startOfNewDay.setHours(0, 0, 0, 0);
                    currentOuting = {
                        startTime: startOfNewDay,
                        endTime: locTime,
                        maxDistance: distanceKm,
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        dateStr: locDateStr,
                        locations: [{
                            time: locTime,
                            lat: loc.latitude,
                            lng: loc.longitude,
                            distance: distanceM,
                            accuracy: accuracy,
                            bioKey: loc.bioKey || null
                        }]
                    };
                } else {
                    // 같은 날짜 내 외출 진행 중 - 구간 업데이트
                    currentOuting.endTime = locTime;
                    currentOuting.locations.push({
                        time: locTime,
                        lat: loc.latitude,
                        lng: loc.longitude,
                        distance: distanceM,
                        accuracy: accuracy,
                        bioKey: loc.bioKey || null
                    });
                    // 최대 거리 업데이트
                    if (distanceKm > currentOuting.maxDistance) {
                        currentOuting.maxDistance = distanceKm;
                        currentOuting.latitude = loc.latitude;
                        currentOuting.longitude = loc.longitude;
                    }
                }
            }
        } else {
            // 기관 내부 위치 (복귀)
            if (currentOuting) {
                // 외출에서 복귀 - 외출 구간 종료
                const durationMs = currentOuting.endTime - currentOuting.startTime;
                const durationMin = Math.round(durationMs / 60000);

                // 오늘 날짜의 외출만 저장
                if (currentOuting.dateStr === todayDateStr && durationMin >= 5) {
                    totalOutingMinutes += durationMin;
                    outings.push({
                        latitude: currentOuting.latitude,
                        longitude: currentOuting.longitude,
                        time: currentOuting.startTime.toISOString(),
                        endTime: currentOuting.endTime.toISOString(),
                        distance: currentOuting.maxDistance,
                        duration: durationMin,
                        locations: currentOuting.locations
                    });
                }
                currentOuting = null;
            }
        }
    }

    // 현재도 외출 중인 경우 (마지막 위치가 외부) - 외출 구간 완성
    // outing-report.js와 동일하게 마지막 위치 데이터 시간까지만 계산 (데이터 기준)
    if (currentOuting && currentOuting.dateStr === todayDateStr) {
        const durationMs = currentOuting.endTime - currentOuting.startTime;
        const durationMin = Math.round(durationMs / 60000);

        if (durationMin >= 5) { // 5분 이상만 기록
            totalOutingMinutes += durationMin;
            outings.push({
                latitude: currentOuting.latitude,
                longitude: currentOuting.longitude,
                time: currentOuting.startTime.toISOString(),
                endTime: currentOuting.endTime.toISOString(),
                distance: currentOuting.maxDistance,
                duration: durationMin,
                locations: currentOuting.locations
            });
        }
    }

    const hasOuting = outings.length > 0;
    const status = hasOuting ? '오늘 외출 있음' : '오늘 외출 없음';

    // 현재 외출중 여부: 가장 최근 위치가 요양원 외부인지 확인
    const lastLocation = sortedLocations[sortedLocations.length - 1];
    const lastDistanceKm = calculateDistance(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng, lastLocation.latitude, lastLocation.longitude);
    const lastDistanceM = lastDistanceKm * 1000;
    const lastAccuracy = lastLocation.accuracy || null;

    // 현재 외출 판단도 정확도 기반 필터링 적용
    let currentlyOut = false;
    if (lastDistanceKm > outingThreshold) {
        if (lastDistanceM > 1000) {
            // 1km 이상이면 정확도 관계없이 외출
            currentlyOut = true;
        } else if (lastAccuracy !== null && lastAccuracy <= 40) {
            // 40m~1000m이고 정확도 40m 이하면 외출
            currentlyOut = true;
        }
    }

    console.log(`📊 외출 분석 결과: ${outings.length}건, 총 ${totalOutingMinutes}분`);
    return { hasOuting, status, outings, totalDuration: totalOutingMinutes, currentlyOut };
}

// 오늘 날짜의 모든 위치 데이터 가져오기 함수
async function fetchTodayLocationData(wardedUserId) {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'http://localhost:3001';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
    
    // 데모 컨트롤러가 있으면 우선적으로 사용
    if (window.demoController && typeof window.demoController.getDemoLocationData === 'function') {
        console.log('🎮 데모 컨트롤러 모드: 위치 데이터 반환');
        return window.demoController.getDemoLocationData(wardedUserId);
    }
    
    if (ENABLE_MOCK_DATA) {
        // 목업 데이터에서 오늘 날짜의 위치 데이터 생성
        const today = new Date();
        const mockLocations = [];
        for (let i = 0; i < 50; i++) { // 50개의 목업 위치 데이터
            const time = new Date(today.getTime() + (i * 30 * 60 * 1000)); // 30분 간격
            mockLocations.push({
                latitude: 37.501610 + (Math.random() - 0.5) * 0.01,
                longitude: 127.148037 + (Math.random() - 0.5) * 0.01,
                registrationDateTime: time.toISOString()
            });
        }
        return mockLocations;
    }
    
    try {
        // 오늘 날짜를 YYYY-MM-DD 형식으로 생성
        const today = new Date();
        const fromDateStr = today.getFullYear() + '-' + 
                           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(today.getDate()).padStart(2, '0');
        
        // 내일 날짜를 toDate로 설정
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const toDateStr = tomorrow.getFullYear() + '-' + 
                         String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(tomorrow.getDate()).padStart(2, '0');
        
        // Period API 호출 (toDate를 미래 날짜로 설정)
        const url = `${API_BASE_URL}/watcher/period?wardedUserId=${wardedUserId}&bioDataTypes=LOCATION&fromDate=${fromDateStr}&toDate=${toDateStr}`;
        console.log('🔍 Fetching today location data from:', url);
        console.log('📅 Date range:', fromDateStr, 'to', toDateStr);
        
        const response = await fetch(url, { 
            headers: {'Content-Type': 'application/json'} 
        });
        console.log('📡 Today location data response status:', response.status);
        
        const data = await response.json();
        console.log(`📋 Today location data for ${wardedUserId}:`, data);
        
        if (data.code === "1000" && data.response && data.response.location && data.response.location.length > 0) {
            console.log('✅ Today location data response:', data.response.location.length, 'records');
            return data.response.location;
        } else {
            console.log('⚠️ No location data for today, falling back to recent data');
            
            // 폴백: 기존 /watcher API에서 위치 데이터 가져오기
            const fallbackUrl = `${API_BASE_URL}/watcher?wardedUserId=${wardedUserId}`;
            console.log('🔄 Fallback to:', fallbackUrl);
            
            const fallbackResponse = await fetch(fallbackUrl, { 
                headers: {'Content-Type': 'application/json'} 
            });
            
            const fallbackData = await fallbackResponse.json();
            
            if (fallbackData.code === "1000" && fallbackData.response && fallbackData.response.location) {
                // 오늘 날짜의 데이터만 필터링
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const todayLocations = fallbackData.response.location.filter(loc => {
                    const locDate = new Date(loc.registrationDateTime);
                    return locDate >= todayStart;
                });
                
                console.log(`📍 Fallback: filtered ${todayLocations.length} today locations from ${fallbackData.response.location.length} total`);
                return todayLocations;
            }
        }
    } catch (error) {
        console.error('Error fetching today location data:', error);
    }
    return [];
}

// 외출 리포트 모달 표시 함수 (outing-report.html 스타일 재활용)
async function showOutingReport(userName, wardedUserId, locationData, outingReport, residentInfo = {}) {
    const modal = document.getElementById('outing-report-modal');
    const titleEl = document.getElementById('outing-report-title');
    const summaryEl = document.getElementById('outing-report-summary');
    const listEl = document.getElementById('outing-report-list');

    if (!modal) return;

    // 모달 표시 (.active 클래스 사용)
    modal.classList.add('active');

    // 타이틀 설정
    const today = new Date();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[today.getDay()];
    titleEl.textContent = `${today.getMonth() + 1}월 ${today.getDate()}일 (${weekday}) ${userName} 님 외출 내역`;

    // 요약 정보 설정
    if (outingReport.hasOuting) {
        const durationText = outingReport.totalDuration > 0 ?
            formatOutingDuration(outingReport.totalDuration) : '0분';
        summaryEl.innerHTML = `<div class="outing-summary-text">총 ${outingReport.outings.length}건, ${durationText}의 외출이 확인되었습니다.</div>`;
        summaryEl.classList.remove('outing-summary-none');
    } else {
        summaryEl.innerHTML = `<div class="outing-summary-text">오늘 외출이 확인되지 않았습니다.</div>`;
        summaryEl.classList.add('outing-summary-none');
    }

    // 외출 목록 생성
    listEl.innerHTML = '';

    if (outingReport.outings.length > 0) {
        // 시간순으로 내림차순 정렬 (최근 시간이 먼저)
        const sortedOutings = [...outingReport.outings].sort((a, b) =>
            new Date(b.time) - new Date(a.time)
        );

        // 프로필 정보 (이름 기반으로 이모지/색상 생성)
        const profile = getOutingResidentProfile(userName);

        for (let eventIdx = 0; eventIdx < sortedOutings.length; eventIdx++) {
            const outing = sortedOutings[eventIdx];

            // 외출 시간 계산
            const startTime = new Date(outing.time);
            const endTime = outing.endTime ? new Date(outing.endTime) : startTime;
            const startTimeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            const endTimeStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
            const timeRange = startTimeStr === endTimeStr ? startTimeStr : `${startTimeStr}~${endTimeStr}`;

            // 거리 텍스트
            const distanceText = outing.distance < 1 ?
                `${Math.round(outing.distance * 1000)}m` :
                `${outing.distance.toFixed(1)}km`;

            // 지속 시간 텍스트
            const durationText = outing.duration ? formatOutingDuration(outing.duration) : '-';

            // 위치 이력 (있으면)
            const locations = outing.locations || [];
            const locationCount = locations.length;

            // 상세 항목 HTML 생성
            const detailItem = document.createElement('div');
            detailItem.className = 'day-detail-item';
            detailItem.dataset.eventIdx = eventIdx;

            detailItem.innerHTML = `
                <div class="detail-header" onclick="toggleOutingReportLocations(${eventIdx})">
                    <div class="detail-profile" style="background: ${profile.bgColor};">${profile.emoji}</div>
                    <div class="detail-info">
                        <div class="detail-name">${userName}</div>
                        <div class="detail-meta">${residentInfo.age || ''}세 · ${residentInfo.room || ''} · ${distanceText}</div>
                    </div>
                    <div class="detail-time">
                        <div class="detail-time-value">${durationText}</div>
                        <div class="detail-time-label">${timeRange}</div>
                    </div>
                    <div class="detail-expand-icon">▼</div>
                </div>
                <div class="detail-locations" id="outing-locations-${eventIdx}" style="display: none;">
                    <div class="locations-header">
                        <span>위치 이력 (${locationCount}건)</span>
                    </div>
                    <div class="locations-list" id="outing-locations-list-${eventIdx}">
                        ${renderOutingLocationsList(locations, eventIdx, outing)}
                    </div>
                </div>
            `;

            listEl.appendChild(detailItem);
        }
    } else {
        listEl.innerHTML = '<div class="location-item-empty">오늘 외출 기록이 없습니다.</div>';
    }
}

// 프로필 정보 생성 (이름 기반)
function getOutingResidentProfile(name) {
    // 이름 기반으로 이모지와 색상 할당
    const emojis = ['👴', '👵', '🧓', '👨‍🦳', '👩‍🦳'];
    const colors = ['#DBEAFE', '#FEE2E2', '#D1FAE5', '#FEF3C7', '#E0E7FF', '#FCE7F3'];

    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
        emoji: emojis[hash % emojis.length],
        bgColor: colors[hash % colors.length]
    };
}

// 위치 이력 리스트 렌더링
function renderOutingLocationsList(locations, eventIdx, outing) {
    if (!locations || locations.length === 0) {
        // 위치 이력이 없으면 단일 위치로 표시
        const distanceStr = outing.distance < 1
            ? `${Math.round(outing.distance * 1000)}m`
            : `${outing.distance.toFixed(1)}km`;
        const timeStr = new Date(outing.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="location-item" onclick="toggleOutingReportMap(${eventIdx}, 0, ${outing.latitude}, ${outing.longitude}, '${timeStr}', '${distanceStr}')">
                <div class="location-time">${timeStr}</div>
                <div class="location-distance">기관에서 ${distanceStr}</div>
                <div class="location-address" id="outing-addr-${eventIdx}-0">주소 조회중...</div>
            </div>
            <div class="location-map-container" id="outing-map-${eventIdx}-0" style="display: none;"></div>
        `;
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

        return `
            <div class="location-item" onclick="toggleOutingReportMap(${eventIdx}, ${locIdx}, ${loc.lat}, ${loc.lng}, '${timeStr}', '${distanceStr}')">
                <div class="location-time">${timeStr}</div>
                <div class="location-distance">기관에서 ${distanceStr}</div>
                <div class="location-address" id="outing-addr-${eventIdx}-${locIdx}">주소 조회중...</div>
                <div class="location-accuracy">${accuracyStr}</div>
            </div>
            <div class="location-map-container" id="outing-map-${eventIdx}-${locIdx}" style="display: none;"></div>
        `;
    }).join('');
}

// 외출 건의 위치 이력 펼침/접기
function toggleOutingReportLocations(eventIdx) {
    const locationsDiv = document.getElementById(`outing-locations-${eventIdx}`);
    const detailItem = document.querySelector(`.day-detail-item[data-event-idx="${eventIdx}"]`);
    const expandIcon = detailItem?.querySelector('.detail-expand-icon');

    if (!locationsDiv) return;

    if (locationsDiv.style.display === 'none') {
        // 다른 모든 위치 이력 숨기기
        document.querySelectorAll('.detail-locations').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.detail-expand-icon').forEach(el => {
            el.textContent = '▼';
        });

        locationsDiv.style.display = 'block';
        if (expandIcon) expandIcon.textContent = '▲';

        // 주소 조회 시작
        loadOutingAddressesForEvent(eventIdx);
    } else {
        locationsDiv.style.display = 'none';
        if (expandIcon) expandIcon.textContent = '▼';
    }
}

// 특정 외출 건의 모든 위치 주소 조회
async function loadOutingAddressesForEvent(eventIdx) {
    const addressElements = document.querySelectorAll(`[id^="outing-addr-${eventIdx}-"]`);

    for (const el of addressElements) {
        if (el.textContent === '주소 조회중...') {
            const locationItem = el.closest('.location-item');
            const onclickAttr = locationItem.getAttribute('onclick');
            const match = onclickAttr.match(/toggleOutingReportMap\(\d+,\s*\d+,\s*([\d.-]+),\s*([\d.-]+)/);

            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);

                try {
                    const locationInfo = await getLocationName(lat, lng);
                    el.textContent = locationInfo.full || '주소 없음';
                } catch (err) {
                    el.textContent = '주소 조회 실패';
                }
            }
        }
    }
}

// 위치 항목 클릭 시 지도 토글
function toggleOutingReportMap(eventIdx, locIdx, lat, lng, timeStr, distanceStr) {
    const mapContainer = document.getElementById(`outing-map-${eventIdx}-${locIdx}`);

    if (!mapContainer) return;

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
                const facilityLat = facilityConfig.LATITUDE || FACILITY_LOCATION.lat;
                const facilityLng = facilityConfig.LONGITUDE || FACILITY_LOCATION.lng;
                const facilityName = facilityConfig.NAME || '헬로온 요양원';

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
                    title: facilityName
                });
                facilityMarker.setMap(map);

                // 시설 인포윈도우
                const facilityIwContent = `<div style="padding:6px; font-size:11px;">
                                             <strong>${facilityName}</strong>
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
                    strokeColor: '#FF0000',
                    strokeOpacity: 0.5,
                    strokeStyle: 'dashed'
                });

                polyline.setMap(map);
            }, 100);
        }
    } else {
        mapContainer.style.display = 'none';
    }
}

// 모달 닫기 이벤트
document.addEventListener('DOMContentLoaded', function() {
    // === Settings 버튼 공통 바인딩 (모든 페이지에서 동작) ===
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn && typeof openResidentManagementModal === 'function') {
        settingsBtn.addEventListener('click', openResidentManagementModal);
    }

    const locationModalClose = document.getElementById('location-modal-close');
    const locationModal = document.getElementById('location-modal');
    const outingReportModalClose = document.getElementById('outing-report-modal-close');
    const outingReportModal = document.getElementById('outing-report-modal');
    
    if (locationModalClose && locationModal) {
        locationModalClose.addEventListener('click', () => {
            locationModal.classList.add('hidden');
        });
        
        locationModal.addEventListener('click', (e) => {
            if (e.target === locationModal) {
                locationModal.classList.add('hidden');
            }
        });
    }
    
    if (outingReportModalClose && outingReportModal) {
        outingReportModalClose.addEventListener('click', () => {
            outingReportModal.classList.remove('active');
        });

        outingReportModal.addEventListener('click', (e) => {
            if (e.target === outingReportModal) {
                outingReportModal.classList.remove('active');
            }
        });
    }
});

// ===== END GLOBAL API FUNCTIONS =====

// Global variables for resident data
let wardedUsers = [];
let bioDataCache = {};

// Update record data if needed (for real-time updates)
async function updateRecordDataIfNeeded() {
  // Only update if we're on the record page and have the necessary elements
  if (!recordListBody || !sidebarMenuItems.length) return;
  
  try {
    const currentActiveType = document.querySelector('.sidebar-menu li.active')?.dataset.type || 'unconfirmed';
    const currentRecordCount = recordData[currentActiveType]?.length || 0;
    
    // Fetch fresh data
    await fetchRecordData();
    
    // Check if counts changed
    const newRecordCount = recordData[currentActiveType]?.length || 0;
    
    if (newRecordCount !== currentRecordCount) {
      console.log('Record data updated, refreshing view');
      
      // Update the view
      renderList(currentActiveType);
      syncSidebarCounts();
      
      // If there's a notification sound or visual indicator, you could add it here
      console.log(`Records updated: ${currentActiveType} count changed from ${currentRecordCount} to ${newRecordCount}`);
    }
    
  } catch (error) {
    console.error('Error updating record data:', error);
  }
}
// --- synchronize sidebar badge counts ---
function syncSidebarCounts() {
  // 각 요소가 존재하는지 확인 후 업데이트 (record.html에서만 사용)
  const unconfirmedEl = document.querySelector('[data-type="unconfirmed"] .sub-count');
  const confirmedEl = document.querySelector('[data-type="confirmed"] .sub-count');
  const resolvedEl = document.querySelector('[data-type="resolved"] .sidebar-item-header .sub-count');

  if (unconfirmedEl) unconfirmedEl.textContent = recordData.unconfirmed.length;
  if (confirmedEl) confirmedEl.textContent = recordData.confirmed.length;

  // 해결완료 총 카운트 (조치완료 + 이슈없음)
  const totalResolved = (recordData.resolved_action?.length || 0) + (recordData.resolved_noissue?.length || 0);
  if (resolvedEl) resolvedEl.textContent = totalResolved;

  // 서브탭 카운트
  const actionSubtab = document.querySelector('[data-subtype="resolved_action"] .sub-count');
  const noissueSubtab = document.querySelector('[data-subtype="resolved_noissue"] .sub-count');
  if (actionSubtab) actionSubtab.textContent = recordData.resolved_action?.length || 0;
  if (noissueSubtab) noissueSubtab.textContent = recordData.resolved_noissue?.length || 0;
}

// 디테일 패널 클리어 헬퍼 함수
function clearDetailPanel() {
  const titleEl = document.querySelector('.detail-title');
  const bodyEl = document.querySelector('.detail-body');
  const timeEl = document.querySelector('.detail-time');

  if (titleEl) titleEl.textContent = '';
  if (bodyEl) bodyEl.innerHTML = '';
  if (timeEl) timeEl.textContent = '';
  currentDisplayedRecord = null;
  currentDisplayedType = null;
}

// 메뉴 전환 및 특정 항목 선택 헬퍼 함수
function switchToMenuAndSelectItem(targetType, eventId) {
  // 서브탭인 경우 (resolved_action, resolved_noissue)
  const isSubtab = targetType.startsWith('resolved_');
  const parentType = isSubtab ? 'resolved' : targetType;

  // 사이드바 메뉴 활성화 변경
  const sidebarItems = document.querySelectorAll('.sidebar-menu > li');
  sidebarItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.type === parentType) {
      item.classList.add('active');
    }
  });

  // 서브탭인 경우 해당 서브탭도 활성화
  if (isSubtab) {
    const subtabs = document.querySelectorAll('.subtab-item');
    subtabs.forEach(st => {
      st.classList.remove('active');
      if (st.dataset.subtype === targetType) {
        st.classList.add('active');
      }
    });
  }

  // 해당 목록 렌더링
  renderList(targetType);
  syncSidebarCounts();

  // 이동한 항목 찾아서 선택 (eventId로 찾기)
  setTimeout(() => {
    const rows = document.querySelectorAll('.record-row');
    let targetRow = null;

    for (const row of rows) {
      if (row.dataset.eventId === String(eventId)) {
        targetRow = row;
        break;
      }
    }

    if (targetRow) {
      targetRow.click();
    } else {
      // 못 찾으면 첫 번째 항목 선택
      const firstRow = document.querySelector('.record-row');
      if (firstRow) {
        firstRow.click();
      }
    }
  }, 50);
}

// === Helper to build detail HTML ===
function buildDetailHTML(rec, showButtons, showEditDone, isResolved = false, isConfirmed = false){
  if(!rec.detail) return '';

  const vitalsHTML = rec.detail.vitals.map(v=>`
    <div class="vital-card">
      <div class="vital-header">
        <span class="vital-label">${v.label}</span>
        <span class="vital-time">${v.time}</span>
      </div>
      <div class="vital-value">${v.value}</div>
    </div>`).join('');

  // Conditionally include action buttons
  const buttonsHTML = showButtons ? `
    <div class="detail-btn-group">
      <button class="detail-btn danger confirm-btn">위험 확인</button>
      <button class="detail-btn primary no-issue-btn">이슈 없음</button>
    </div>
  ` : '';

  // 해결완료 또는 확인된 상태에서 미확인으로 되돌리기 버튼
  const revertBtnHTML = (isResolved || isConfirmed) ? `
    <button class="detail-btn secondary revert-btn">미확인으로 되돌리기</button>
  ` : '';

  let replyHTML = '';
  if(rec.reply){
    if(rec.reply.written){
      const actionsHTML = showEditDone && rec.reply.written ? `
         <div class="reply-actions">
           <button class="reply-edit">수정</button>
           <button class="reply-complete">완료</button>
         </div>` : '';

      replyHTML = `
         <div class="reply-block">
           <div class="reply-header">
             <span class="reply-author">담당자 확인 내용</span>
           </div>
           <p class="reply-content">${rec.reply.content}</p>
           ${actionsHTML}
         </div>`;
    }else{
      replyHTML = `
      <div class="reply-editor">
        <textarea class="reply-text" placeholder="조치/확인 내용을 입력하세요..."></textarea>
        <div class="reply-actions">
          <button class="reply-submit">해결 완료</button>
        </div>
      </div>`;
    }
  }

  // Get resident info from mapping data if available
  let residentAge = '나이 미확인';
  let residentRoom = '호실 미확인';
  let residentStatus = '일상생활';
  
  if (rec.wardedUserId && wardedUsers && wardedUsers.length > 0) {
    const resident = wardedUsers.find(u => u.wardedUserId === rec.wardedUserId);
    if (resident) {
      residentAge = formatAge(resident.age);
      residentRoom = resident.room || '호실 미확인';
    }
  } else {
    console.log('⚠️ wardedUsers not available in buildDetailHTML:', { wardedUserId: rec.wardedUserId, wardedUsersLength: wardedUsers?.length });
  }

  // 프로필 이미지 또는 이모지 렌더링
  let profileHtml;
  if (rec.img && rec.img.startsWith('emoji:')) {
    const parts = rec.img.split(':');
    const emoji = parts[1] || '👤';
    const color = parts[2] || '#6B7280';
    profileHtml = `<div class="detail-profile emoji-profile" style="background-color: ${color};">${emoji}</div>`;
  } else {
    profileHtml = `<img src="${rec.img}" class="detail-profile">`;
  }

  // Keep ${buttonsHTML} where it was inserted before
  return `
    <div class="detail-top">
      ${profileHtml}
      <div class="detail-info">
        <span class="detail-name">${rec.name}</span>
        <span class="detail-extra">${residentAge}&nbsp;&nbsp;${residentRoom}&nbsp;&nbsp;<span class="status-label daily">${residentStatus}</span>&nbsp;&nbsp;담당자: 관리자</span>
      </div>
    </div>
    <p class="detail-msg">${rec.detail.msg}</p>
    ${buttonsHTML}
    ${replyHTML}
    <div class="vital-card location-card-clickable" style="cursor: pointer;">
          <div class="vital-header">
        <span class="vital-label">최근위치</span>
        <span class="vital-time">방금</span>
      </div>
      <div class="vital-value">${typeof rec.detail.location === 'object' ? (rec.detail.location.building ? `${rec.detail.location.full} (${rec.detail.location.building})` : (rec.detail.location.full || rec.detail.location.simple || '위치 정보 없음')) : rec.detail.location}</div>
      </div>
    <img src="${rec.detail.map}" class="location-img">
    ${vitalsHTML}
    ${revertBtnHTML}
  `;
}

// 리스트 표시 제한 설정
const LIST_DISPLAY_LIMIT = 50;
let currentDisplayLimit = {}; // typeKey별 현재 표시 개수

function renderList(typeKey, showMore = false){
  const list = recordData[typeKey] || [];

  // 표시 개수 관리
  if (!currentDisplayLimit[typeKey] || !showMore) {
    currentDisplayLimit[typeKey] = LIST_DISPLAY_LIMIT;
  } else {
    currentDisplayLimit[typeKey] += LIST_DISPLAY_LIMIT;
  }

  const displayCount = Math.min(currentDisplayLimit[typeKey], list.length);
  const hasMore = list.length > displayCount;

  let html='';
  for (let index = 0; index < displayCount; index++) {
    const item = list[index];

    // 프로필 이미지 또는 이모지 렌더링
    let profileHtml;
    if (item.img && item.img.startsWith('emoji:')) {
      // emoji:😊:#FF5733 형식
      const parts = item.img.split(':');
      const emoji = parts[1] || '👤';
      const color = parts[2] || '#6B7280';
      profileHtml = `<div class="rec-profile emoji-profile" style="background-color: ${color};">${emoji}</div>`;
    } else {
      profileHtml = `<img src="${item.img}" class="rec-profile" alt="${item.name}">`;
    }

    html += `<div class="record-row" data-time="${item.time}" data-event-id="${item.eventId || ''}" data-warded-user-id="${item.wardedUserId || ''}" data-record-index="${index}">
      ${profileHtml}
      <div class="rec-main">
        <div class="rec-name-title">${item.name}  ${item.title}</div>
        <div class="rec-desc">${item.desc}</div>
      </div>
      <div class="rec-right">${item.right}</div>
    </div>`;
  }

  // 더보기 버튼
  if (hasMore) {
    const remaining = list.length - displayCount;
    html += `<div class="load-more-btn" data-type="${typeKey}">
      더보기 (${remaining}건 더 있음)
    </div>`;
  }

  recordListBody.innerHTML = html;
  attachRecordRowListeners();
  attachLoadMoreListener(typeKey);
}

function attachLoadMoreListener(typeKey) {
  const loadMoreBtn = recordListBody.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      renderList(typeKey, true);
    });
  }
}

// Sidebar menu interaction for record.html
if (sidebarMenuItems.length && recordListBody) {
  sidebarMenuItems.forEach(item=>{
    item.addEventListener('click',(e)=>{
      // 서브탭 클릭인 경우 이벤트 버블링 방지
      if (e.target.closest('.subtab-item')) return;

      sidebarMenuItems.forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      const key=item.dataset.type;

      // resolved의 경우 기본적으로 조치완료 서브탭 표시
      if (key === 'resolved') {
        // 서브탭 중 활성화된 것이 없으면 첫 번째(조치완료)를 활성화
        let activeSubtab = item.querySelector('.subtab-item.active');
        if (!activeSubtab) {
          const firstSubtab = item.querySelector('.subtab-item[data-subtype="resolved_action"]');
          if (firstSubtab) {
            item.querySelectorAll('.subtab-item').forEach(st => st.classList.remove('active'));
            firstSubtab.classList.add('active');
            activeSubtab = firstSubtab;
          }
        }
        const subtypeKey = activeSubtab ? activeSubtab.dataset.subtype : 'resolved_action';
        renderList(subtypeKey);
      } else {
        renderList(key);
      }
      syncSidebarCounts();

      // 첫 번째 항목 자동 선택 (항목이 있는 경우)
      const firstRow = recordListBody.querySelector('.record-row');
      if (firstRow) {
        firstRow.click();
      } else {
        // 항목이 없으면 상세 패널 클리어
        clearDetailPanel();
      }
    });
  });

  // 서브탭 클릭 이벤트
  document.querySelectorAll('.subtab-item').forEach(subtab => {
    subtab.addEventListener('click', (e) => {
      e.stopPropagation();

      // 부모 메뉴 활성화
      const parentItem = subtab.closest('.sidebar-item');
      sidebarMenuItems.forEach(i => i.classList.remove('active'));
      parentItem.classList.add('active');

      // 서브탭 활성화 상태 변경
      parentItem.querySelectorAll('.subtab-item').forEach(st => st.classList.remove('active'));
      subtab.classList.add('active');

      const subtypeKey = subtab.dataset.subtype;
      renderList(subtypeKey);
      syncSidebarCounts();

      // 첫 번째 항목 자동 선택
      const firstRow = recordListBody.querySelector('.record-row');
      if (firstRow) {
        firstRow.click();
      } else {
        clearDetailPanel();
      }
    });
  });
  
  // Initialize with real data (only if not already initialized by demo controller)
  const urlParams = new URLSearchParams(window.location.search);
  const isDemoMode = urlParams.get('demo') === 'true';
  
  // 데모 모드가 아닐 때만 초기화 (데모 모드에서는 demo-controller가 초기화 담당)
  if (!isDemoMode) {
    initializeRecordData();
  }
}
// ===== Record list → detail view sync =====
function attachRecordRowListeners(){
  const rows=document.querySelectorAll('.record-row');
  const detailPane = document.querySelector('.record-detail-pane');
  const detailTitle = detailPane?.querySelector('.detail-title');
  const detailBody  = detailPane?.querySelector('.detail-body');
  const detailTime  = detailPane?.querySelector('.detail-time');
  rows.forEach(row=>{
    row.addEventListener('click', async ()=>{
      rows.forEach(r=>r.classList.remove('selected-row'));
      row.classList.add('selected-row');
      
      const recordIndex = parseInt(row.dataset.recordIndex);
      const eventId = row.dataset.eventId;
      const wardedUserId = row.dataset.wardedUserId;

      // Get active type - check for subtab first
      let activeType = document.querySelector('.sidebar-menu li.active').dataset.type;
      if (activeType === 'resolved') {
        // Check which subtab is active
        const activeSubtab = document.querySelector('.subtab-item.active');
        if (activeSubtab) {
          activeType = activeSubtab.dataset.subtype;
        }
      }

      // Get record object using index for reliability
      console.log('🔍 Debug - activeType:', activeType, 'recordIndex:', recordIndex);
      console.log('🔍 Debug - recordData keys:', Object.keys(recordData));
      console.log('🔍 Debug - recordData[activeType]:', recordData[activeType]);
      const recObj = recordData[activeType] ? recordData[activeType][recordIndex] : null;


      if (!recObj) {
        console.error('Record object not found', { activeType, recordIndex, availableData: recordData });
        return;
      }
      
      const name = recObj.name;
      const title = recObj.title;
      
      // Format date properly
      const eventDate = new Date(recObj.timestamp);
      const dateStr = eventDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'numeric', 
        day: 'numeric',
        weekday: 'short'
      });
      
      if(detailTime) detailTime.textContent = `${dateStr} ${recObj.time}`;
      if(detailTitle) detailTitle.textContent = title;
      
      if(detailBody){
        // Get fresh bio data for the detail view
        let freshBioData = null;
        try {
          if (wardedUserId) {
            freshBioData = await fetchLatestBioData(wardedUserId);
            
            // Update vitals with fresh data if available
            if (freshBioData && recObj.detail && recObj.detail.vitals) {
              updateVitalsWithFreshData(recObj.detail.vitals, freshBioData);
            }
          }
        } catch (error) {
          console.error('Error fetching fresh bio data for detail view:', error);
        }
        
        const isResolved = activeType === 'resolved' || activeType === 'resolved_action' || activeType === 'resolved_noissue';
        detailBody.innerHTML = buildDetailHTML(recObj, activeType === 'unconfirmed', activeType === 'confirmed', isResolved, activeType === 'confirmed');

        // 현재 표시 중인 레코드 정보 저장
        currentDisplayedRecord = recObj;
        currentDisplayedType = activeType;

        attachReplyHandlers();

        // 확인 버튼 클릭 이벤트 추가 (미확인 → 확인된 위험신호로 이동)
        const confirmBtn = detailBody.querySelector('.confirm-btn');
        if (confirmBtn && activeType === 'unconfirmed') {
          confirmBtn.onclick = async () => {
            // 미확인 위험신호에서 항목 제거
            const unconfirmedIndex = recordData.unconfirmed.findIndex(r =>
              r.time === recObj.time && r.name === recObj.name && r.eventId === recObj.eventId
            );

            if (unconfirmedIndex !== -1) {
              const confirmedRecord = recordData.unconfirmed[unconfirmedIndex];

              // API 호출로 상태 변경
              const watcherUserId = localStorage.getItem('watcherUserId') || window.API_CONFIG?.WATCHER_USER_ID;
              const eventKey = confirmedRecord.eventId || confirmedRecord.eventKey;

              if (eventKey) {
                const result = await confirmEventAPI(eventKey, watcherUserId);
                if (!result.success && !result.mockMode) {
                  console.error('이벤트 확인 API 호출 실패:', result.error);
                  alert('이벤트 확인 처리 중 오류가 발생했습니다.');
                  return;
                }
              }

              // 미확인에서 제거
              recordData.unconfirmed.splice(unconfirmedIndex, 1);

              // 확인된 위험신호에 추가 (reply 정보 추가)
              confirmedRecord.reply = {
                written: false,
                author: '',
                avatar: '',
                content: ''
              };
              recordData.confirmed.unshift(confirmedRecord);

              // 캐시 로직 비활성화 - DB 상태를 신뢰함
              // saveProcessedEventToCache(confirmedRecord.eventId, 'confirmed', confirmedRecord);

              // 확인된 위험신호 메뉴로 전환하고 이동한 항목 선택
              switchToMenuAndSelectItem('confirmed', confirmedRecord.eventId);

              console.log('항목이 확인된 위험신호로 이동되었습니다:', confirmedRecord.name, confirmedRecord.title);
            }
          };
        }

        // 이슈 없음 버튼 클릭 이벤트 추가 (미확인 → 바로 해결완료로 이동)
        const noIssueBtn = detailBody.querySelector('.no-issue-btn');
        if (noIssueBtn && activeType === 'unconfirmed') {
          noIssueBtn.onclick = async () => {
            const unconfirmedIndex = recordData.unconfirmed.findIndex(r =>
              r.time === recObj.time && r.name === recObj.name && r.eventId === recObj.eventId
            );

            if (unconfirmedIndex !== -1) {
              const resolvedRecord = recordData.unconfirmed[unconfirmedIndex];
              const watcherUserId = localStorage.getItem('watcherUserId') || window.API_CONFIG?.WATCHER_USER_ID;
              const eventKey = resolvedRecord.eventId || resolvedRecord.eventKey;

              if (eventKey) {
                // 먼저 확인 처리
                const confirmResult = await confirmEventAPI(eventKey, watcherUserId, '이슈 없음');
                if (!confirmResult.success && !confirmResult.mockMode) {
                  console.error('이벤트 확인 API 호출 실패:', confirmResult.error);
                  alert('이벤트 처리 중 오류가 발생했습니다.');
                  return;
                }

                // 바로 해결 처리 (이슈없음)
                const resolveResult = await resolveEventAPI(eventKey, watcherUserId, '이슈 없음', 'noissue');
                if (!resolveResult.success && !resolveResult.mockMode) {
                  console.error('이벤트 해결 API 호출 실패:', resolveResult.error);
                  alert('이벤트 처리 중 오류가 발생했습니다.');
                  return;
                }
              }

              // 미확인에서 제거
              recordData.unconfirmed.splice(unconfirmedIndex, 1);

              // 이슈없음으로 추가 (reply 정보 포함)
              resolvedRecord.reply = {
                written: true,
                author: '담당자',
                avatar: 'assets/status_01.png',
                content: '이슈 없음'
              };
              resolvedRecord.resolveType = 'noissue'; // 이슈없음 구분용
              recordData.resolved_noissue.unshift(resolvedRecord);

              // 캐시 로직 비활성화 - DB 상태를 신뢰함
              // saveProcessedEventToCache(resolvedRecord.eventId, 'resolved_noissue', resolvedRecord);

              // 이슈없음 서브탭으로 전환하고 이동한 항목 선택
              switchToMenuAndSelectItem('resolved_noissue', resolvedRecord.eventId);

              console.log('항목이 이슈없음으로 이동되었습니다:', resolvedRecord.name, resolvedRecord.title);
            }
          };
        }

        // 미확인으로 되돌리기 버튼 클릭 이벤트 추가 (해결완료/확인됨 → 미확인으로 이동)
        if (activeType === 'resolved' || activeType === 'confirmed' || activeType === 'resolved_action' || activeType === 'resolved_noissue') {
          attachRevertBtnHandler(recObj, activeType);
        }

        // 위치 카드 클릭 이벤트 추가
        const locationCard = detailBody.querySelector('.location-card-clickable');
        if (locationCard) {
          locationCard.onclick = async () => {
            let lat, lng;
            
            // 저장된 좌표 정보 또는 최신 bioData 사용
            if (recObj.detail.locationCoords) {
              lat = recObj.detail.locationCoords.lat;
              lng = recObj.detail.locationCoords.lng;
            } else if (freshBioData && freshBioData.location && freshBioData.location.length > 0) {
              lat = freshBioData.location[0].latitude;
              lng = freshBioData.location[0].longitude;
            } else {
              alert('위치 정보가 없습니다.');
              return;
            }
            
            const locationInfo = await getLocationName(lat, lng);
            const eventTime = new Date(recObj.timestamp);
            const timeStr = eventTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            showLocationMapWithTime(lat, lng, locationInfo, recObj.name, timeStr);
          };
        }
      }
    });
  });
}

// Update vitals array with fresh bio data
function updateVitalsWithFreshData(vitals, bioData) {
  if (!bioData) return;
  
  // Update heart rate
  if (bioData.heartBeat && bioData.heartBeat.length > 0) {
    const hrVital = vitals.find(v => v.label === '심박수');
    if (hrVital) {
      hrVital.value = `${bioData.heartBeat[0].heartBeat} bpm`;
      hrVital.time = timeAgo(bioData.heartBeat[0].registrationDateTime);
    }
  }
  
  // Update oxygen saturation
  if (bioData.oxygenStatus && bioData.oxygenStatus.length > 0) {
    const spo2Vital = vitals.find(v => v.label === '산소포화도');
    if (spo2Vital) {
      spo2Vital.value = `${bioData.oxygenStatus[0].oxygenSaturation}%`;
      spo2Vital.time = timeAgo(bioData.oxygenStatus[0].registrationDateTime);
    }
  }
  
  // Update steps
  if (bioData.steps && bioData.steps.length > 0 && bioData.steps[0].stepsDaily != null) {
    const stepsVital = vitals.find(v => v.label === '걸음수');
    if (stepsVital) {
      stepsVital.value = bioData.steps[0].stepsDaily.toLocaleString();
      stepsVital.time = dateAgo(bioData.steps[0].step_date);
    }
  }
}

// 미확인으로 되돌리기 버튼 핸들러 (confirmed/resolved 공통)
function attachRevertBtnHandler(recObj, fromType) {
  const detailBody = document.querySelector('.detail-body');
  const revertBtn = detailBody?.querySelector('.revert-btn');
  if (!revertBtn) return;

  revertBtn.onclick = async () => {
    const recordIndex = recordData[fromType].findIndex(r =>
      r.time === recObj.time && r.name === recObj.name && r.eventId === recObj.eventId
    );

    if (recordIndex !== -1) {
      const revertRecord = recordData[fromType][recordIndex];
      const eventKey = revertRecord.eventId || revertRecord.eventKey;

      if (eventKey) {
        // API 호출로 미확인 상태로 되돌리기
        const result = await unconfirmEventAPI(eventKey);
        if (!result.success && !result.mockMode) {
          console.error('이벤트 되돌리기 API 호출 실패:', result.error);
          alert('이벤트 되돌리기 처리 중 오류가 발생했습니다.');
          return;
        }
      }

      // 현재 목록에서 제거
      recordData[fromType].splice(recordIndex, 1);

      // 미확인으로 이동 (reply 정보 제거)
      delete revertRecord.reply;
      recordData.unconfirmed.unshift(revertRecord);

      // 캐시에서 처리 상태 제거
      removeProcessedEventFromCache(revertRecord.eventId);

      // 미확인 메뉴로 전환하고 이동한 항목 선택
      switchToMenuAndSelectItem('unconfirmed', revertRecord.eventId);

      console.log(`항목이 미확인으로 되돌려졌습니다 (from ${fromType}):`, revertRecord.name, revertRecord.title);
    }
  };
}

function attachReplyHandlers(){
  const editor = document.querySelector('.reply-editor');
  if(!editor) {
    // handle '수정' & '완료' buttons after a reply is shown
    const editBtn = document.querySelector('.reply-edit');
    if(editBtn){
      editBtn.onclick = ()=>{
        const selRow = document.querySelector('.record-row.selected-row');
        const type   = 'confirmed'; // only exists in confirmed list
        const time   = selRow.dataset.time;
        const name   = selRow.querySelector('.rec-main .rec-name-title').textContent.split(' ')[0];
        const recObj = recordData[type].find(r=>r.time===time && r.name===name);
        recObj.reply.written = false;          // reopen editor
        const detailBody = document.querySelector('.detail-body');
        detailBody.innerHTML = buildDetailHTML(recObj, false, false, false, true);
        attachReplyHandlers();
        attachRevertBtnHandler(recObj, 'confirmed');
        // pre‑fill textarea with previous content
        const newTextarea = document.querySelector('.reply-text');
        if(newTextarea) newTextarea.value = recObj.reply.content;
      };
    }
    const completeBtn = document.querySelector('.reply-complete');
    if (completeBtn) {
      completeBtn.onclick = async () => {
        const selRow = document.querySelector('.record-row.selected-row');
        if (!selRow) return;
        const time = selRow.dataset.time;
        const name = selRow.querySelector('.rec-main .rec-name-title').textContent.split(' ')[0];
        // remove from confirmed
        const idx = recordData.confirmed.findIndex(r => r.time === time && r.name === name);
        if (idx === -1) return;
        const recObj = recordData.confirmed[idx];

        // API 호출로 상태 변경
        const watcherUserId = localStorage.getItem('watcherUserId') || window.API_CONFIG?.WATCHER_USER_ID;
        const eventKey = recObj.eventId || recObj.eventKey;
        const note = recObj.reply?.content || '';

        if (eventKey) {
          const result = await resolveEventAPI(eventKey, watcherUserId, note, 'action');
          if (!result.success && !result.mockMode) {
            console.error('이벤트 해결 API 호출 실패:', result.error);
            alert('이벤트 해결 처리 중 오류가 발생했습니다.');
            return;
          }
        }

        // confirmed에서 제거
        recordData.confirmed.splice(idx, 1);
        // add to resolved_action (조치완료)
        recObj.resolveType = 'action';
        recordData.resolved_action.unshift(recObj);

        // 캐시 로직 비활성화 - DB 상태를 신뢰함
        // saveProcessedEventToCache(recObj.eventId, 'resolved_action', recObj);

        // 조치완료 서브탭으로 전환하고 이동한 항목 선택
        switchToMenuAndSelectItem('resolved_action', recObj.eventId);
      };
    }
    return;
  }
  const textArea = editor.querySelector('.reply-text');
  editor.querySelector('.reply-submit').onclick = async () => {
    if(!textArea.value.trim()) return alert('내용을 입력하세요');

    // 현재 표시 중인 레코드 사용 (리스트 선택과 무관하게 동작)
    const recObj = currentDisplayedRecord;
    const type = currentDisplayedType;

    if (!recObj || !type) {
      alert('표시된 항목 정보를 찾을 수 없습니다.');
      return;
    }

    const time = recObj.time;
    const name = recObj.name;

    recObj.reply = {
      written:true,
      author:'김석우',
      avatar:'assets/helper_kim.png',
      content:textArea.value
    };

    // API 호출 준비
    const watcherUserId = localStorage.getItem('watcherUserId') || window.API_CONFIG?.WATCHER_USER_ID;
    const eventKey = recObj.eventId || recObj.eventKey;
    const note = textArea.value;

    // Move data between categories based on current type
    if (type === 'unconfirmed') {
      // Move from unconfirmed to confirmed - API 호출
      if (eventKey) {
        const result = await confirmEventAPI(eventKey, watcherUserId, note);
        if (!result.success && !result.mockMode) {
          console.error('이벤트 확인 API 호출 실패:', result.error);
          alert('이벤트 확인 처리 중 오류가 발생했습니다.');
          return;
        }
      }

      const idx = recordData.unconfirmed.findIndex(r => r.time === time && r.name === name);
      if (idx !== -1) {
        const removedRec = recordData.unconfirmed.splice(idx, 1)[0];
        recordData.confirmed.unshift(removedRec);

        // 캐시 로직 비활성화 - DB 상태를 신뢰함
        // saveProcessedEventToCache(removedRec.eventId, 'confirmed', removedRec);

        // 확인된 위험신호 메뉴로 전환하고 이동한 항목 선택
        switchToMenuAndSelectItem('confirmed', removedRec.eventId);
      }
    } else if (type === 'confirmed') {
      // Move from confirmed to resolved_action - API 호출
      if (eventKey) {
        const result = await resolveEventAPI(eventKey, watcherUserId, note, 'action');
        if (!result.success && !result.mockMode) {
          console.error('이벤트 해결 API 호출 실패:', result.error);
          alert('이벤트 해결 처리 중 오류가 발생했습니다.');
          return;
        }
      }

      const idx = recordData.confirmed.findIndex(r => r.time === time && r.name === name);
      if (idx !== -1) {
        const removedRec = recordData.confirmed.splice(idx, 1)[0];
        removedRec.resolveType = 'action';
        recordData.resolved_action.unshift(removedRec);

        // 캐시 로직 비활성화 - DB 상태를 신뢰함
        // saveProcessedEventToCache(removedRec.eventId, 'resolved_action', removedRec);

        // 조치완료 서브탭으로 전환하고 이동한 항목 선택
        switchToMenuAndSelectItem('resolved_action', removedRec.eventId);
      }
    } else {
      // For resolved or other types, just re-render detail
      const detailBody = document.querySelector('.detail-body');
      const activeType = document.querySelector('.sidebar-menu li.active').dataset.type;
      const isResolvedType = activeType === 'resolved' || activeType === 'resolved_action' || activeType === 'resolved_noissue';
      detailBody.innerHTML = buildDetailHTML(recObj, activeType === 'unconfirmed', activeType === 'confirmed', isResolvedType, activeType === 'confirmed');
      attachReplyHandlers();
      if (activeType === 'confirmed' || isResolvedType) {
        attachRevertBtnHandler(recObj, activeType);
      }
    }
  };
}

// (No longer needed: removed duplicate re-attachment/renderTable and attachRecordRowListeners here)
// Vacancy modal logic
const vacancyDetailBtn = document.querySelector('.card-vacancy .card-detail.top-right');
const vacancyModal = document.getElementById('vacancy-modal');
const vacancyModalClose = document.getElementById('vacancy-modal-close');

// --- Vacancy table builder ---
function buildVacancyTable() {
  const tbody = document.getElementById('vacancy-modal-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Collect resident data in original table order (26 residents)
  const residentRows = document.querySelectorAll('.resident-table tbody tr');
  const residents = [];
  residentRows.forEach(row => {
    const nameCell = row.children[0];
    const imgEl = nameCell.querySelector('img');
    const name = nameCell.textContent.trim();
    const img = imgEl ? imgEl.src : '';
    residents.push({ name, img });
  });

  /* Fixed layout map: for each room, define which bed indices (0‑4) are OCCUPIED.
     Beds not listed will show "비어있음". 26 total occupants distributed irregularly. */
  const roomLayout = {
    '101호': [0, 2, 4],      // beds 1,3,5
    '102호': [1, 3],         // beds 2,4
    '103호': [0, 1, 4],      // beds 1,2,5
    '104호': [2, 4],         // beds 3,5
    '105호': [1, 2],         // beds 2,3
    '106호': [0, 3],         // beds 1,4
    '201호': [0, 2, 3, 4],   // beds 1,3,4,5  (4 occupants)
    '202호': [1, 4],         // beds 2,5
    '203호': [0, 1, 3]       // beds 1,2,4   (total occupants = 26)
  };

  const rooms = ['101호','102호','103호','104호','105호','106호','201호','202호','203호'];
  let resIdx = 0;

  rooms.forEach(room => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${room}</td>`;

    for (let bed = 0; bed < 5; bed++) {
      if (roomLayout[room].includes(bed) && resIdx < residents.length) {
        const r = residents[resIdx++];
        tr.innerHTML += `
          <td><img src="${r.img}" class="profile-img">${r.name}</td>`;
      } else {
        tr.innerHTML += `<td class="empty-bed">-</td>`;
      }
    }
    tbody.appendChild(tr);
  });
}

if (vacancyDetailBtn && vacancyModal && vacancyModalClose) {
  vacancyDetailBtn.addEventListener('click', () => {
    buildVacancyTable();
    vacancyModal.classList.remove('hidden');
  });

  vacancyModalClose.addEventListener('click', () => {
    vacancyModal.classList.add('hidden');
  });

  vacancyModal.addEventListener('click', (e) => {
    if (e.target === vacancyModal) {
      vacancyModal.classList.add('hidden');
    }
  });
}
// Toggle alert-section visibility and highlight top 2 residents when logo is clicked
// Check if elements exist before adding event listeners
// 담당자 호출 기능 (logo 클릭) - 주석처리
/*
const logoEl = document.querySelector('.hello-logo');
const alertSectionEl = document.querySelector('.alert-section');
const residentTbody = document.querySelector('.resident-table tbody');

if (logoEl && alertSectionEl && residentTbody) {
  logoEl.addEventListener('click', () => {
  const rows = residentTbody.querySelectorAll('tr');

  if (alertSectionEl.classList.contains('hidden')) {
    // Show alerts and highlight first two rows
    alertSectionEl.classList.remove('hidden');
    if (rows[0]) rows[0].classList.add('selected-row');
    if (rows[1]) rows[1].classList.add('selected-row');
  } else {
    // Hide alerts and remove highlight
    alertSectionEl.classList.add('hidden');
    if (rows[0]) rows[0].classList.remove('selected-row');
    if (rows[1]) rows[1].classList.remove('selected-row');
  }

  // Toggle .status-label.warning for alert rows (rows[0] and rows[1])
  const statusSpan0 = rows[0]?.querySelector('.status-label');
  const statusSpan1 = rows[1]?.querySelector('.status-label');

  if (!alertSectionEl.classList.contains('hidden')) {
    if (statusSpan0) {
      statusSpan0.classList.remove('daily', 'exercise', 'sleep', 'moving');
      statusSpan0.classList.add('warning');
      statusSpan0.textContent = '고심박';
    }
    // 김영수의 심박수(6번째 열, index 5)를 140bpm으로 변경
    if (rows[0]) rows[0].children[5].textContent = '140bpm';
    if (statusSpan1) {
      statusSpan1.classList.remove('daily', 'exercise', 'sleep', 'moving');
      statusSpan1.classList.add('warning');
      statusSpan1.textContent = '낙상';
    }
  } else {
    if (statusSpan0) {
      statusSpan0.classList.remove('warning');
      statusSpan0.classList.add('daily');
      statusSpan0.textContent = '일상생활';
    }
    // 김영수의 심박수(6번째 열, index 5)를 68bpm으로 복원
    if (rows[0]) rows[0].children[5].textContent = '68bpm';
    if (statusSpan1) {
      statusSpan1.classList.remove('warning');
      statusSpan1.classList.add('exercise');
      statusSpan1.textContent = '운동';
    }
  }
  });
}
*/

// ----- Alert "담당자 호출" buttons (modal) -----
const callModal       = document.getElementById('call-modal');
const callModalClose  = document.getElementById('call-modal-close');
const callModalMsg    = document.getElementById('call-modal-message');

function openCallModal(residentName) {
  callModalMsg.innerHTML =
    `${residentName}님 현재 위치 <span class="call-highlight">1층 화장실</span>로 1층 담당자 <strong>이승훈</strong> 관리인 출동 지시 완료`;
  callModal.classList.remove('hidden');
}

document.querySelectorAll('.alert-section .alert-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.alert-card');
    const name = card?.querySelector('.alert-name')?.textContent.trim() || '입소자';
    openCallModal(name);
  });
});

if (callModalClose) {
  callModalClose.addEventListener('click', () => callModal.classList.add('hidden'));
}
if (callModal) {
  callModal.addEventListener('click', e => {
    if (e.target === callModal) callModal.classList.add('hidden');
  });
}
// Call phone button alert
const callPhoneBtn = document.getElementById('call-phone-btn');
if (callPhoneBtn) {
  callPhoneBtn.addEventListener('click', () => {
    alert('전화 기능은 아직 지원되지 않습니다.');
  });
}
document.addEventListener('DOMContentLoaded', () => {
    // 개발용 키보드 단축키 (Ctrl+Shift+R: 캐시 초기화)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            if (clearAllCache()) {
                alert('캐시가 초기화되었습니다. 페이지를 새로고침합니다.');
                location.reload();
            }
        }
    });
    
    // 실제 날짜와 시간으로 업데이트
    const updateDateTime = () => {
        const dateElements = document.querySelectorAll('.dashboard-date, .record-date');
        if (dateElements.length > 0) {
            const today = new Date();
            const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
            const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
            
            const month = months[today.getMonth()];
            const date = today.getDate();
            const day = days[today.getDay()];
            
            // 시간 포맷팅
            let hours = today.getHours();
            const minutes = today.getMinutes();
            const seconds = today.getSeconds();
            const ampm = hours >= 12 ? '오후' : '오전';
            hours = hours % 12 || 12; // 0시를 12시로 변환
            
            const timeStr = `${ampm} ${hours}시 ${minutes.toString().padStart(2, '0')}분 ${seconds.toString().padStart(2, '0')}초`;
            
            dateElements.forEach(element => {
                element.textContent = `${month} ${date}일 ${day} ${timeStr}`;
            });
        }
    };
    
    // 1초마다 시간 업데이트
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    const updateRefreshTime = () => {
        const refreshElement = document.querySelector('.last-refresh');
        if (refreshElement) {
            const now = new Date();
            const diff = Math.floor((now - lastRefreshTime) / 1000); // 초 단위
            
            if (diff < 60) {
                refreshElement.textContent = `${diff}초 전 refresh `;
            } else if (diff < 3600) {
                const minutes = Math.floor(diff / 60);
                refreshElement.textContent = `${minutes}분 전 refresh `;
            } else {
                const hours = Math.floor(diff / 3600);
                refreshElement.textContent = `${hours}시간 전 refresh `;
            }
        }
    };
    
    // 1초마다 새로고침 시간 업데이트
    setInterval(updateRefreshTime, 1000);

    const floorSelectorBtn = document.getElementById('floor-selector-btn');
    const floorOptions = document.getElementById('floor-options');
    const selectedFloorSpan = document.getElementById('selected-floor');
    const floorPlans = document.querySelectorAll('.floor-plan');

    // AWS API Configuration
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const WATCHER_USER_ID = window.API_CONFIG?.WATCHER_USER_ID || 'watcher_001';
    const UPDATE_INTERVAL = window.API_CONFIG?.UPDATE_INTERVAL || 5000;
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
    
    // 피보호자 데이터 캐시 (전역 변수 사용)
    let lastRefreshTime = new Date(); // 마지막 새로고침 시간 추적

    // 목업 데이터 (개발/테스트용)
    const mockData = {
        mappings: [
            { wardedUserId: 'ward001', activeYn: 'o', room: '101호' },
            { wardedUserId: 'ward002', activeYn: 'o', room: '101호' },
            { wardedUserId: 'ward003', activeYn: 'o', room: '101호' },
            { wardedUserId: 'ward004', activeYn: 'o', room: '102호' },
            { wardedUserId: 'ward005', activeYn: 'o', room: '102호' }
        ],
        users: {
            'ward001': { wardedUserId: 'ward001', userName: '김영수', age: '77', profileUrl: 'assets/status_01.png' },
            'ward002': { wardedUserId: 'ward002', userName: '김순자', age: '84', profileUrl: 'assets/status_02.png' },
            'ward003': { wardedUserId: 'ward003', userName: '신영자', age: '82', profileUrl: 'assets/status_03.png' },
            'ward004': { wardedUserId: 'ward004', userName: '김정석', age: '78', profileUrl: 'assets/status_04.png' },
            'ward005': { wardedUserId: 'ward005', userName: '서영숙', age: '84', profileUrl: 'assets/status_05.png' }
        },
        bioData: {
            'ward001': {
                heartBeat: [{ heartBeat: 68 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
                oxygenStatus: [],
                steps: [{ stepsDaily: 3482 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
            },
            'ward002': {
                heartBeat: [{ heartBeat: 72 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
                oxygenStatus: [],
                steps: [{ stepsDaily: 4200 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
            },
            'ward003': {
                heartBeat: [{ heartBeat: 70 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
                oxygenStatus: [],
                steps: [{ stepsDaily: 3800 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
            },
            'ward004': {
                heartBeat: [{ heartBeat: 65 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
                oxygenStatus: [],
                steps: [{ stepsDaily: 2100 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
            },
            'ward005': {
                heartBeat: [{ heartBeat: 69 + Math.floor(Math.random() * 10), registrationDateTime: new Date().toISOString() }],
                oxygenStatus: [],
                steps: [{ stepsDaily: 3300 + Math.floor(Math.random() * 500), step_date: new Date().toISOString().split('T')[0] }]
            }
        },
        events: {
            'FALL_DETECTED': {
                eventId: 'event_001',
                eventType: 'FALL_DETECTED',
                timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
            },
            'HIGH_HEART_RATE_DETECTED': {
                eventId: 'event_002',
                eventType: 'HIGH_HEART_RATE_DETECTED',
                timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString()
            },
            'LOW_HEART_RATE_DETECTED': {
                eventId: 'event_003',
                eventType: 'LOW_HEART_RATE_DETECTED',
                timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
            }
        }
    };

    // Toggle dropdown visibility (only if elements exist)
    if (floorSelectorBtn && floorOptions) {
        floorSelectorBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from immediately closing dropdown
            floorOptions.classList.toggle('hidden');
        });
    }

    // Handle floor selection (only if elements exist)
    if (floorOptions && selectedFloorSpan && floorPlans.length > 0) {
        floorOptions.addEventListener('click', (event) => {
            if (event.target.classList.contains('floor-option')) {
                const selectedFloor = event.target.dataset.floor;

                // Update button text
                selectedFloorSpan.textContent = `${selectedFloor}층`;

                // Hide dropdown
                floorOptions.classList.add('hidden');

                // Switch active floor plan
                floorPlans.forEach(plan => {
                    plan.classList.add('hidden');
                    plan.classList.remove('active');
                });

                const activePlan = document.getElementById(`floor-${selectedFloor}-plan`);
                if (activePlan) {
                    activePlan.classList.remove('hidden');
                    activePlan.classList.add('active');
                }
            }
        });

        // Close dropdown if clicking outside
        document.addEventListener('click', () => {
            if (!floorOptions.classList.contains('hidden')) {
                floorOptions.classList.add('hidden');
            }
        });
    }

    // AWS API 호출 함수들
    async function fetchMappings() {
        console.log('fetchMappings 호출됨');
        console.log('API_BASE_URL:', API_BASE_URL);
        console.log('ENABLE_MOCK_DATA:', ENABLE_MOCK_DATA);
        console.log('Full URL:', `${API_BASE_URL}/watcher/mappings?watcherUserId=${WATCHER_USER_ID}`);
        console.log('window.fetchMappings exists:', typeof window.fetchMappings);
        console.log('window.fetchMappings === fetchMappings:', window.fetchMappings === fetchMappings);
        
        // 데모 모드에서는 window.fetchMappings 사용 (demo-controller가 오버라이드함)
        if (ENABLE_MOCK_DATA && window.fetchMappings && window.fetchMappings !== fetchMappings) {
            console.log('🎭 데모 컨트롤러의 fetchMappings 사용');
            return window.fetchMappings();
        }
        
        if (ENABLE_MOCK_DATA) {
            console.log('📦 기본 mockData.mappings 사용');
            return mockData.mappings;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/watcher/mappings?watcherUserId=${WATCHER_USER_ID}`, {
                headers: {'Content-Type': 'application/json'}
            });
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            if (data.code === "1000") {
                // 임시로 하드코딩된 피보호자 ID만 필터링
                const hardcodedWardedIds = ['4413234689', '3736040963', '4405481384'];
                const filtered = data.response.filter(m =>
                    hardcodedWardedIds.includes(m.wardedUserId) &&
                    (m.activeYn === 'o' || m.activeYn === 'y')
                );

                // 하윤정 -> 김호중 하드코딩 변경
                const transformedMappings = filtered.map(mapping => {
                    if (mapping.userName === '하윤정') {
                        console.log('🔄 하윤정 -> 김호중으로 변경');
                        return {
                            ...mapping,
                            userName: '김호중',
                            age: '50'  // 50대로 변경
                        };
                    }
                    return mapping;
                });

                console.log('Filtered mappings (hardcoded IDs):', transformedMappings);
                return transformedMappings;
            } else {
                console.log('API returned error code:', data.code, data.message);
            }
        } catch (error) {
            console.error('Error fetching mappings:', error);
        }
        return [];
    }

    // B2B 인원관리 연동: 워치-입소자 연결 기반 데이터 조회
    async function fetchDevicesForDashboard() {
        console.log('fetchDevicesForDashboard 호출됨');
        console.log('API_BASE_URL:', API_BASE_URL);

        try {
            // 1. 입소자 전체 정보 먼저 가져오기 (age, gender 등 완전한 정보)
            const residentsStart = performance.now();
            const residentsResponse = await fetch(`${API_BASE_URL}/watcher/residents?watcherUserId=${WATCHER_USER_ID}`, {
                headers: {'Content-Type': 'application/json'}
            });
            const residentsData = await residentsResponse.json();
            console.log(`⏱️ [성능] /watcher/residents API: ${(performance.now() - residentsStart).toFixed(0)}ms`);

            const residentsMap = {};
            if (residentsData.code === '1000' && residentsData.response) {
                residentsData.response.forEach(r => {
                    residentsMap[r.wardedUserId] = r;
                });
            }
            console.log('Residents map:', residentsMap);

            // 2. 디바이스 정보 가져오기
            const devicesStart = performance.now();
            const response = await fetch(`${API_BASE_URL}/watcher/devices?watcherUserId=${WATCHER_USER_ID}`, {
                headers: {'Content-Type': 'application/json'}
            });
            console.log('Devices response status:', response.status);
            const data = await response.json();
            console.log(`⏱️ [성능] /watcher/devices API: ${(performance.now() - devicesStart).toFixed(0)}ms`);
            console.log('Devices response data:', data);

            if (data.code === "1000") {
                // 연결된 입소자가 있는 워치만 필터링
                const connectedDevices = data.response.filter(device => device.connectedResident !== null);
                console.log('Connected devices:', connectedDevices);

                // 기존 wardedUsers 형식으로 변환 (입소자 정보는 residents API에서 가져옴)
                const mappings = connectedDevices.map(device => {
                    const residentId = device.connectedResident.wardedUserId;
                    const fullResidentInfo = residentsMap[residentId] || {};

                    return {
                        // 생체데이터 조회용 (워치 시리얼 = bio_data의 wardedUserId)
                        wardedUserId: device.deviceId,
                        // 화면 표시용 입소자 정보 (residents API에서 완전한 정보 사용)
                        userName: fullResidentInfo.userName || device.connectedResident.userName,
                        age: fullResidentInfo.age || 0,
                        gender: fullResidentInfo.gender || '',
                        phoneNo: fullResidentInfo.phoneNumber || '',
                        room: fullResidentInfo.room || '미지정',
                        // 프로필 표시용 (이모지 + 배경색)
                        profileEmoji: fullResidentInfo.profileEmoji || device.connectedResident.profileEmoji || '👤',
                        profileColor: fullResidentInfo.profileColor || device.connectedResident.profileColor || '#E5E7EB',
                        userProfileUrl: null, // 이모지 사용으로 URL 불필요
                        // 워치 상태 정보 (새 API 필드)
                        isWorn: device.isWorn,
                        batteryLevel: device.batteryLevel,
                        isCharging: device.isCharging,
                        // 원본 입소자 ID (참조용)
                        residentId: residentId
                    };
                });

                console.log('Transformed mappings from devices:', mappings);
                return mappings;
            } else {
                console.log('API returned error code:', data.code, data.message);
            }
        } catch (error) {
            console.error('Error fetching devices for dashboard:', error);
        }
        return [];
    }

    async function fetchWardedUserInfo(wardedUserId) {
        if (ENABLE_MOCK_DATA) {
            return mockData.users[wardedUserId];
        }
        
        try {
            const url = `${API_BASE_URL}/ward/user?wardedUserId=${wardedUserId}`;
            console.log('Fetching user info from:', url);
            
            const response = await fetch(url, {
                headers: {'Content-Type': 'application/json'}
            });
            console.log('User info response status:', response.status);
            
            const data = await response.json();
            console.log('User info response:', data);
            
            if (data.code === "1000") {
                return data.response;
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
        return null;
    }

    async function fetchLatestBioData(wardedUserId) {
        // 데모 모드에서는 window.fetchLatestBioData 사용 (demo-controller가 오버라이드함)
        if (ENABLE_MOCK_DATA && window.fetchLatestBioData !== fetchLatestBioData) {
            console.log('🎭 데모 컨트롤러의 fetchLatestBioData 사용');
            return window.fetchLatestBioData(wardedUserId);
        }
        
        if (ENABLE_MOCK_DATA) {
            // 목업 데이터에 약간의 변동 추가
            const baseBio = mockData.bioData[wardedUserId];
            if (!baseBio) return null;
            
            return {
                ...baseBio,
                heartBeat: [{ heartBeat: baseBio.heartBeat[0].heartBeat + Math.floor(Math.random() * 10 - 5), registrationDateTime: new Date().toISOString() }],
                oxygenStatus: [],
                steps: [{ stepsDaily: baseBio.steps[0].stepsDaily + Math.floor(Math.random() * 100), step_date: new Date().toISOString().split('T')[0] }]
            };
        }
        
        try {
            // 성공한 엔드포인트 사용 (옵션 4)
            const url = `${API_BASE_URL}/watcher?wardedUserId=${wardedUserId}`;
            console.log('Fetching bio data from:', url);
            
            const response = await fetch(url, { headers: {'Content-Type': 'application/json'} });
            console.log('Bio data response status:', response.status);
            
            const data = await response.json();
            console.log(`Bio data for ${wardedUserId}:`, data);
            
            if (data.code === "1000") {
                console.log('Bio data response:', data.response);
                return data.response;
            } else {
                console.log('API error:', data);
            }
        } catch (error) {
            console.error('Error fetching bio data:', error);
        }
        return null;
    }

    async function fetchEvents() {
        // 데모 모드에서는 window.fetchEvents 사용 (demo-controller가 오버라이드함)
        if (ENABLE_MOCK_DATA && window.fetchEvents !== fetchEvents) {
            console.log('🎭 데모 컨트롤러의 fetchEvents 사용');
            return window.fetchEvents();
        }
        
        if (ENABLE_MOCK_DATA) {
            return mockData.events;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/watcher/event?watcherUserId=${WATCHER_USER_ID}`, {
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
            if (data.code === "1000") {
                return data.response;
            }
        } catch (error) {
            console.error('Error fetching events:', error);
        }
        return [];
    }

    // 나이를 변환하는 함수
    function formatAge(age) {
        const ageNum = parseInt(String(age));
        if (!isNaN(ageNum)) {
            return `${ageNum}세`;
        }
        return String(age) + '세';
    }

    // 상태 맵핑 테이블
    const statusMapping = {
        statusUnknown: '확인중',
        statusRelax: '일상생활',
        statusWalk: '일상생활',
        statusRun: '운동',
        statusExercise: '운동',
        statusBicycle: '이동',
        statusCar: '이동',
        statusSleep: '수면'
    };

    const statusMappingPhoneLatest = {
        'USER_ACTIVITY_PASSIVE': {
            'ActivityType.STILL': 'statusRelax',
            'ActivityType.WALKING': 'statusWalk',
            'ActivityType.RUNNING': 'statusRun',
            'ActivityType.ON_BICYCLE': 'statusBicycle',
            'ActivityType.IN_VEHICLE': 'statusCar',
            'ActivityType.UNKNOWN': 'statusRelax',
        },
        'USER_ACTIVITY_WORKING': {
            'ActivityType.STILL': 'statusRelax',
            'ActivityType.WALKING': 'statusWalk',
            'ActivityType.RUNNING': 'statusRun',
            'ActivityType.ON_BICYCLE': 'statusBicycle',
            'ActivityType.IN_VEHICLE': 'statusCar',
            'ActivityType.UNKNOWN': 'statusRelax',
        },
        'USER_ACTIVITY_EXERCISE': {
            'ActivityType.STILL': 'statusRelax',
            'ActivityType.WALKING': 'statusWalk',
            'ActivityType.RUNNING': 'statusRun',
            'ActivityType.ON_BICYCLE': 'statusBicycle',
            'ActivityType.IN_VEHICLE': 'statusCar',
            'ActivityType.UNKNOWN': 'statusExercise',
        },
        'USER_ACTIVITY_EXERCISING': {
            'ActivityType.STILL': 'statusExercise',
            'ActivityType.WALKING': 'statusExercise',
            'ActivityType.RUNNING': 'statusRun',
            'ActivityType.ON_BICYCLE': 'statusBicycle',
            'ActivityType.IN_VEHICLE': 'statusCar',
            'ActivityType.UNKNOWN': 'statusExercise',
        },
        'USER_ACTIVITY_ASLEEP': {
            'ActivityType.STILL': 'statusSleep',
            'ActivityType.WALKING': 'statusWalk',
            'ActivityType.RUNNING': 'statusRun',
            'ActivityType.ON_BICYCLE': 'statusBicycle',
            'ActivityType.IN_VEHICLE': 'statusCar',
            'ActivityType.UNKNOWN': 'statusSleep',
        },
        'USER_ACTIVITY_SLEEPING': {
            'ActivityType.STILL': 'statusSleep',
            'ActivityType.WALKING': 'statusWalk',
            'ActivityType.RUNNING': 'statusRun',
            'ActivityType.ON_BICYCLE': 'statusBicycle',
            'ActivityType.IN_VEHICLE': 'statusCar',
            'ActivityType.UNKNOWN': 'statusSleep',
        },
        'USER_ACTIVITY_UNKNOWN': {
            'ActivityType.STILL': 'statusRelax',
            'ActivityType.WALKING': 'statusWalk',
            'ActivityType.RUNNING': 'statusRun',
            'ActivityType.ON_BICYCLE': 'statusBicycle',
            'ActivityType.IN_VEHICLE': 'statusCar',
            'ActivityType.UNKNOWN': 'statusUnknown',
        }
    };

    // 상태 클래스 맵핑
    const statusClassMap = {
        '확인중': 'unknown',
        '일상생활': 'daily',
        '운동': 'exercise',
        '이동': 'moving',
        '수면': 'sleep'
    };

    // 날짜 차이를 표시하는 함수 (걸음수용)
    function dateAgo(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        
        const difference = today - date; // milliseconds
        const days = Math.floor(difference / 86400000);
        
        if (days === 0) {
            return '오늘';
        } else if (days === 1) {
            return '1일전';
        } else {
            return `${days}일전`;
        }
    }

    // 시간 차이를 표시하는 함수
    function timeAgo(dateString, isCalculated = false) {
        const date = new Date(dateString);
        const now = new Date();
        const difference = now - date; // milliseconds
        
        const minutes = Math.floor(difference / 60000);
        const hours = Math.floor(difference / 3600000);
        const days = Math.floor(difference / 86400000);
        
        if (isCalculated && minutes > 60) {
            if (minutes % 15 === 0) {
                return '방금 전';
            }
            return `${minutes % 15}분 전`;
        }
        
        if (days > 1) {
            return `${days}일 전`;
        } else if (days === 1) {
            return '1일 전';
        } else if (hours > 1) {
            return `${hours}시간 전`;
        } else if (hours === 1) {
            return '1시간 전';
        } else if (minutes > 1) {
            return `${minutes}분 전`;
        } else if (minutes === 1) {
            return '1분 전';
        } else {
            return '방금 전';
        }
    }

    // 툴팁을 표시하는 함수
    function showTooltip(element, text) {
        // 기존 툴팁 제거
        const existingTooltip = document.querySelector('.bio-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // 새 툴팁 생성
        const tooltip = document.createElement('div');
        tooltip.className = 'bio-tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);
        
        // 위치 계산
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
        
        // 화면 밖으로 나가지 않도록 조정
        if (tooltip.offsetLeft < 5) {
            tooltip.style.left = '5px';
        }
        if (tooltip.offsetLeft + tooltip.offsetWidth > window.innerWidth - 5) {
            tooltip.style.left = (window.innerWidth - tooltip.offsetWidth - 5) + 'px';
        }
    }

    // 툴팁을 숨기는 함수
    function hideTooltip() {
        const tooltip = document.querySelector('.bio-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    // 상태 라벨 결정 함수
    function determineStatus(bioData, events) {
        // 데모 모드의 특수 상태 체크
        if (bioData.specialStatus) {
            const specialStatusMap = {
                'FALL': { class: 'warning', text: '낙상' },
                'EMERGENCY': { class: 'warning', text: '긴급확인' },
                'WANDERING': { class: 'warning', text: '배회중' },
                'ATTENTION': { class: 'caution', text: '주의필요' },
                'CRITICAL': { class: 'danger', text: '응급' }
            };
            
            if (specialStatusMap[bioData.specialStatus]) {
                return specialStatusMap[bioData.specialStatus];
            }
        }
        
        // 데모 모드에서 직접 상태가 설정된 경우
        if (bioData.status) {
            const statusClassMap = {
                '낙상': 'warning',
                '긴급확인': 'warning',
                '배회중': 'warning',
                '주의필요': 'caution',
                '응급': 'danger',
                '일상생활': 'daily',
                '운동': 'exercise',
                '이동': 'moving',
                '수면': 'sleep'
            };
            return { class: statusClassMap[bioData.status] || 'unknown', text: bioData.status };
        }
        
        // events가 배열인지 확인
        if (!Array.isArray(events)) {
            console.warn('determineStatus: events is not an array:', events);
            return { status: '정상', eventCount: 0 };
        }

        // 해당 사용자의 모든 이벤트 찾기
        const userEvents = events.filter(e => e.wardedUserId === bioData.wardedUserId);

        if (userEvents.length > 0) {
            // 시간순으로 정렬 (최신순)
            userEvents.sort((a, b) => new Date(b.registrationDateTime || b.timestamp) - new Date(a.registrationDateTime || a.timestamp));

            console.log(`👤 ${bioData.wardedUserId}의 이벤트 ${userEvents.length}개:`, userEvents.map(e => ({
                eventId: e.eventId || e.eventKey,
                eventType: e.eventType,
                status: e.status,
                time: e.registrationDateTime || e.timestamp
            })));

            // 각 이벤트를 시간순으로 확인하여 UNCONFIRMED인 가장 최근 이벤트 찾기
            for (const event of userEvents) {
                // DB 상태 필드 우선 확인 (백엔드 API 응답)
                const dbStatus = event.status;

                // UNCONFIRMED 상태이거나 status 필드가 없는 경우 (이전 데이터 호환)
                if (!dbStatus || dbStatus === 'UNCONFIRMED') {
                    // 캐시도 확인 (백업용)
                    const cachedStatus = getProcessedEventFromCache(event.eventId || event.eventKey);

                    // DB가 UNCONFIRMED이고 캐시도 없거나 unconfirmed인 경우 경고 표시
                    if (!cachedStatus || cachedStatus.category === 'unconfirmed') {
                        console.log(`⚠️ 미처리 이벤트 발견: ${event.eventId || event.eventKey} (${event.eventType}) - DB상태: ${dbStatus}`);
                        switch(event.eventType) {
                            case 'FALL_DETECTED': return { class: 'warning', text: '낙상' };
                            case 'HIGH_HEART_RATE_DETECTED': return { class: 'warning', text: '빈맥' };
                            case 'LOW_HEART_RATE_DETECTED': return { class: 'warning', text: '서맥' };
                        }
                    }
                } else {
                    console.log(`✅ 처리된 이벤트: ${event.eventId || event.eventKey} (DB상태: ${dbStatus})`);
                }
            }

            console.log(`✨ ${bioData.wardedUserId}: 모든 이벤트가 처리되어 일반 상태로 표시`);
        }
        
        // userActionStatus와 phoneUserStatus 조합으로 상태 결정
        let userAction = 'USER_ACTIVITY_UNKNOWN';
        let phoneStatus = 'ActivityType.UNKNOWN';
        
        // 가장 최신 userActionStatus 가져오기
        if (bioData.userActionStatus && bioData.userActionStatus.length > 0) {
            userAction = bioData.userActionStatus[0].userActionStatus || 'USER_ACTIVITY_UNKNOWN';
            console.log('Latest userActionStatus:', userAction);
        }
        
        // 가장 최신 phoneUserStatus 가져오기
        if (bioData.phoneUserStatus && bioData.phoneUserStatus.length > 0) {
            phoneStatus = bioData.phoneUserStatus[0].type || 'ActivityType.UNKNOWN';
            console.log('Latest phoneUserStatus:', phoneStatus);
        }
        
        // 맵핑 테이블에서 상태 키 가져오기
        const statusKey = statusMappingPhoneLatest[userAction]?.[phoneStatus] || 'statusUnknown';
        console.log(`Status mapping: ${userAction} + ${phoneStatus} = ${statusKey}`);
        
        // 상태 텍스트와 클래스 결정
        const statusText = statusMapping[statusKey] || '확인중';
        const statusClass = statusClassMap[statusText] || 'unknown';
        
        return { class: statusClass, text: statusText };
    }

    // 테이블 렌더링 함수 - 캐시 사용으로 최적화
    async function renderResidentTable() {
        const tbody = document.querySelector('.resident-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">데이터 로딩 중...</td></tr>';

        // 성능 측정 시작
        const perfStart = performance.now();
        console.log('⏱️ [성능] renderResidentTable 시작');

        try {
            let mappings;
            let events;
            let usersWithBioData = [];

            // 데모 모드와 실제 API 모드 분기
            if (ENABLE_MOCK_DATA) {
                // === 데모 모드 - 기존 로직 유지 (demo-controller 오버라이드 지원) ===
                const mappingStart = performance.now();
                mappings = await window.fetchMappings();
                console.log('🎭 데모 모드 - fetchMappings 사용');
                console.log(`⏱️ [성능] 매핑 데이터 로드: ${(performance.now() - mappingStart).toFixed(0)}ms`);

                if (mappings.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">등록된 입소자가 없습니다.</td></tr>';
                    return;
                }

                // wardedUsers 구성
                wardedUsers = [];
                for (const mapping of mappings) {
                    wardedUsers.push({
                        wardedUserId: mapping.wardedUserId,
                        userName: mapping.userName,
                        age: mapping.age,
                        profileUrl: mapping.userProfileUrl,
                        profileEmoji: mapping.profileEmoji,
                        profileColor: mapping.profileColor,
                        gender: mapping.gender,
                        phoneNo: mapping.phoneNo,
                        room: mapping.room || '미지정',
                        isWorn: mapping.isWorn,
                        batteryLevel: mapping.batteryLevel,
                        isCharging: mapping.isCharging,
                        deviceId: mapping.deviceId // deviceId 추가
                    });
                }

                // 이벤트 데이터
                const eventsStart = performance.now();
                events = await (window.fetchEvents || fetchEvents)();
                console.log(`⏱️ [성능] 이벤트 데이터 로드: ${(performance.now() - eventsStart).toFixed(0)}ms`);

                // 생체 데이터
                const bioDataStart = performance.now();
                for (const user of wardedUsers) {
                    const bioData = await (window.fetchLatestBioData || fetchLatestBioData)(user.wardedUserId);
                    usersWithBioData.push({
                        ...user,
                        bioData: bioData,
                        hasSpecialStatus: bioData && (bioData.specialStatus ||
                            ['낙상', '긴급확인', '배회중', '주의필요', '응급'].includes(bioData.status))
                    });
                }
                console.log(`⏱️ [성능] 전체 생체 데이터 로드 (${wardedUsers.length}명): ${(performance.now() - bioDataStart).toFixed(0)}ms`);

            } else {
                // === 실제 API 모드 - 캐시 사용으로 최적화 ===
                console.log('📡 실제 API 모드 - 캐시 사용');
                const cacheStart = performance.now();
                const cache = await loadDashboardData();
                console.log(`⏱️ [성능] 캐시 데이터 로드: ${(performance.now() - cacheStart).toFixed(0)}ms`);

                // 활성 입소자만 필터링
                const activeResidents = (cache.residents || []).filter(r => r.activeYn?.toLowerCase() === 'y');
                const activeResidentIds = activeResidents.map(r => r.wardedUserId);

                // 연결된 디바이스에서 매핑 구성
                const connectedDevices = (cache.devices || []).filter(d =>
                    d.connectedResident && activeResidentIds.includes(d.connectedResident.wardedUserId)
                );

                if (connectedDevices.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">등록된 입소자가 없습니다. 인원관리에서 입소자와 워치를 연결해주세요.</td></tr>';
                    return;
                }

                // wardedUsers 구성 (캐시된 디바이스 + residents 정보 병합)
                // devices의 connectedResident에는 age 등 일부 필드가 없을 수 있으므로 residents에서 보완
                const residentsMap = new Map(activeResidents.map(r => [r.wardedUserId, r]));

                wardedUsers = connectedDevices.map(d => {
                    const residentInfo = residentsMap.get(d.connectedResident.wardedUserId) || {};
                    return {
                        wardedUserId: d.connectedResident.wardedUserId,
                        userName: d.connectedResident.userName || residentInfo.userName,
                        age: d.connectedResident.age || residentInfo.age,
                        profileUrl: d.connectedResident.userProfileUrl || residentInfo.userProfileUrl,
                        profileEmoji: d.connectedResident.profileEmoji || residentInfo.profileEmoji,
                        profileColor: d.connectedResident.profileColor || residentInfo.profileColor,
                        gender: d.connectedResident.gender || residentInfo.gender,
                        phoneNo: d.connectedResident.phoneNo || residentInfo.phoneNo,
                        room: d.connectedResident.room || residentInfo.room || '미지정',
                        isWorn: d.isWorn,
                        batteryLevel: d.batteryLevel,
                        isCharging: d.isCharging,
                        deviceId: d.deviceId
                    };
                });

                // 이벤트 (캐시에서) - 이벤트의 wardedUserId는 deviceId(카카오ID) 형태
                const connectedDeviceIds = connectedDevices.map(d => d.deviceId);
                events = (cache.events || []).filter(e => connectedDeviceIds.includes(e.wardedUserId));

                // 생체 데이터 (캐시에서)
                for (const user of wardedUsers) {
                    const cachedBio = cache.bioData[user.wardedUserId];
                    usersWithBioData.push({
                        ...user,
                        bioData: cachedBio || null,
                        hasSpecialStatus: cachedBio && (cachedBio.specialStatus ||
                            ['낙상', '긴급확인', '배회중', '주의필요', '응급'].includes(cachedBio.status))
                    });
                }
                console.log(`⏱️ [성능] 캐시에서 ${wardedUsers.length}명 데이터 로드 완료`);
            }

            console.log('전체 매핑 정보:', wardedUsers);
            
            // 3-2. 특수 상태가 있는 사용자를 먼저 정렬
            usersWithBioData.sort((a, b) => {
                if (a.hasSpecialStatus && !b.hasSpecialStatus) return -1;
                if (!a.hasSpecialStatus && b.hasSpecialStatus) return 1;
                return 0;
            });

            // 4. 초기 테이블 렌더링 - dashboard.html 새 컬럼 구조에 맞춤
            tbody.innerHTML = '';
            usersWithBioData.forEach((user, index) => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-warded-id', user.wardedUserId); // wardedUserId 추가
                if (user.deviceId) {
                    tr.setAttribute('data-device-id', user.deviceId); // deviceId 추가
                }
                
                // 특수 상태가 있는 경우 row에 클래스 추가
                if (user.hasSpecialStatus) {
                    tr.classList.add('special-status-row');
                    // 상태별 구분
                    if (user.bioData) {
                        if (user.bioData.status === '응급' || user.bioData.specialStatus === 'CRITICAL') {
                            tr.classList.add('emergency-row');
                        } else if (user.bioData.status === '낙상' || user.bioData.specialStatus === 'FALL') {
                            tr.classList.add('fall-row');
                        } else if (user.bioData.status === '긴급확인' || user.bioData.specialStatus === 'EMERGENCY') {
                            tr.classList.add('alert-row');
                        } else if (user.bioData.status === '배회중' || user.bioData.specialStatus === 'WANDERING') {
                            tr.classList.add('wandering-row');
                        } else if (user.bioData.status === '주의필요' || user.bioData.specialStatus === 'ATTENTION') {
                            tr.classList.add('attention-row');
                        }
                    }
                }
                
                // 프로필 렌더링: 이모지 있으면 이모지 사용, 없으면 기존 이미지 사용
                let profileHtml;
                if (user.profileEmoji) {
                    // B2B 인원관리에서 등록한 이모지 프로필
                    profileHtml = `<div class="profile-avatar" style="background-color:${user.profileColor || '#E5E7EB'}">${user.profileEmoji}</div> ${user.userName}`;
                } else {
                    // 기존 이미지 프로필 (데모 모드 또는 B2C)
                    profileHtml = `<img src="${user.profileUrl || 'assets/status_01.png'}" alt="${user.userName} 프로필" class="profile-img"> ${user.userName}`;
                }

                tr.innerHTML = `
                    <td>${profileHtml}</td>
                    <td>${formatAge(user.age)}</td>
                    <td><span class="status-label daily">일상생활</span></td>
                    <td class="location">--</td>
                    <td class="outing-report">--</td>
                    <td class="heart-rate">--bpm</td>
                    <td class="steps">--</td>
                    <td class="watch-status">--</td>
                `;
                tbody.appendChild(tr);
            });

            // 5. 생체 데이터 업데이트 시작
            // events가 Promise인 경우 await 처리
            const resolvedEvents = await Promise.resolve(events);
            
            // wardedUsers를 정렬된 순서로 업데이트
            wardedUsers = usersWithBioData.map(u => ({
                wardedUserId: u.wardedUserId,
                userName: u.userName,
                age: u.age,
                profileUrl: u.profileUrl,
                // 이모지 프로필 지원 (B2B 인원관리)
                profileEmoji: u.profileEmoji,
                profileColor: u.profileColor,
                gender: u.gender,
                phoneNo: u.phoneNo,
                room: u.room,
                // 워치 상태 정보 (B2B 새 API 필드)
                isWorn: u.isWorn,
                batteryLevel: u.batteryLevel,
                isCharging: u.isCharging,
                // deviceId 추가 (API 호출 시 필요)
                deviceId: u.deviceId
            }));
            
            updateResidentVitals(Array.isArray(resolvedEvents) ? resolvedEvents : []);
            
            // 초기 로드 시 마지막 새로고침 시간 설정
            lastRefreshTime = new Date();

        } catch (error) {
            console.error('Error rendering table:', error);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">데이터 로드 실패</td></tr>';
        }
    }

    // 알림 섹션 동적 업데이트 함수 (UNCONFIRMED + CONFIRMED 이벤트)
    // 토스트 스타일 버전 (USE_TOAST_ALERTS = true) / 기존 좌우 배치 버전 (USE_TOAST_ALERTS = false)
    const USE_TOAST_ALERTS = true; // 롤백 시 false로 변경

    async function updateAlertSection(events = []) {
        // record.html에서는 토스트 표시 안 함
        if (window.location.pathname.includes('record.html')) {
            return;
        }

        const priorityEventTypes = ['LOW_HEART_RATE_DETECTED', 'FALL_DETECTED', 'HIGH_HEART_RATE_DETECTED'];

        // UNCONFIRMED 이벤트 (빨간색 긴급 토스트)
        const unconfirmedEvents = events.filter(e =>
            (!e.status || e.status === 'UNCONFIRMED') &&
            priorityEventTypes.includes(e.eventType)
        );

        // CONFIRMED 이벤트 (주황색 일반 알림 토스트)
        const confirmedEvents = events.filter(e =>
            e.status === 'CONFIRMED' &&
            priorityEventTypes.includes(e.eventType)
        );

        console.log('🔔 UNCONFIRMED 이벤트 수:', unconfirmedEvents.length);
        console.log('🟠 CONFIRMED 이벤트 수:', confirmedEvents.length);

        if (USE_TOAST_ALERTS) {
            // === 토스트 스타일 (우측 상단에 세로로 쌓임) ===
            updateToastAlerts(unconfirmedEvents, confirmedEvents);
        } else {
            // === 기존 좌우 배치 스타일 (최대 2개, UNCONFIRMED만) ===
            updateLegacyAlerts(unconfirmedEvents);
        }
    }

    // 토스트 스타일 알림 (우측 상단, 개수 제한 없음)
    function updateToastAlerts(unconfirmedEvents, confirmedEvents = []) {
        // 기존 alert-section 숨기기
        const alertSection = document.querySelector('.alert-section');
        if (alertSection) alertSection.classList.add('hidden');

        // 토스트 컨테이너 생성 또는 가져오기
        let toastContainer = document.querySelector('.toast-alert-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-alert-container';
            document.body.appendChild(toastContainer);
        }

        // 모든 이벤트 합치기 (unconfirmed 먼저, confirmed 나중에)
        const allEvents = [
            ...unconfirmedEvents.map(e => ({ ...e, toastType: 'danger' })),
            ...confirmedEvents.map(e => ({ ...e, toastType: 'warning' }))
        ];

        // 현재 표시된 토스트의 eventKey 목록
        const existingKeys = new Set(
            Array.from(toastContainer.querySelectorAll('.toast-alert-card'))
                .map(card => card.dataset.eventKey)
        );

        // 새 이벤트의 eventKey 목록
        const newKeys = new Set(allEvents.map(e => e.eventKey));

        // 사라진 이벤트의 토스트 제거
        toastContainer.querySelectorAll('.toast-alert-card').forEach(card => {
            if (!newKeys.has(card.dataset.eventKey)) {
                card.classList.add('removing');
                setTimeout(() => card.remove(), 300);
            }
        });

        // 새 이벤트 추가
        for (const event of allEvents) {
            if (existingKeys.has(event.eventKey)) continue; // 이미 표시 중

            // 이벤트의 wardedUserId는 deviceId(카카오ID) 형태이므로 deviceId로 매칭
            const user = wardedUsers.find(u => u.deviceId === event.wardedUserId);
            if (!user) {
                console.log('⚠️ 토스트: 유저 매칭 실패', event.wardedUserId, wardedUsers.map(u => u.deviceId));
                continue;
            }

            const eventDetails = {
                'LOW_HEART_RATE_DETECTED': {
                    title: '낮은 심박수 감지',
                    desc: event.toastType === 'danger'
                        ? '심박수가 40bpm 이하입니다. 즉시 확인이 필요합니다.'
                        : '심박수 이상 확인 중입니다.'
                },
                'HIGH_HEART_RATE_DETECTED': {
                    title: '높은 심박수 감지',
                    desc: event.toastType === 'danger'
                        ? '심박수가 120bpm 이상입니다. 도움이 필요하신지 확인이 필요합니다.'
                        : '심박수 이상 확인 중입니다.'
                },
                'FALL_DETECTED': {
                    title: '낙상 감지',
                    desc: event.toastType === 'danger'
                        ? '낙상이 확인되었습니다. 도움이 필요하신지 확인이 필요합니다.'
                        : '낙상 상황 확인 중입니다.'
                }
            };

            const details = eventDetails[event.eventType] || { title: '이벤트 감지', desc: '확인이 필요합니다.' };
            const isWarning = event.toastType === 'warning';

            // 프로필 HTML 생성 (이모지 또는 이미지)
            let profileHtml;
            if (user.profileEmoji && user.profileColor) {
                profileHtml = `<div class="alert-profile emoji-profile" style="background-color: ${user.profileColor};">${user.profileEmoji}</div>`;
            } else if (user.profileUrl) {
                profileHtml = `<img src="${user.profileUrl}" class="alert-profile">`;
            } else {
                profileHtml = `<img src="assets/status_01.png" class="alert-profile">`;
            }

            const toastCard = document.createElement('div');
            toastCard.className = `toast-alert-card${isWarning ? ' warning' : ''}`;
            toastCard.dataset.eventKey = event.eventKey;
            toastCard.dataset.wardedUserId = event.wardedUserId;
            toastCard.dataset.toastType = event.toastType;
            toastCard.innerHTML = `
                ${profileHtml}
                <div class="alert-info">
                    <span class="alert-name">${user.userName}</span>
                    <span class="alert-title">
                        <img src="assets/caution_icon.png" class="alert-icon">
                        ${details.title}${isWarning ? ' (확인중)' : ''}
                    </span>
                    <span class="alert-desc">${details.desc}</span>
                </div>
                <button class="alert-btn">${isWarning ? '상세' : '확인'}</button>
                <button class="toast-close-btn">&times;</button>
            `;

            // 버튼 클릭 → record.html로 이동 (eventKey 전달)
            const alertBtn = toastCard.querySelector('.alert-btn');
            alertBtn.addEventListener('click', () => {
                const urlParams = new URLSearchParams(window.location.search);
                const isDemoMode = urlParams.get('demo') === 'true';
                let targetUrl = isDemoMode ? 'record.html?demo=true' : 'record.html';
                // eventKey를 URL 파라미터로 전달하여 해당 항목 하이라이트
                targetUrl += (targetUrl.includes('?') ? '&' : '?') + `eventKey=${event.eventKey}`;
                window.location.href = targetUrl;
            });

            // 닫기 버튼 클릭 → 토스트 제거 (이벤트 자체는 유지)
            const closeBtn = toastCard.querySelector('.toast-close-btn');
            closeBtn.addEventListener('click', () => {
                toastCard.classList.add('removing');
                setTimeout(() => toastCard.remove(), 300);
            });

            toastContainer.appendChild(toastCard);
        }
    }

    // 기존 좌우 배치 스타일 (최대 2개)
    function updateLegacyAlerts(unconfirmedEvents) {
        const alertSection = document.querySelector('.alert-section');
        if (!alertSection) return;

        // 토스트 컨테이너 숨기기
        const toastContainer = document.querySelector('.toast-alert-container');
        if (toastContainer) toastContainer.innerHTML = '';

        if (unconfirmedEvents.length === 0) {
            alertSection.classList.add('hidden');
            return;
        }

        // 최대 2개의 알림만 표시
        const alertsToShow = unconfirmedEvents.slice(0, 2);
        alertSection.innerHTML = '';

        for (const event of alertsToShow) {
            const user = wardedUsers.find(u => u.wardedUserId === event.wardedUserId);
            if (!user) continue;

            const eventDetails = {
                'LOW_HEART_RATE_DETECTED': {
                    title: '낮은 심박수 감지',
                    desc: '심박수가 40bpm 이하 입니다.<br>즉시 확인이 필요합니다.'
                },
                'HIGH_HEART_RATE_DETECTED': {
                    title: '높은 심박수 감지',
                    desc: '심박수가 120bpm 이상 입니다.<br>도움이 필요하신지 확인이 필요합니다.'
                },
                'FALL_DETECTED': {
                    title: '낙상 감지',
                    desc: '넘어짐이 스마트 워치로 확인 되었습니다.<br>도움이 필요하신지 확인이 필요합니다.'
                }
            };

            const details = eventDetails[event.eventType] || { title: '이벤트 감지', desc: '확인이 필요합니다.' };

            const alertCard = document.createElement('div');
            alertCard.className = 'alert-card';
            alertCard.dataset.eventKey = event.eventKey;
            alertCard.dataset.wardedUserId = event.wardedUserId;
            alertCard.innerHTML = `
                <img src="${user.profileUrl || 'assets/status_01.png'}" class="alert-profile">
                <span class="alert-name">${user.userName}</span>
                <img src="assets/caution_icon.png" class="alert-icon">
                <span class="alert-title">${details.title}</span>
                <span class="alert-desc">${details.desc}</span>
                <button class="alert-btn">담당자 호출</button>
            `;

            // 담당자 호출 버튼 클릭 이벤트 → record.html로 이동
            const alertBtn = alertCard.querySelector('.alert-btn');
            alertBtn.addEventListener('click', () => {
                const urlParams = new URLSearchParams(window.location.search);
                const isDemoMode = urlParams.get('demo') === 'true';
                const targetUrl = isDemoMode ? 'record.html?demo=true' : 'record.html';
                window.location.href = targetUrl;
            });

            alertSection.appendChild(alertCard);
        }

        alertSection.classList.remove('hidden');
    }

    // 전역 스코프에 노출
    window.updateAlertSection = updateAlertSection;

    // 워치 상태 렌더링 함수
    function renderWatchStatus(isWorn, batteryLevel, isCharging) {
        // 배터리 아이콘 결정
        let batteryIcon = '🔋';
        if (isCharging) {
            batteryIcon = '🔌';
        } else if (batteryLevel !== null && batteryLevel !== undefined && batteryLevel <= 20) {
            batteryIcon = '🪫';
        }

        const batteryText = (batteryLevel !== null && batteryLevel !== undefined) ? `${batteryLevel}%` : '--%';

        // 배터리 색상 결정 (충전중: 파란색, 20% 이하: 빨간색, 그 외: 기본색)
        let batteryClass = 'battery-normal';
        if (isCharging) {
            batteryClass = 'battery-charging';
        } else if (batteryLevel !== null && batteryLevel !== undefined && batteryLevel <= 20) {
            batteryClass = 'battery-low';
        }

        // 미착용
        if (isWorn === false) {
            return `<span class="watch-status-offline">⌚ 미착용</span> <span class="${batteryClass}">${batteryIcon} ${batteryText}</span>`;
        }

        // 착용중
        return `<span class="watch-status-online">⌚ 착용중</span> <span class="${batteryClass}">${batteryIcon} ${batteryText}</span>`;
    }

    // 전역 스코프에 노출
    window.renderWatchStatus = renderWatchStatus;

    // 실시간 생체 데이터 업데이트 함수 - 캐시 사용으로 최적화
    async function updateResidentVitals(events = []) {
        // 알림 섹션 업데이트
        await updateAlertSection(events);

        const rows = document.querySelectorAll('.resident-table tbody tr');

        for (let i = 0; i < wardedUsers.length && i < rows.length; i++) {
            const user = wardedUsers[i];
            const row = rows[i];

            // 확장 상세행은 무시
            if (row.classList.contains('detail-row')) continue;

            try {
                // 실제 API 모드에서는 캐시 사용, 데모 모드에서는 기존 로직 유지
                let bioData;
                if (ENABLE_MOCK_DATA) {
                    // 데모 모드 - 기존 로직 (demo-controller 오버라이드 지원)
                    bioData = await (window.fetchLatestBioData || fetchLatestBioData)(user.wardedUserId);
                } else {
                    // 실제 API 모드 - 캐시 사용
                    const cache = window.dashboardCache;
                    console.log(`📦 캐시 조회: wardedUserId=${user.wardedUserId}, 캐시 키들:`, Object.keys(cache?.bioData || {}));
                    bioData = cache?.bioData?.[user.wardedUserId] || null;

                    // 캐시에 없으면 개별 fetch (fallback)
                    if (!bioData) {
                        console.log(`⚠️ 캐시 미스: ${user.wardedUserId}, 개별 fetch 실행`);
                        bioData = await fetchLatestBioData(user.wardedUserId);
                    } else {
                        console.log(`✅ 캐시 히트: ${user.wardedUserId}`);
                    }
                }
                console.log(`Processing bio data for ${user.userName}:`, bioData);
                
                if (bioData) {
                    // 캐시 업데이트
                    bioDataCache[user.wardedUserId] = bioData;

                    // 생체 데이터 업데이트 - 실제 API 응답 구조에 맞게 수정
                    let heartRate = '--';
                    let spo2 = '--';
                    let steps = '--';
                    let temperature = '--';
                    let bloodPressure = '--/--';
                    let sleepQuality = '--';
                    let heartRateTime = null;
                    let spo2Time = null;
                    let stepsDate = null;
                    let location = '--';
                    let locationTime = null;
                    let statusTime = null;
                    
                    // 위치 데이터 - location 배열의 첫 번째 값 (가장 최근)
                    let latestGpsData = null;
                    let locationInfo = null;
                    
                    // 데모 모드에서 실내 위치 사용
                    if (bioData.indoorLocation) {
                        location = bioData.indoorLocation;
                        console.log(`데모 모드 실내 위치: ${location}`);
                    } else if (bioData.location && bioData.location.length > 0) {
                        latestGpsData = bioData.location;
                        console.log(`위치 데이터 ${bioData.location.length}개 수신:`, bioData.location);
                        const lat = bioData.location[0].latitude;
                        const lng = bioData.location[0].longitude;
                        locationTime = bioData.location[0].registrationDateTime;
                        // 실제로는 역지오코딩 API가 필요하지만, 데모용으로 간단히 처리
                        locationInfo = await getLocationName(lat, lng);
                        location = locationInfo.simple;
                    }
                    
                    // 심박수 - heartBeat 배열의 첫 번째 값 (가장 최근)
                    if (bioData.heartBeat && bioData.heartBeat.length > 0) {
                        console.log('heartBeat array:', bioData.heartBeat[0]);
                        heartRate = bioData.heartBeat[0].heartBeat;
                        heartRateTime = bioData.heartBeat[0].registrationDateTime;
                    }
                    
                    // 산소포화도 - oxygenStatus 배열의 첫 번째 값
                    if (bioData.oxygenStatus && bioData.oxygenStatus.length > 0) {
                        console.log('oxygenStatus array:', bioData.oxygenStatus[0]);
                        spo2 = bioData.oxygenStatus[0].oxygenSaturation;
                        spo2Time = bioData.oxygenStatus[0].registrationDateTime;
                    } else if (ENABLE_MOCK_DATA) {
                        // 목업 데이터일 때만 기본값 사용
                        spo2 = 95 + Math.floor(Math.random() * 5);
                        console.log('No oxygenStatus data, using default:', spo2);
                    }
                    
                    // 걸음수 - steps 배열의 첫 번째 값 (가장 최근 날짜)
                    if (bioData.steps && bioData.steps.length > 0) {
                        console.log('steps array:', bioData.steps[0]);
                        steps = bioData.steps[0].stepsDaily;
                        stepsDate = bioData.steps[0].step_date;
                    }
                    
                    // 피부온(대기온) 표시
                    if (bioData.bodyTemperature && bioData.bodyTemperature.length > 0) {
                        // 정상 범위의 피부온 데이터 찾기 (30도 이상)
                        let validTempData = null;
                        for (const tempData of bioData.bodyTemperature) {
                            if (tempData.bodyTemperature && tempData.bodyTemperature >= 30) {
                                validTempData = tempData;
                                break;
                            }
                        }
                        
                        if (!validTempData && bioData.bodyTemperature.length > 0) {
                            // 유효한 데이터가 없으면 첫 번째 데이터 사용
                            validTempData = bioData.bodyTemperature[0];
                        }
                        
                        if (validTempData) {
                            // bodyTemperature와 ambientTemperature가 있는 경우 (실제 API 필드명)
                            if (validTempData.bodyTemperature !== undefined && validTempData.ambientTemperature !== undefined) {
                                const bodyTemp = parseFloat(validTempData.bodyTemperature).toFixed(1);
                                const ambientTemp = parseFloat(validTempData.ambientTemperature).toFixed(1);
                                temperature = `${bodyTemp}/${ambientTemp}`;
                                console.log(`Using temperature data: ${temperature} from ${validTempData.registrationDateTime}`);
                            } else if (validTempData.skinTemperature !== undefined && validTempData.ambientTemperature !== undefined) {
                                // skinTemperature와 ambientTemperature가 있는 경우
                                temperature = `${validTempData.skinTemperature}/${validTempData.ambientTemperature}`;
                            } else if (validTempData.temperature !== undefined) {
                                // temperature 필드만 있는 경우
                                temperature = validTempData.temperature;
                            }
                        }
                    } else if (ENABLE_MOCK_DATA || window.demoController) {
                        const skinTemp = (32.0 + Math.random() * 2.0).toFixed(1);
                        const ambientTemp = (22.0 + Math.random() * 3.0).toFixed(1);
                        temperature = `${skinTemp}/${ambientTemp}`;
                    }
                    
                    // 혈압 - bloodPressure 배열의 첫 번째 값
                    if (bioData.bloodPressure && bioData.bloodPressure.length > 0) {
                        const bp = bioData.bloodPressure[0];
                        bloodPressure = `${bp.systolic}/${bp.diastolic}`;
                    } else if (ENABLE_MOCK_DATA || window.demoController) {
                        bloodPressure = `${110 + Math.floor(Math.random() * 30)}/${70 + Math.floor(Math.random() * 20)}`;
                    }
                    
                    // 수면질 - sleep 객체 처리
                    if (bioData.sleep) {
                        if (bioData.sleep.score !== undefined) {
                            const score = bioData.sleep.score;
                            if (score >= 70) {
                                sleepQuality = `양호(${score}점)`;
                            } else if (score >= 40) {
                                sleepQuality = `주의(${score}점)`;
                            } else {
                                sleepQuality = `불량(${score}점)`;
                            }
                        }
                    } else if (ENABLE_MOCK_DATA || window.demoController) {
                        const score = 40 + Math.floor(Math.random() * 60);
                        if (score >= 70) {
                            sleepQuality = `양호(${score}점)`;
                        } else if (score >= 40) {
                            sleepQuality = `주의(${score}점)`;
                        } else {
                            sleepQuality = `불량(${score}점)`;
                        }
                    }
                    
                    console.log(`Extracted values - HR: ${heartRate}, SpO2: ${spo2}, Steps: ${steps}, Temp: ${temperature}, BP: ${bloodPressure}, Sleep: ${sleepQuality}`);
                    
                    // 수면 시간은 현재 API에 없으므로 목업 데이터일 때만 표시
                    let sleepHours = '--';
                    if (ENABLE_MOCK_DATA) {
                        sleepHours = (6 + Math.random() * 3).toFixed(1) + 'h'; // 6~9시간 사이의 랜덤 값
                    }

                    // 상태 업데이트 및 시간 가져오기
                    const statusData = { ...bioData, wardedUserId: user.wardedUserId };
                    const status = determineStatus(statusData, events);
                    
                    // 상태 툴팁용 최신 시간 결정
                    if (bioData.userActionStatus && bioData.userActionStatus.length > 0) {
                        const userActionTime = new Date(bioData.userActionStatus[0].registrationDateTime);
                        if (!statusTime || userActionTime > new Date(statusTime)) {
                            statusTime = bioData.userActionStatus[0].registrationDateTime;
                        }
                    }
                    if (bioData.phoneUserStatus && bioData.phoneUserStatus.length > 0) {
                        const phoneTime = new Date(bioData.phoneUserStatus[0].registrationDateTime);
                        if (!statusTime || phoneTime > new Date(statusTime)) {
                            statusTime = bioData.phoneUserStatus[0].registrationDateTime;
                        }
                    }

                    // 테이블 셀 업데이트 - dashboard-v2.html 새 컬럼 구조
                    // 순서: 이름(0) - 나이(1) - 상태(2) - 위치(3) - 외출(4) - 심박수(5) - 걸음수(6) - 워치상태(7)
                    const statusCell = row.children[2];
                    const locationCell = row.children[3];
                    const outingReportCell = row.children[4];
                    const heartRateCell = row.children[5];
                    const stepsCell = row.children[6];
                    const watchStatusCell = row.children[7];
                    
                    // 상태 업데이트
                    const statusLabel = statusCell.querySelector('.status-label');
                    statusLabel.className = `status-label ${status.class}`;
                    statusLabel.textContent = status.text;
                    
                    // 위치 및 기타 데이터 업데이트
                    if (location !== '위치 정보 없음' && location !== '--' && latestGpsData && latestGpsData.length > 0) {
                        const gps = latestGpsData[0];
                        const accuracy = gps.accuracy || null;
                        locationCell.innerHTML = formatLocationWithDistance(gps.latitude, gps.longitude, location, accuracy);
                        locationCell.classList.add('location-cell');

                        // 위치 클릭 이벤트 리스너 추가
                        locationCell.onclick = () => {
                            const userName = row.children[0].textContent.trim();
                            const latestGps = latestGpsData[0];
                            const latestTime = new Date(latestGps.registrationDateTime);
                            const timeStr = `${latestTime.getHours().toString().padStart(2, '0')}:${latestTime.getMinutes().toString().padStart(2, '0')}`;
                            showLocationMapWithTime(latestGps.latitude, latestGps.longitude, locationInfo, userName, timeStr);
                        };
                    } else {
                        locationCell.textContent = location;
                    }

                    // 외출 리포트 분석 및 업데이트
                    // 캐시된 bioData에 이미 location이 있으므로 우선 사용, 없으면 API 호출
                    // 전체 데이터를 넘기고 analyzeOutingReport에서 오늘 날짜만 필터링 (어제부터 이어진 외출 처리 위해)
                    let locationDataForAnalysis = [];
                    if (bioData && bioData.location && bioData.location.length > 0) {
                        // 캐시된 전체 데이터 사용 (날짜 필터링은 analyzeOutingReport에서 처리)
                        locationDataForAnalysis = bioData.location;
                        console.log(`🚶 [외출] ${user.userName}: 캐시 사용, 전체 위치데이터 ${locationDataForAnalysis.length}개`);
                    } else {
                        // 캐시에 없으면 API 호출 (fallback)
                        const locationApiId = user.deviceId || user.wardedUserId;
                        locationDataForAnalysis = await (window.fetchTodayLocationData || fetchTodayLocationData)(locationApiId);
                        console.log(`🚶 [외출] ${user.userName}: API 호출, 위치데이터 ${locationDataForAnalysis?.length || 0}개`);
                    }
                    const outingReport = analyzeOutingReport(locationDataForAnalysis);
                    console.log(`🚶 [외출] ${user.userName}: hasOuting=${outingReport.hasOuting}, outings=${outingReport.outings?.length || 0}`);

                    if (outingReport.hasOuting) {
                        outingReportCell.innerHTML = `<span class="outing-report-cell outing-status-yes" style="text-decoration: underline; cursor: pointer; color: #3B82F6;">🚶 외출</span>`;
                    } else {
                        outingReportCell.innerHTML = '--';
                    }
                    outingReportCell.classList.add('outing-report-cell');

                    // 외출 리포트 클릭 이벤트
                    outingReportCell.onclick = async () => {
                        const userName = row.children[0].textContent.trim();
                        console.log(`🎯 외출 리포트 클릭: ${userName} (${user.wardedUserId})`);
                        const residentInfo = { age: user.age, room: user.room };
                        showOutingReport(userName, user.wardedUserId, locationDataForAnalysis, outingReport, residentInfo);
                    };
                    
                    // 새 컬럼 데이터 업데이트 (dashboard-v2.html 구조)
                    heartRateCell.textContent = heartRate !== '--' ? `${heartRate}bpm` : '--bpm';
                    stepsCell.textContent = (steps !== '--' && steps !== null && steps !== undefined) ? steps.toLocaleString() : '--';

                    // 워치 상태 업데이트
                    watchStatusCell.innerHTML = renderWatchStatus(user.isWorn, user.batteryLevel, user.isCharging);
                    
                    // 툴팁용 데이터 속성 추가
                    if (statusTime) {
                        statusLabel.setAttribute('data-time', statusTime);
                        statusLabel.classList.add('has-tooltip');
                    }
                    if (locationTime) {
                        locationCell.setAttribute('data-time', locationTime);
                        locationCell.classList.add('has-tooltip');
                    }
                    if (heartRateTime) {
                        heartRateCell.setAttribute('data-time', heartRateTime);
                        heartRateCell.classList.add('has-tooltip');
                    }
                    // if (spo2Time) {  // 주석처리
                    //     spo2Cell.setAttribute('data-time', spo2Time);
                    //     spo2Cell.classList.add('has-tooltip');
                    // }
                    if (stepsDate) {
                        // 걸음수는 날짜 툴팁 사용
                        stepsCell.setAttribute('data-date', stepsDate);
                        stepsCell.classList.add('has-date-tooltip');
                    }
                }
            } catch (error) {
                console.error(`Error updating vitals for ${user.wardedUserId}:`, error);
            }
        }
    }

    // ----- Floor 1 occupancy cycling -----
    const floor1OccupancyCases = [
        { '102': 3, '104': 2, '101': 3, '103': 3, '105': 1, '106': 1 }, // Case 1
        { '102': 2, '화장실': 1, '105': 0, '106': 1 },               // Case 2
        { '101': 4, '103': 2, '응접실': 1, '104': 2 }                    // Case 3
    ];
    let currentOccupancyCase = 0;

    function updateFloor1Occupancy() {
        const floorPlan = document.getElementById('floor-1-plan');
        if (!floorPlan) return;
        const occupancyMap = floor1OccupancyCases[currentOccupancyCase];

        floorPlan.querySelectorAll('.room').forEach(room => {
            const nameEl = room.querySelector('.room-name');
            const occEl = room.querySelector('.occupancy');
            if (!nameEl || !occEl) return;

            const roomName = nameEl.textContent.trim();
            if (Object.prototype.hasOwnProperty.call(occupancyMap, roomName)) {
                const count = occupancyMap[roomName];
                if (count === 0) {
                    occEl.textContent = '';
                    occEl.style.display = 'none';
                } else {
                    occEl.textContent = count;
                    occEl.style.display = 'flex';
                }
            }
        });

        currentOccupancyCase = (currentOccupancyCase + 1) % floor1OccupancyCases.length;
    }
    
    // renderResidentTable은 DOMContentLoaded 내부에서만 정의되므로 여기서 노출
    window.renderResidentTable = renderResidentTable;

    // === 통합 초기화 (캐시 기반 최적화) ===
    // 실제 API 모드에서는 먼저 캐시를 로드하고, 테이블과 AI 리포트가 캐시를 공유
    (async () => {
        let events = [];
        if (!ENABLE_MOCK_DATA) {
            console.log('🚀 [초기화] 캐시 사전 로드 시작');
            const cacheStart = performance.now();
            const cache = await loadDashboardData();
            console.log(`🚀 [초기화] 캐시 사전 로드 완료: ${(performance.now() - cacheStart).toFixed(0)}ms`);

            // 초기 이벤트 로드 (토스트 알림용)
            // 이벤트의 wardedUserId는 deviceId(카카오ID) 형태이므로 devices에서 매칭
            const connectedDeviceIds = (cache.devices || [])
                .filter(d => d.connectedResident)
                .map(d => d.deviceId);
            events = (cache.events || []).filter(e => connectedDeviceIds.includes(e.wardedUserId));
            console.log('📋 초기 이벤트 필터링: connectedDeviceIds=', connectedDeviceIds, ', 필터된 이벤트 수=', events.length);
        } else {
            // 데모 모드
            events = await (window.fetchEvents || fetchEvents)();
        }

        // 테이블 렌더링 (캐시 사용)
        renderResidentTable();

        // 초기 토스트 알림 표시
        await updateResidentVitals(events);
    })();

    // 주기적으로 데이터 업데이트 (캐시 갱신 포함)
    setInterval(async () => {
        try {
            let events;

            if (ENABLE_MOCK_DATA) {
                // 데모 모드 - 기존 로직
                events = await (window.fetchEvents || fetchEvents)();
            } else {
                // 실제 API 모드 - 캐시 강제 갱신 후 사용
                const cache = await loadDashboardData(true); // forceRefresh=true
                // 이벤트의 wardedUserId는 deviceId(카카오ID) 형태이므로 devices에서 매칭
                const connectedDeviceIds = (cache.devices || [])
                    .filter(d => d.connectedResident)
                    .map(d => d.deviceId);
                events = (cache.events || []).filter(e => connectedDeviceIds.includes(e.wardedUserId));
            }

            // 생체 데이터 업데이트
            await updateResidentVitals(events);

            // record.html에서는 자동 리프레시 비활성화 (사용자 요청)
            // 사용자가 직접 새로고침하거나 상태 변경 시에만 데이터 갱신

            // 마지막 새로고침 시간 업데이트
            lastRefreshTime = new Date();

            // 층별 거주 인원 업데이트 (데모용 유지)
            updateFloor1Occupancy();
        } catch (error) {
            console.error('Error in periodic update:', error);
        }
    }, UPDATE_INTERVAL); // 설정된 주기로 업데이트

    // 중복 함수 제거됨 - 상단의 async getLocationName 함수 사용

    // 상태 히스토리 모달 기능 추가
    function setupStatusHistoryModal() {
        const modal = document.getElementById('status-history-modal');
        const modalClose = document.getElementById('status-history-modal-close');
        const modalName = document.getElementById('status-history-name');
        const modalPeriod = document.getElementById('status-history-period');
        const eventsSection = document.getElementById('status-history-events');
        const eventsList = document.getElementById('status-events-list');
        const timeline = document.getElementById('status-timeline');
        
        if (!modal || !modalClose) return;
        
        // 모달 닫기
        modalClose.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        
        // 모달 바깥 클릭시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
    
    // 상태 히스토리 데이터 가져오기
    async function fetchStatusHistory(wardedUserId, userName, deviceId) {
        try {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // 어제부터 내일까지로 범위 설정 (오늘 데이터 확실히 포함)
            const fromDate = yesterday.toISOString().split('T')[0];
            const toDate = tomorrow.toISOString().split('T')[0];

            console.log(`Fetching status history from ${fromDate} to ${toDate} for ${userName} (deviceId: ${deviceId})`);

            const API_BASE_URL = window.API_CONFIG?.BASE_URL || '';

            // 24시간 이벤트 데이터 가져오기
            const eventUrl = `${API_BASE_URL}/watcher/event?watcherUserId=${window.API_CONFIG?.WATCHER_USER_ID || '3743690826'}&fromDate=${fromDate}&toDate=${toDate}`;
            console.log('Event API URL:', eventUrl);
            const eventResponse = await fetch(eventUrl);
            const eventData = await eventResponse.json();
            const userEvents = eventData.response?.filter(e => e.wardedUserId === wardedUserId) || [];
            console.log(`Found ${userEvents.length} events for user`);

            // 24시간 상태 데이터 가져오기 (deviceId 사용)
            const statusUrl = `${API_BASE_URL}/watcher/period?wardedUserId=${deviceId}&bioDataTypes=USER_ACTION_STATUS,PHONE_USER_STATUS&fromDate=${fromDate}&toDate=${toDate}`;
            console.log('Status API URL:', statusUrl);
            const statusResponse = await fetch(statusUrl);
            const statusData = await statusResponse.json();
            console.log('Status data:', statusData.response);
            
            // 24시간 이내 데이터만 필터링
            const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const filteredEvents = userEvents.filter(e => 
                new Date(e.registrationDateTime) >= cutoffTime
            );
            
            const filteredUserActionStatus = (statusData.response?.userActionStatus || []).filter(s =>
                new Date(s.registrationDateTime) >= cutoffTime
            );
            
            const filteredPhoneUserStatus = (statusData.response?.phoneUserStatus || []).filter(s =>
                new Date(s.registrationDateTime) >= cutoffTime
            );
            
            console.log(`Filtered to last 24 hours: ${filteredEvents.length} events, ${filteredUserActionStatus.length} userAction, ${filteredPhoneUserStatus.length} phoneStatus`);
            
            return {
                events: filteredEvents,
                userActionStatus: filteredUserActionStatus,
                phoneUserStatus: filteredPhoneUserStatus
            };
        } catch (error) {
            console.error('Error fetching status history:', error);
            return { events: [], userActionStatus: [], phoneUserStatus: [] };
        }
    }
    
    // 상태 히스토리 표시
    async function showStatusHistory(wardedUserId, userName, deviceId) {
        const modal = document.getElementById('status-history-modal');
        const modalName = document.getElementById('status-history-name');
        const modalPeriod = document.getElementById('status-history-period');
        const eventsSection = document.getElementById('status-history-events');
        const eventsList = document.getElementById('status-events-list');
        const timeline = document.getElementById('status-timeline');

        if (!modal) return;

        // 모달 헤더 업데이트
        modalName.textContent = userName || '피보호자';
        modalPeriod.textContent = '지난 24시간';

        // 데이터 가져오기 (deviceId 전달)
        const historyData = await fetchStatusHistory(wardedUserId, userName, deviceId);
        
        // 이벤트 섹션 표시 (최신순으로 정렬)
        if (historyData.events && historyData.events.length > 0) {
            eventsSection.classList.remove('hidden');
            // 최신순으로 정렬
            const sortedEvents = historyData.events.sort((a, b) => 
                new Date(b.registrationDateTime) - new Date(a.registrationDateTime)
            );
            
            eventsList.innerHTML = sortedEvents.map(event => {
                const eventDate = new Date(event.registrationDateTime);
                const dateStr = eventDate.toLocaleDateString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit'
                });
                const timeStr = eventDate.toLocaleTimeString('ko-KR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                const eventTypeMap = {
                    'FALL_DETECTED': '낙상 감지',
                    'HIGH_HEART_RATE_DETECTED': '빈맥 감지',
                    'LOW_HEART_RATE_DETECTED': '서맥 감지'
                };
                return `
                    <div class="status-event-item">
                        <span class="event-time">${dateStr} ${timeStr}</span>
                        <span class="event-type">${eventTypeMap[event.eventType] || event.eventType}</span>
                    </div>
                `;
            }).join('');
        } else {
            eventsSection.classList.add('hidden');
        }
        
        // 상태 타임라인 표시
        const statusItems = [];
        
        // userActionStatus 데이터 추가
        historyData.userActionStatus.forEach(status => {
            statusItems.push({
                time: new Date(status.registrationDateTime),
                source: 'watch',
                status: status.userActionStatus,
                detail: 'Galaxy Watch'
            });
        });
        
        // phoneUserStatus 데이터 추가
        historyData.phoneUserStatus.forEach(status => {
            statusItems.push({
                time: new Date(status.registrationDateTime),
                source: 'phone',
                status: status.type,
                detail: 'Phone'
            });
        });
        
        // 시간순으로 정렬 (최신순)
        statusItems.sort((a, b) => b.time - a.time);
        
        // 타임라인 렌더링 (날짜 포함, 최신순)
        let currentDate = '';
        timeline.innerHTML = statusItems.slice(0, 50).map((item, index) => {
            // 날짜와 시간 분리
            const itemDate = item.time.toLocaleDateString('ko-KR', {
                month: '2-digit',
                day: '2-digit',
                weekday: 'short'
            });
            const timeStr = item.time.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const statusTextMap = {
                // Watch 상태 (USER_ACTIVITY_)
                'USER_ACTIVITY_PASSIVE': '일상생활',
                'USER_ACTIVITY_WORKING': '활동',
                'USER_ACTIVITY_EXERCISING': '운동',
                'USER_ACTIVITY_EXERCISE': '운동',
                'USER_ACTIVITY_SLEEPING': '수면',
                'USER_ACTIVITY_ASLEEP': '수면',
                'USER_ACTIVITY_UNKNOWN': '확인중',
                // Phone 상태 (ActivityType.)
                'ActivityType.STILL': '일상생활',
                'ActivityType.WALKING': '걷기',
                'ActivityType.RUNNING': '달리기',
                'ActivityType.ON_BICYCLE': '자전거',
                'ActivityType.IN_VEHICLE': '차량이동',
                'ActivityType.UNKNOWN': '확인중'
            };
            
            const sourceIcon = item.source === 'phone' ? '📱' : '⌚';
            const statusText = statusTextMap[item.status] || item.status;
            
            // 날짜가 바뀌면 날짜 구분선 추가
            let dateHeader = '';
            if (itemDate !== currentDate) {
                currentDate = itemDate;
                dateHeader = `<div style="font-weight: 600; color: #6b7280; padding: 10px 0 5px 0; margin-top: ${index === 0 ? '0' : '15px'}; border-top: ${index === 0 ? 'none' : '1px solid #e5e7eb'};">${itemDate}</div>`;
            }
            
            return `
                ${dateHeader}
                <div class="timeline-item">
                    <div class="timeline-dot ${item.source}"></div>
                    <span class="timeline-time">${timeStr}</span>
                    <div class="timeline-source">
                        <div class="source-icon ${item.source}">${sourceIcon}</div>
                    </div>
                    <span class="timeline-status">${statusText}</span>
                    <span class="timeline-detail">${item.detail}</span>
                </div>
            `;
        }).join('') || '<div style="text-align: center; color: #9ca3af;">최근 24시간 동안 기록된 상태가 없습니다.</div>';
        
        // 모달 표시
        modal.classList.remove('hidden');
    }
    
    // 심박수 히스토리 모달 표시
    async function showHeartRateHistory(wardedUserId, userName, deviceId) {
        const modal = document.getElementById('heartRateModal');
        if (!modal) return;

        const modalTitle = document.getElementById('heartRateModalTitle');
        if (modalTitle) {
            modalTitle.textContent = `${userName} - 심박수 히스토리`;
        }

        modal.style.display = 'flex';

        // 24시간 전부터 현재까지의 데이터 가져오기
        const now = new Date();
        const dayBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const fromDate = dayBefore.toISOString().split('T')[0];
        const toDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        try {
            // deviceId 사용 (API는 워치 ID를 wardedUserId 파라미터로 받음)
            const url = `${API_BASE_URL}/watcher/period?wardedUserId=${deviceId}&bioDataTypes=HEART_BEAT&fromDate=${fromDate}&toDate=${toDate}`;
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.code === "1000" && data.response && data.response.heartBeat) {
                // 24시간 이내 데이터만 필터링
                const filteredData = data.response.heartBeat.filter(item => {
                    const itemTime = new Date(item.registrationDateTime);
                    return itemTime >= dayBefore && itemTime <= now;
                });
                
                renderHeartRateChart(filteredData);
                updateHeartRateStats(filteredData);

                // 심박수 인사이트 생성
                generateHeartRateInsights(filteredData);
            }
        } catch (error) {
            console.error('Error fetching heart rate history:', error);
        }
    }
    
    // 심박수 차트 렌더링
    function renderHeartRateChart(heartRateData) {
        const canvas = document.getElementById('heartRateChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        if (!heartRateData || heartRateData.length === 0) {
            ctx.font = '16px Pretendard';
            ctx.fillStyle = '#9CA3AF';
            ctx.textAlign = 'center';
            ctx.fillText('데이터가 없습니다', width / 2, height / 2);
            return;
        }
        
        // 시간순으로 정렬
        heartRateData.sort((a, b) => new Date(a.registrationDateTime) - new Date(b.registrationDateTime));
        
        // 그래프 설정
        const padding = { top: 40, right: 60, bottom: 60, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // 최대/최소값 찾기
        const values = heartRateData.map(d => d.heartBeat);
        const minValue = Math.min(...values) - 10;
        const maxValue = Math.max(...values) + 10;
        
        // 시간 범위
        const startTime = new Date(heartRateData[0].registrationDateTime);
        const endTime = new Date(heartRateData[heartRateData.length - 1].registrationDateTime);
        const timeRange = endTime - startTime;
        
        // 그리드 그리기
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 0.5;
        
        // Y축 그리드 (심박수)
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            
            // Y축 레이블
            const value = Math.round(maxValue - ((maxValue - minValue) / 5) * i);
            ctx.fillStyle = '#6B7280';
            ctx.font = '12px Pretendard';
            ctx.textAlign = 'right';
            ctx.fillText(value + ' bpm', padding.left - 10, y + 4);
        }
        
        // X축 그리드 (시간)
        const hourInterval = Math.ceil(timeRange / (1000 * 60 * 60 * 6)); // 6개 구간
        for (let i = 0; i <= 6; i++) {
            const x = padding.left + (chartWidth / 6) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();
            
            // X축 레이블
            const time = new Date(startTime.getTime() + (timeRange / 6) * i);
            ctx.fillStyle = '#6B7280';
            ctx.font = '12px Pretendard';
            ctx.textAlign = 'center';
            ctx.fillText(time.getHours() + ':' + String(time.getMinutes()).padStart(2, '0'), x, height - padding.bottom + 20);
        }
        
        // 서맥 위험 범위 배경 (40bpm 미만)
        const bradycardiaThreshold = 40;
        if (minValue < bradycardiaThreshold) {
            const bradycardiaY = padding.top + chartHeight * (1 - (bradycardiaThreshold - minValue) / (maxValue - minValue));
            ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
            ctx.fillRect(padding.left, bradycardiaY, chartWidth, height - padding.bottom - bradycardiaY);

            // 서맥 기준선
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(padding.left, bradycardiaY);
            ctx.lineTo(width - padding.right, bradycardiaY);
            ctx.stroke();
            ctx.setLineDash([]);

            // 서맥 레이블
            ctx.fillStyle = '#EF4444';
            ctx.font = '11px Pretendard';
            ctx.textAlign = 'left';
            ctx.fillText('서맥 기준 (40bpm)', padding.left + 5, bradycardiaY - 5);
        }

        // 데이터 라인 그리기
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.beginPath();

        heartRateData.forEach((data, index) => {
            const x = padding.left + (chartWidth * ((new Date(data.registrationDateTime) - startTime) / timeRange));
            const y = padding.top + chartHeight * (1 - (data.heartBeat - minValue) / (maxValue - minValue));

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            // 데이터 포인트 - 서맥(40bpm 미만)만 빨간색, 나머지는 파란색
            ctx.fillStyle = data.heartBeat < 40 ? '#EF4444' : '#3B82F6';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.stroke();
        
        // 제목
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 14px Pretendard';
        ctx.textAlign = 'left';
        ctx.fillText('심박수 (bpm)', padding.left, 25);
    }
    
    // 심박수 통계 업데이트
    function updateHeartRateStats(heartRateData) {
        if (!heartRateData || heartRateData.length === 0) {
            document.getElementById('hrAvg').textContent = '--';
            document.getElementById('hrMax').textContent = '--';
            document.getElementById('hrMin').textContent = '--';
            return;
        }
        
        const values = heartRateData.map(d => d.heartBeat);
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        document.getElementById('hrAvg').textContent = avg + ' bpm';
        document.getElementById('hrMax').textContent = max + ' bpm';
        document.getElementById('hrMin').textContent = min + ' bpm';
    }
    
    // 심박수 인사이트 생성
    function generateHeartRateInsights(heartRateData) {
        const insightsContainer = document.getElementById('heartRateInsights');
        if (!insightsContainer) return;

        if (!heartRateData || heartRateData.length === 0) {
            insightsContainer.innerHTML = `
                <div class="insight-item">
                    <span class="insight-icon">📊</span>
                    <div class="insight-content">
                        <div class="insight-title">데이터 없음</div>
                        <div class="insight-text">심박수 데이터가 없습니다.</div>
                    </div>
                </div>`;
            return;
        }

        const values = heartRateData.map(d => d.heartBeat);
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min;

        // 서맥만 체크 (40bpm 미만), 빈맥은 운동 상태일 수 있으므로 제외
        const bradycardiaCount = values.filter(v => v < 40).length;
        const totalCount = values.length;

        const insights = [];

        // 1. 전반적인 심박수 상태
        if (avg >= 50 && avg <= 100) {
            insights.push({
                icon: '💚',
                title: '정상 심박수',
                text: `평균 심박수 ${avg}bpm으로 정상 범위입니다.`,
                type: 'positive'
            });
        } else if (avg < 50) {
            insights.push({
                icon: '💛',
                title: '낮은 심박수',
                text: `평균 심박수 ${avg}bpm으로 다소 낮습니다. 컨디션을 확인해 주세요.`,
                type: 'warning'
            });
        } else {
            insights.push({
                icon: '💚',
                title: '심박수 상태',
                text: `평균 심박수 ${avg}bpm입니다.`,
                type: 'positive'
            });
        }

        // 2. 심박수 변동성
        if (range > 50) {
            insights.push({
                icon: '📈',
                title: '심박수 변동',
                text: `변동폭이 ${range}bpm(${min}~${max})입니다. 활동량 변화가 있었습니다.`,
                type: ''
            });
        } else if (range < 20) {
            insights.push({
                icon: '📊',
                title: '안정적인 심박수',
                text: `변동폭이 ${range}bpm으로 안정적입니다.`,
                type: 'positive'
            });
        } else {
            insights.push({
                icon: '📊',
                title: '심박수 변동',
                text: `변동폭이 ${range}bpm(${min}~${max})으로 정상 범위입니다.`,
                type: 'positive'
            });
        }

        // 3. 서맥 감지 (40bpm 미만만 체크)
        if (bradycardiaCount > 0) {
            const bradycardiaPercent = Math.round((bradycardiaCount / totalCount) * 100);
            if (bradycardiaPercent > 20) {
                insights.push({
                    icon: '⚠️',
                    title: '서맥 주의',
                    text: `서맥(40bpm 미만)이 ${bradycardiaCount}회(${bradycardiaPercent}%) 감지되었습니다. 확인이 필요합니다.`,
                    type: 'alert'
                });
            } else {
                insights.push({
                    icon: '💛',
                    title: '서맥 감지',
                    text: `서맥(40bpm 미만)이 ${bradycardiaCount}회 감지되었습니다.`,
                    type: 'warning'
                });
            }
        } else {
            insights.push({
                icon: '✅',
                title: '서맥 없음',
                text: '서맥(40bpm 미만)이 감지되지 않았습니다.',
                type: 'positive'
            });
        }

        // 4. 측정 횟수 (요양원 주간 이용 환경 고려)
        if (totalCount >= 50) {
            insights.push({
                icon: '⌚',
                title: '측정 양호',
                text: `오늘 ${totalCount}회 심박수가 측정되었습니다.`,
                type: 'positive'
            });
        } else if (totalCount >= 20) {
            insights.push({
                icon: '⌚',
                title: '측정 현황',
                text: `오늘 ${totalCount}회 심박수가 측정되었습니다.`,
                type: ''
            });
        } else if (totalCount > 0) {
            insights.push({
                icon: '⌚',
                title: '측정 부족',
                text: `오늘 ${totalCount}회 측정되었습니다. 워치 착용을 확인해 주세요.`,
                type: 'warning'
            });
        }

        // HTML 생성 (걸음수 모달과 동일한 형식)
        insightsContainer.innerHTML = insights.map(insight => `
            <div class="insight-item ${insight.type}">
                <span class="insight-icon">${insight.icon}</span>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-text">${insight.text}</div>
                </div>
            </div>
        `).join('');
    }
    
    // 심박수 모달 닫기
    window.closeHeartRateModal = function() {
        const modal = document.getElementById('heartRateModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ========== 걸음수 히스토리 관련 함수들 ==========

    // 걸음수 히스토리 모달 표시
    async function showStepsHistory(wardedUserId, userName, deviceId) {
        const modal = document.getElementById('stepsModal');
        if (!modal) return;

        const modalTitle = document.getElementById('stepsModalTitle');
        if (modalTitle) {
            modalTitle.textContent = `${userName} - 걸음수 히스토리`;
        }

        modal.style.display = 'flex';

        // 7일 전부터 현재까지의 데이터 가져오기
        const now = new Date();
        const weekBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const fromDate = weekBefore.toISOString().split('T')[0];
        const toDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        try {
            // deviceId 사용 (API는 워치 ID를 wardedUserId 파라미터로 받음)
            const url = `${API_BASE_URL}/watcher/period?wardedUserId=${deviceId}&bioDataTypes=STEPS&fromDate=${fromDate}&toDate=${toDate}`;
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.code === "1000" && data.response && data.response.steps) {
                const stepsData = data.response.steps;
                renderStepsChart(stepsData);
                updateStepsStats(stepsData);
                generateStepsInsights(stepsData, userName);
            } else {
                // 데이터 없을 때 빈 상태 표시
                renderStepsChart([]);
                updateStepsStats([]);
                generateStepsInsights([], userName);
            }
        } catch (error) {
            console.error('Error fetching steps history:', error);
            renderStepsChart([]);
            updateStepsStats([]);
            generateStepsInsights([], userName);
        }
    }

    // 걸음수 차트 렌더링 (7일간 일별 막대 그래프)
    function renderStepsChart(stepsData) {
        const canvas = document.getElementById('stepsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // 7일 날짜 배열 생성
        const days = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            days.push({
                date: date,
                dateStr: date.toISOString().split('T')[0],
                label: `${date.getMonth() + 1}/${date.getDate()}`,
                dayName: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
                steps: 0
            });
        }

        // 데이터를 날짜별로 그룹화 (일일 최대값 사용)
        if (stepsData && stepsData.length > 0) {
            stepsData.forEach(item => {
                const itemDate = new Date(item.registrationDateTime).toISOString().split('T')[0];
                const dayData = days.find(d => d.dateStr === itemDate);
                if (dayData) {
                    // stepsDaily 값 사용 (일일 누적)
                    const dailySteps = item.stepsDaily || item.steps || 0;
                    if (dailySteps > dayData.steps) {
                        dayData.steps = dailySteps;
                    }
                }
            });
        }

        // 그래프 설정
        const padding = { top: 40, right: 40, bottom: 60, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 최대값 찾기 (최소 3000)
        const maxSteps = Math.max(3000, ...days.map(d => d.steps)) * 1.1;

        // 막대 너비
        const barWidth = (chartWidth / 7) * 0.6;
        const barGap = (chartWidth / 7) * 0.4;

        // 배경 그리드
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y축 레이블
            const value = Math.round(maxSteps - (maxSteps / 5) * i);
            ctx.fillStyle = '#6B7280';
            ctx.font = '11px Pretendard';
            ctx.textAlign = 'right';
            ctx.fillText(value.toLocaleString(), padding.left - 10, y + 4);
        }

        // 막대 그리기
        days.forEach((day, index) => {
            const x = padding.left + (chartWidth / 7) * index + barGap / 2;
            const barHeight = (day.steps / maxSteps) * chartHeight;
            const y = padding.top + chartHeight - barHeight;

            // 막대 색상 (오늘은 강조)
            const isToday = index === 6;
            const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartHeight);
            if (isToday) {
                gradient.addColorStop(0, '#3B82F6');
                gradient.addColorStop(1, '#60A5FA');
            } else {
                gradient.addColorStop(0, '#93C5FD');
                gradient.addColorStop(1, '#BFDBFE');
            }

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
            ctx.fill();

            // 값 표시 (막대 위)
            if (day.steps > 0) {
                ctx.fillStyle = '#374151';
                ctx.font = isToday ? 'bold 12px Pretendard' : '11px Pretendard';
                ctx.textAlign = 'center';
                ctx.fillText(day.steps.toLocaleString(), x + barWidth / 2, y - 8);
            }

            // X축 레이블 (날짜)
            ctx.fillStyle = isToday ? '#3B82F6' : '#6B7280';
            ctx.font = isToday ? 'bold 12px Pretendard' : '12px Pretendard';
            ctx.textAlign = 'center';
            ctx.fillText(day.label, x + barWidth / 2, padding.top + chartHeight + 20);
            ctx.fillText(`(${day.dayName})`, x + barWidth / 2, padding.top + chartHeight + 36);
        });

        // 데이터 없을 때 메시지
        const totalSteps = days.reduce((sum, d) => sum + d.steps, 0);
        if (totalSteps === 0) {
            ctx.font = '16px Pretendard';
            ctx.fillStyle = '#9CA3AF';
            ctx.textAlign = 'center';
            ctx.fillText('걸음수 데이터가 없습니다', width / 2, height / 2);
        }
    }

    // 걸음수 통계 업데이트
    function updateStepsStats(stepsData) {
        const todayEl = document.getElementById('stepsToday');
        const avgEl = document.getElementById('stepsAvg');
        const maxEl = document.getElementById('stepsMax');

        // 7일 날짜별 데이터 정리
        const dailySteps = {};
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (stepsData && stepsData.length > 0) {
            stepsData.forEach(item => {
                const dateStr = new Date(item.registrationDateTime).toISOString().split('T')[0];
                const steps = item.stepsDaily || item.steps || 0;
                if (!dailySteps[dateStr] || steps > dailySteps[dateStr]) {
                    dailySteps[dateStr] = steps;
                }
            });
        }

        // 오늘 걸음수
        const todaySteps = dailySteps[todayStr] || 0;
        if (todayEl) {
            todayEl.textContent = todaySteps.toLocaleString() + '보';
        }

        // 7일 평균
        const values = Object.values(dailySteps);
        const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
        if (avgEl) {
            avgEl.textContent = avg.toLocaleString() + '보';
        }

        // 최고 기록
        const max = values.length > 0 ? Math.max(...values) : 0;
        if (maxEl) {
            maxEl.textContent = max.toLocaleString() + '보';
        }
    }

    // 걸음수 인사이트 생성 (주간보호 요양원 환경)
    function generateStepsInsights(stepsData, userName) {
        const insightsEl = document.getElementById('stepsInsights');
        if (!insightsEl) return;

        // 7일 날짜별 데이터 정리
        const dailySteps = {};
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            dailySteps[dateStr] = 0;
        }

        if (stepsData && stepsData.length > 0) {
            stepsData.forEach(item => {
                const dateStr = new Date(item.registrationDateTime).toISOString().split('T')[0];
                const steps = item.stepsDaily || item.steps || 0;
                if (dailySteps.hasOwnProperty(dateStr) && steps > dailySteps[dateStr]) {
                    dailySteps[dateStr] = steps;
                }
            });
        }

        const values = Object.values(dailySteps);
        const todaySteps = dailySteps[todayStr] || 0;
        const avg = values.reduce((a, b) => a + b, 0) / 7;
        const max = Math.max(...values);
        // 300보 이상이면 활동한 날로 간주
        const activeDays = values.filter(v => v >= 300).length;

        // 인사이트 생성
        const insights = [];

        // 1. 활동량 평가 (주간보호 환경 - 기준 대폭 하향)
        if (avg >= 800) {
            insights.push({
                icon: '🚶',
                title: '활발한 활동',
                text: `평균 ${Math.round(avg).toLocaleString()}보로 활발하게 움직이고 계십니다.`,
                type: 'positive'
            });
        } else if (avg >= 400) {
            insights.push({
                icon: '👍',
                title: '양호한 활동량',
                text: `평균 ${Math.round(avg).toLocaleString()}보로 적당히 움직이고 계십니다.`,
                type: 'positive'
            });
        } else if (avg >= 200) {
            insights.push({
                icon: '🌱',
                title: '기본 활동 유지',
                text: `평균 ${Math.round(avg).toLocaleString()}보입니다. 적당히 움직이고 계세요.`,
                type: 'normal'
            });
        } else if (avg > 0) {
            insights.push({
                icon: '💛',
                title: '활동 관찰',
                text: `평균 ${Math.round(avg).toLocaleString()}보입니다. 프로그램 참여 시 이동을 도와드려요.`,
                type: 'warning'
            });
        }

        // 2. 오늘 vs 평균 비교
        if (todaySteps > 0 && avg > 0) {
            const diff = todaySteps - avg;
            if (diff > 50) {
                insights.push({
                    icon: '📈',
                    title: '오늘 활동 증가',
                    text: `오늘은 평균보다 ${Math.round(Math.abs(diff)).toLocaleString()}보 더 걸으셨습니다.`,
                    type: 'positive'
                });
            } else if (diff < -100 && avg >= 150) {
                insights.push({
                    icon: '📉',
                    title: '오늘 활동 감소',
                    text: `오늘은 평균보다 ${Math.round(Math.abs(diff)).toLocaleString()}보 적게 걸으셨습니다.`,
                    type: ''
                });
            }
        }

        // 3. 출석 현황 (활동 일수)
        if (activeDays >= 5) {
            insights.push({
                icon: '🌟',
                title: '꾸준한 출석',
                text: `최근 7일 중 ${activeDays}일 활동이 기록되었습니다.`,
                type: 'positive'
            });
        } else if (activeDays >= 3) {
            insights.push({
                icon: '✨',
                title: '출석 현황',
                text: `최근 7일 중 ${activeDays}일 활동이 기록되었습니다.`,
                type: 'normal'
            });
        } else if (activeDays > 0) {
            insights.push({
                icon: '📋',
                title: '출석 확인',
                text: `최근 7일 중 ${activeDays}일 활동이 기록되었습니다.`,
                type: ''
            });
        }

        // 4. 이동량 안내 (매우 낮은 활동량 - 100보 미만)
        if (avg < 100 && avg > 0) {
            insights.push({
                icon: '🚶',
                title: '이동량이 적음',
                text: '최근 이동량이 적습니다. 프로그램 시간에 가벼운 스트레칭을 권해드려요.',
                type: 'warning'
            });
        }

        // HTML 생성
        if (insights.length === 0) {
            insightsEl.innerHTML = `
                <div class="insight-item normal">
                    <span class="insight-icon">📊</span>
                    <div class="insight-content">
                        <div class="insight-title">데이터 수집 중</div>
                        <div class="insight-text">충분한 데이터가 수집되면 활동 분석이 제공됩니다.</div>
                    </div>
                </div>
            `;
        } else {
            insightsEl.innerHTML = insights.map(insight => `
                <div class="insight-item ${insight.type}">
                    <span class="insight-icon">${insight.icon}</span>
                    <div class="insight-content">
                        <div class="insight-title">${insight.title}</div>
                        <div class="insight-text">${insight.text}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // 걸음수 모달 닫기
    window.closeStepsModal = function() {
        const modal = document.getElementById('stepsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 전역 스코프에 노출
    window.showStepsHistory = showStepsHistory;

    // ========== 걸음수 히스토리 관련 끝 ==========

    // 체온 히스토리 모달 표시
    async function showTemperatureHistory(wardedUserId, userName) {
        const modal = document.getElementById('temperatureModal');
        if (!modal) return;
        
        const modalTitle = document.getElementById('temperatureModalTitle');
        if (modalTitle) {
            modalTitle.textContent = `${userName} - 체온 히스토리`;
        }
        
        modal.style.display = 'flex';
        
        // 24시간 전부터 현재까지의 데이터 가져오기
        const now = new Date();
        const dayBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const fromDate = dayBefore.toISOString().split('T')[0];
        const toDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        try {
            // 체온 데이터와 심박수 데이터 함께 가져오기
            const tempUrl = `${API_BASE_URL}/watcher/period?wardedUserId=${wardedUserId}&bioDataTypes=BODY_TEMPERATURE&fromDate=${fromDate}&toDate=${toDate}`;
            const hrUrl = `${API_BASE_URL}/watcher/period?wardedUserId=${wardedUserId}&bioDataTypes=HEART_BEAT&fromDate=${fromDate}&toDate=${toDate}`;
            
            const [tempResponse, hrResponse] = await Promise.all([
                fetch(tempUrl, { headers: { 'Content-Type': 'application/json' } }),
                fetch(hrUrl, { headers: { 'Content-Type': 'application/json' } })
            ]);
            
            const tempData = await tempResponse.json();
            const hrData = await hrResponse.json();
            
            if (tempData.code === "1000" && tempData.response && tempData.response.bodyTemperature) {
                // 24시간 이내 데이터만 필터링
                const filteredTempData = tempData.response.bodyTemperature.filter(item => {
                    const itemTime = new Date(item.registrationDateTime);
                    return itemTime >= dayBefore && itemTime <= now;
                });
                
                // 심박수 데이터도 필터링
                let filteredHrData = [];
                if (hrData.code === "1000" && hrData.response && hrData.response.heartBeat) {
                    filteredHrData = hrData.response.heartBeat.filter(item => {
                        const itemTime = new Date(item.registrationDateTime);
                        return itemTime >= dayBefore && itemTime <= now;
                    });
                }
                
                renderTemperatureChart(filteredTempData, filteredHrData);
                updateTemperatureStats(filteredTempData, filteredHrData);
            }
        } catch (error) {
            console.error('Error fetching temperature history:', error);
        }
    }
    
    // 체온 차트 렌더링 (2개 라인: 피부온, 대기온)
    function renderTemperatureChart(tempData, hrData) {
        const canvas = document.getElementById('temperatureChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        if (!tempData || tempData.length === 0) {
            ctx.font = '16px Pretendard';
            ctx.fillStyle = '#9CA3AF';
            ctx.textAlign = 'center';
            ctx.fillText('데이터가 없습니다', width / 2, height / 2);
            return;
        }
        
        // 시간순으로 정렬
        tempData.sort((a, b) => new Date(a.registrationDateTime) - new Date(b.registrationDateTime));
        
        // 그래프 설정
        const padding = { top: 40, right: 60, bottom: 60, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // 피부온과 대기온 데이터 준비
        const skinTemps = [];
        const ambientTemps = [];
        
        tempData.forEach(item => {
            const time = new Date(item.registrationDateTime);
            const skinTemp = parseFloat(item.bodyTemperature || item.skinTemperature || 32);
            const ambientTemp = parseFloat(item.ambientTemperature || 25);
            
            skinTemps.push({ time, value: skinTemp });
            ambientTemps.push({ time, value: ambientTemp });
        });
        
        // 최대/최소값 찾기
        const allValues = [...skinTemps.map(d => d.value), ...ambientTemps.map(d => d.value)];
        const minValue = Math.min(...allValues) - 2;
        const maxValue = Math.max(...allValues) + 2;
        
        // 시간 범위
        const startTime = skinTemps[0].time;
        const endTime = skinTemps[skinTemps.length - 1].time;
        const timeRange = endTime - startTime;
        
        // 그리드 그리기
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 0.5;
        
        // Y축 그리드
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            
            // Y축 레이블
            const value = (maxValue - ((maxValue - minValue) / 5) * i).toFixed(1);
            ctx.fillStyle = '#6B7280';
            ctx.font = '12px Pretendard';
            ctx.textAlign = 'right';
            ctx.fillText(value + '°C', padding.left - 10, y + 4);
        }
        
        // X축 그리드
        for (let i = 0; i <= 6; i++) {
            const x = padding.left + (chartWidth / 6) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();
            
            // X축 레이블
            const time = new Date(startTime.getTime() + (timeRange / 6) * i);
            ctx.fillStyle = '#6B7280';
            ctx.font = '12px Pretendard';
            ctx.textAlign = 'center';
            ctx.fillText(time.getHours() + ':' + String(time.getMinutes()).padStart(2, '0'), x, height - padding.bottom + 20);
        }
        
        // 라인 그리기 함수
        function drawLine(data, color, lineWidth = 2) {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            
            data.forEach((item, index) => {
                const x = padding.left + (chartWidth * ((item.time - startTime) / timeRange));
                const y = padding.top + chartHeight * (1 - (item.value - minValue) / (maxValue - minValue));
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // 데이터 포인트
            ctx.fillStyle = color;
            data.forEach(item => {
                const x = padding.left + (chartWidth * ((item.time - startTime) / timeRange));
                const y = padding.top + chartHeight * (1 - (item.value - minValue) / (maxValue - minValue));
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        // 각 라인 그리기
        drawLine(ambientTemps, '#10B981', 2);   // 대기온 - 초록
        drawLine(skinTemps, '#3B82F6', 2);      // 피부온 - 파랑
        
        // 제목
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 14px Pretendard';
        ctx.textAlign = 'left';
        ctx.fillText('온도 (°C)', padding.left, 25);
    }
    
    // 체온 통계 업데이트
    function updateTemperatureStats(tempData, hrData) {
        if (!tempData || tempData.length === 0) {
            document.getElementById('tempSkinAvg').textContent = '--';
            document.getElementById('tempAmbientAvg').textContent = '--';
            return;
        }
        
        let skinTempSum = 0;
        let ambientTempSum = 0;
        
        tempData.forEach(item => {
            const skinTemp = parseFloat(item.bodyTemperature || item.skinTemperature || 32);
            const ambientTemp = parseFloat(item.ambientTemperature || 25);
            
            skinTempSum += skinTemp;
            ambientTempSum += ambientTemp;
        });
        
        const count = tempData.length;
        document.getElementById('tempSkinAvg').textContent = (skinTempSum / count).toFixed(1) + '°C';
        document.getElementById('tempAmbientAvg').textContent = (ambientTempSum / count).toFixed(1) + '°C';
    }
    
    // 체온 모달 닫기
    window.closeTemperatureModal = function() {
        const modal = document.getElementById('temperatureModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // 상태 셀 클릭 이벤트 리스너 추가
    document.addEventListener('click', (e) => {
        // 상태 라벨 또는 상태 셀 클릭 감지
        const statusCell = e.target.closest('.resident-table td:nth-child(3)');
        if (statusCell) {
            const row = statusCell.closest('tr');
            const nameCell = row.querySelector('td:first-child');
            const userName = nameCell?.textContent.trim();

            // wardedUserId, deviceId 찾기
            const user = wardedUsers.find(u => u.userName === userName);
            const wardedUserId = row.getAttribute('data-warded-id') || user?.wardedUserId;
            const deviceId = row.getAttribute('data-device-id') || user?.deviceId;

            console.log(`🔍 상태 클릭: ${userName}, wardedUserId=${wardedUserId}, deviceId=${deviceId}`);

            if (wardedUserId) {
                // deviceId가 없으면 wardedUserId를 대신 사용 (fallback)
                showStatusHistory(wardedUserId, userName, deviceId || wardedUserId);
            }
        }
    });

    // 심박수 셀 클릭 이벤트 리스너 추가 (6번째 컬럼 - dashboard-v2.html 구조)
    document.addEventListener('click', (e) => {
        const heartRateCell = e.target.closest('.resident-table td:nth-child(6)');
        if (heartRateCell && heartRateCell.textContent !== '--bpm') {
            const row = heartRateCell.closest('tr');
            const nameCell = row.querySelector('td:first-child');
            const userName = nameCell?.textContent.trim();

            const user = wardedUsers.find(u => u.userName === userName);
            const wardedUserId = row.getAttribute('data-warded-id') || user?.wardedUserId;
            const deviceId = row.getAttribute('data-device-id') || user?.deviceId;

            console.log(`🔍 심박수 클릭: ${userName}, wardedUserId=${wardedUserId}, deviceId=${deviceId}`);

            if (wardedUserId) {
                showHeartRateHistory(wardedUserId, userName, deviceId || wardedUserId);
            }
        }
    });

    // 걸음수 셀 클릭 이벤트 리스너 추가 (7번째 컬럼 - dashboard-v2.html 구조)
    document.addEventListener('click', (e) => {
        const stepsCell = e.target.closest('.resident-table td:nth-child(7)');
        if (stepsCell && stepsCell.textContent !== '--') {
            const row = stepsCell.closest('tr');
            const nameCell = row.querySelector('td:first-child');
            const userName = nameCell?.textContent.trim();

            const user = wardedUsers.find(u => u.userName === userName);
            const wardedUserId = row.getAttribute('data-warded-id') || user?.wardedUserId;
            const deviceId = row.getAttribute('data-device-id') || user?.deviceId;

            console.log(`🔍 걸음수 클릭: ${userName}, wardedUserId=${wardedUserId}, deviceId=${deviceId}`);

            if (wardedUserId) {
                showStepsHistory(wardedUserId, userName, deviceId || wardedUserId);
            }
        }
    });
    
    // 모달 초기화
    setupStatusHistoryModal();
    
    // 툴팁 이벤트 리스너 추가
    document.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('has-tooltip')) {
            const time = e.target.getAttribute('data-time');
            if (time) {
                const timeText = timeAgo(time);
                showTooltip(e.target, timeText);
            }
        } else if (e.target.classList.contains('has-date-tooltip')) {
            const date = e.target.getAttribute('data-date');
            if (date) {
                const dateText = dateAgo(date);
                showTooltip(e.target, dateText);
            }
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('has-tooltip') || e.target.classList.contains('has-date-tooltip')) {
            hideTooltip();
        }
    });

    // Nutrition card swipe logic (rewritten for wrapper and two-card slide)
    const nutritionStates = [
      {
        title: '영양 부족',
        icon: 'assets/card3_1.png',
        value: 2,
        desc: '최근 3일 일일 평균 섭취 1000kcal 미만',
        list: [
          {
            img: 'assets/sleep_01.png',
            name: '김순자',
            summary: '평균 835kcal',
            room: '101호'
          },
          {
            img: 'assets/sleep_02.png',
            name: '이경숙',
            summary: '평균 920kcal',
            room: '105호'
          }
        ]
      },
      {
        title: '수면시간 부족',
        icon: 'assets/card3.png',
        value: 3,
        desc: '최근 3일 일일 평균 수면 5시간 미만',
        list: [
          {
            img: 'assets/sleep_01.png',
            name: '김순자',
            summary: '평균 4시간 25분',
            room: '101호'
          },
          {
            img: 'assets/sleep_02.png',
            name: '이경숙',
            summary: '평균 3시간 51분',
            room: '105호'
          },
          {
            img: 'assets/sleep_03.png',
            name: '이송자',
            summary: '평균 4시간 03분',
            room: '104호'
          }
        ]
      },
      {
        title: '운동 부족',
        icon: 'assets/card3.png',
        value: 3,
        desc: '최근 3일 일일 평균 운동 30분 미만',
        list: [
          {
            img: 'assets/sleep_01.png',
            name: '김순자',
            summary: '평균 23분',
            room: '101호'
          },
          {
            img: 'assets/sleep_02.png',
            name: '이경숙',
            summary: '평균 12분',
            room: '105호'
          },
          {
            img: 'assets/sleep_03.png',
            name: '이송자',
            summary: '평균 7분',
            room: '104호'
          }
        ]
      }
    ];

    let nutritionIndex = 0;

    function createNutritionCard(state) {
      // build a DOM element from existing HTML template
      const card = document.createElement('div');
      card.className = 'card card-nutrition';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-group">
            <span class="card-title">${state.title}</span>
            <button class="info-btn"><span class="icon info"></span></button>
          </div>
          <div class="nutrition-arrows">
            <button class="arrow-btn left" id="slide-left"></button>
            <button class="arrow-btn right" id="slide-right"></button>
          </div>
        </div>
        <div class="card-main">
          <span class="icon nutrition" style="background-image: url('${state.icon}');"></span>
          <span class="card-value">${state.value}</span>
        </div>
        <div class="card-desc">${state.desc}</div>
        <ul class="nutrition-list">
          ${state.list.map(e=>`
            <li>
              <img src="${e.img}" alt="${e.name}" class="profile-img-sm">
              <span class="resident-name">${e.name}</span>
              <span class="swipe-summary">${e.summary}</span>
              <span class="room">${e.room}</span>
            </li>`).join('')}
        </ul>`;
      return card;
    }

    const wrapper = document.querySelector('.card-nutrition-wrapper');
    let currentCard = wrapper ? wrapper.querySelector('.card-nutrition') : null;
    const leftStack = document.querySelector('.cards-top-left-stack');
    function syncCardHeights() {
      if (!leftStack || !wrapper) return;

      // 1) Clear any previously‑set explicit heights so we measure natural size
      wrapper.style.height = 'auto';
      leftStack.style.height = 'auto';

      // 2) Measure natural heights
      const leftHeight = leftStack.getBoundingClientRect().height;
      const rightHeight = currentCard ? currentCard.getBoundingClientRect().height : 0;

      // 3) Apply the taller height so columns stay even
      const synced = Math.max(leftHeight, rightHeight);
      wrapper.style.height = `${synced}px`;
      leftStack.style.height = `${synced}px`;
    }

    function swapCard(direction) {
      // determine next index
      nutritionIndex = direction==='left'
        ? (nutritionIndex - 1 + nutritionStates.length) % nutritionStates.length
        : (nutritionIndex + 1) % nutritionStates.length;

      const nextCard = createNutritionCard(nutritionStates[nutritionIndex]);
      wrapper.appendChild(nextCard);

      // starting position
      nextCard.style.transform = `translateX(${direction==='left' ? '100%' : '-100%'})`;

      // force reflow
      void nextCard.offsetWidth;

      // animate both cards
      currentCard.style.transform = `translateX(${direction==='left' ? '-100%' : '100%'})`;
      nextCard.style.transform = 'translateX(0)';

      // after animation, clean up
      setTimeout(()=>{
        wrapper.removeChild(currentCard);
        currentCard = nextCard;
        attachArrowListeners(); // reattach listeners to new buttons
        syncCardHeights();      // keep columns equal
      }, 350); // duration matches CSS
    }

    function attachArrowListeners() {
      if (!currentCard) return;
      const leftBtn = currentCard.querySelector('#slide-left');
      const rightBtn = currentCard.querySelector('#slide-right');
      if (leftBtn && rightBtn) {
        leftBtn.onclick = ()=>swapCard('left');
        rightBtn.onclick = ()=>swapCard('right');
      }
    }

    attachArrowListeners();
    syncCardHeights();
    window.addEventListener('resize', syncCardHeights);

    // === Expandable detail rows in resident table ===
    const tbody = document.querySelector('.resident-table tbody');

    if (!tbody) return; // record.html 등 테이블이 없는 페이지에서는 종료

    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr || !tbody.contains(tr) || tr.classList.contains('detail-row')) return;

      // Does this row currently have an open detail row?
      const existingDetail = tr.nextElementSibling;
      const isAlreadyOpen = existingDetail && existingDetail.classList.contains('detail-row');

      // Close any open detail row
      const openDetail = tbody.querySelector('.detail-row');
      if (openDetail) openDetail.remove();

      // Clear all selection highlights
      tbody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));

      // If the clicked row was already open, just close & return
      if (isAlreadyOpen) return;

      // Otherwise open a new detail row beneath the clicked row
      tr.classList.add('selected-row');

      const detailTr = document.createElement('tr');
      detailTr.className = 'detail-row';

      const td = document.createElement('td');
      td.colSpan = tr.children.length;
      td.innerHTML = `
        <div class="detail-content">
          <img src="assets/expanded_table_selected.png" alt="상세 정보" style="width: 100%; height: auto; border-radius: 8px;">
        </div>`;
      detailTr.appendChild(td);
      tr.parentNode.insertBefore(detailTr, tr.nextSibling);

      // Expand with animation
      requestAnimationFrame(() => detailTr.classList.add('open'));
    });

  /* === Inmate card detail modal === */
  const inmateDetailBtn = document.querySelector('.card-inmates .card-detail');
  const inmateModal = document.getElementById('inmate-modal');
  const inmateModalClose = document.getElementById('inmate-modal-close');
  const inmateModalList = document.getElementById('inmate-modal-list');

  function buildInmateList() {
    const tbody = document.getElementById('inmate-modal-body');
    tbody.innerHTML = '';

    const guardians = ['김민수', '이지은', '박지훈', '최서연', '정우성',
                       '한지민', '권혁수', '윤하나', '오지훈', '배진아'];
    const notes = ['낙상 위험 관리', '당뇨 관리 중', '혈압 모니터링', '알레르기 주의',
                   '수면장애 관찰', '재활 치료 중', '인지훈련 필요', '정기 약 복용',
                   '식욕 저하 관찰', '우울 증상 관찰'];

    let rowCount = 0;
    document.querySelectorAll('.resident-table tbody tr').forEach((row, idx) => {
      if (row.classList.contains('detail-row')) return;

      const name = row.children[0].textContent.trim();
      const age  = row.children[1].textContent.trim();
      const room = row.children[3].textContent.trim();
      const img  = row.querySelector('img')?.src || '';

      const guardian = guardians[idx % guardians.length];
      const contact  = `010-${(2000+idx).toString().slice(-4)}-${(3000+idx).toString().slice(-4)}`;
      const entry    = `202${1+idx%3}-${String(1+idx%12).padStart(2,'0')}-${String(5+idx%23).padStart(2,'0')}`;
      const note     = notes[idx % notes.length];

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td><img src="${img}" alt="${name}" style="width:42px;height:42px;border-radius:50%"></td>
        <td>${name}</td>
        <td>${age}</td>
        <td>${room}</td>
        <td>${entry}</td>
        <td>${note}</td>
        <td>${guardian}</td>
        <td>${contact}</td>
      `;
      tbody.appendChild(tr);
      rowCount = idx + 1;
    });

    // Add the 26th resident
    const idx = 25;
    const name = '이하준';
    const age  = '79세';
    const room = '112호';
    const img  = 'assets/status_01.png';
    const guardian = '서수민';
    const contact  = '010-2025-3025';
    const entry    = '2023-11-28';
    const note     = '치매 증상 관찰';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td><img src="${img}" alt="${name}" style="width:42px;height:42px;border-radius:50%"></td>
      <td>${name}</td>
      <td>${age}</td>
      <td>${room}</td>
      <td>${entry}</td>
      <td>${note}</td>
      <td>${guardian}</td>
      <td>${contact}</td>
    `;
    tbody.appendChild(tr);
  }

  if (inmateDetailBtn) {
    inmateDetailBtn.addEventListener('click', () => {
      buildInmateList();
      inmateModal.classList.remove('hidden');
    });
  }

  if (inmateModalClose) {
    inmateModalClose.addEventListener('click', () => {
      inmateModal.classList.add('hidden');
    });
  }

  if (inmateModal) {
    inmateModal.addEventListener('click', (e) => {
      if (e.target === inmateModal) {
        inmateModal.classList.add('hidden');
      }
    });
  }

  const gnbBtns = document.querySelectorAll('.gnb-btn');

  // Function to set active GNB button based on current page
  function setActiveGnbButton() {
    const currentPage = window.location.pathname.split('/').pop(); // Gets 'dashboard.html', 'record.html', etc.
    gnbBtns.forEach(btn => {
      const pageName = btn.dataset.page;
      if (pageName === currentPage) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      // Special case for root path, activate dashboard
      if (currentPage === '' && pageName === 'dashboard.html') {
        btn.classList.add('active');
      }
    });
  }

  // Set active GNB button on page load
  setActiveGnbButton();

  // Add click listeners for GNB navigation
  gnbBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pageToNavigate = btn.dataset.page;
      if (pageToNavigate) {
        // Check if demo mode is active and preserve it
        const urlParams = new URLSearchParams(window.location.search);
        const isDemoMode = urlParams.get('demo') === 'true';
        
        if (isDemoMode) {
          window.location.href = pageToNavigate + '?demo=true';
        } else {
          window.location.href = pageToNavigate;
        }
      } else {
        // Fallback for buttons without data-page, or for future single-page-app style views
        console.warn('GNB button clicked without a data-page attribute:', btn.textContent);
        // If you were to implement view switching within a single page:
        // const viewId = btn.dataset.view;
        // if (viewId) {
        //   document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
        //   const targetView = document.getElementById(viewId);
        //   if (targetView) targetView.classList.remove('hidden');
        //   gnbBtns.forEach(b => b.classList.remove('active'));
        //   btn.classList.add('active');
        // }
      }
    });
  });

  // Dashboard specific initializations - only run if dashboard elements exist
  const dashboardView = document.getElementById('dashboard-view'); // Assuming index.html's main content area has this ID or similar
  if (document.querySelector('.dashboard-main')) { // Check if we are on a page with dashboard elements

    // ----- Floor 1 occupancy cycling (IF floor plan exists) -----
    const floor1PlanElement = document.getElementById('floor-1-plan');
    if (floor1PlanElement) {
      const floor1OccupancyCases = [
          { '102': 3, '104': 2, '101': 3, '103': 3, '105': 1, '106': 1 },
          { '102': 2, '화장실': 1, '105': 0, '106': 1 },
          { '101': 4, '103': 2, '응접실': 1, '104': 2 }
      ];
      let currentOccupancyCase = 0;
      function updateFloor1Occupancy() {
          const occupancyMap = floor1OccupancyCases[currentOccupancyCase];
          floor1PlanElement.querySelectorAll('.room').forEach(room => {
              const nameEl = room.querySelector('.room-name');
              const occEl = room.querySelector('.occupancy');
              if (!nameEl || !occEl) return;
              const roomName = nameEl.textContent.trim();
              if (Object.prototype.hasOwnProperty.call(occupancyMap, roomName)) {
                  const count = occupancyMap[roomName];
                  if (count === 0) {
                      occEl.textContent = '';
                      occEl.style.display = 'none';
                  } else {
                      occEl.textContent = count;
                      occEl.style.display = 'flex';
                  }
              }
          });
          currentOccupancyCase = (currentOccupancyCase + 1) % floor1OccupancyCases.length;
      }
      setInterval(updateFloor1Occupancy, 1000); // Keep this interval
    }

    // Nutrition card swipe logic (IF nutrition wrapper exists)
    const nutritionWrapper = document.querySelector('.card-nutrition-wrapper');
    if (nutritionWrapper) {
        let currentCard = nutritionWrapper.querySelector('.card-nutrition');
        const leftStack = document.querySelector('.cards-top-left-stack');

        function syncCardHeights() {
            if (!leftStack || !nutritionWrapper || !currentCard) return;
            nutritionWrapper.style.height = 'auto';
            leftStack.style.height = 'auto';
            const leftHeight = leftStack.getBoundingClientRect().height;
            const rightHeight = currentCard.getBoundingClientRect().height;
            const synced = Math.max(leftHeight, rightHeight);
            nutritionWrapper.style.height = `${synced}px`;
            leftStack.style.height = `${synced}px`;
        }

        function swapCard(direction) {
            nutritionIndex = direction === 'left'
                ? (nutritionIndex - 1 + nutritionStates.length) % nutritionStates.length
                : (nutritionIndex + 1) % nutritionStates.length;
            const nextCard = createNutritionCard(nutritionStates[nutritionIndex]);
            nutritionWrapper.appendChild(nextCard);
            nextCard.style.transform = `translateX(${direction === 'left' ? '100%' : '-100%'})`;
            void nextCard.offsetWidth;
            currentCard.style.transform = `translateX(${direction === 'left' ? '-100%' : '100%'})`;
            nextCard.style.transform = 'translateX(0)';
            setTimeout(() => {
                if (nutritionWrapper.contains(currentCard)) { // Check if currentCard is still a child
                    nutritionWrapper.removeChild(currentCard);
                }
                currentCard = nextCard;
                attachArrowListeners();
                syncCardHeights();
            }, 350);
        }

        function attachArrowListeners() {
            if (!currentCard) return;
            const leftBtn = currentCard.querySelector('#slide-left');
            const rightBtn = currentCard.querySelector('#slide-right');
            if (leftBtn && rightBtn) {
                leftBtn.onclick = () => swapCard('left');
                rightBtn.onclick = () => swapCard('right');
            }
        }
        if (currentCard) { // Ensure currentCard exists before attaching listeners
            attachArrowListeners();
            syncCardHeights();
            window.addEventListener('resize', syncCardHeights);
        }
    }

    // Expandable detail rows in resident table (IF resident table exists)
    const residentTableBody = document.querySelector('.resident-table tbody');
    if (residentTableBody) {
        residentTableBody.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            if (!tr || !residentTableBody.contains(tr) || tr.classList.contains('detail-row')) return;
            const existingDetail = tr.nextElementSibling;
            const isAlreadyOpen = existingDetail && existingDetail.classList.contains('detail-row');
            const openDetail = residentTableBody.querySelector('.detail-row');
            if (openDetail) openDetail.remove();
            residentTableBody.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
            if (isAlreadyOpen) return;
            tr.classList.add('selected-row');
            const detailTr = document.createElement('tr');
            detailTr.className = 'detail-row';
            const td = document.createElement('td');
            td.colSpan = tr.children.length;
            td.innerHTML = `
                <div class="detail-content">
                  <img src="assets/expanded_table_selected.png" alt="상세 정보" style="width: 100%; height: auto; border-radius: 8px;">
                </div>`;
            detailTr.appendChild(td);
            tr.parentNode.insertBefore(detailTr, tr.nextSibling);
            requestAnimationFrame(() => detailTr.classList.add('open'));
        });
    }

    // Inmate card detail modal (IF inmate detail button exists)
    const inmateDetailBtn = document.querySelector('.card-inmates .card-detail');
    if (inmateDetailBtn) {
        const inmateModal = document.getElementById('inmate-modal');
        const inmateModalClose = document.getElementById('inmate-modal-close');
        inmateDetailBtn.addEventListener('click', () => {
            buildInmateList(); // Assumes buildInmateList is defined and handles its own element checks
            if(inmateModal) inmateModal.classList.remove('hidden');
        });
        if (inmateModalClose) {
            inmateModalClose.addEventListener('click', () => {
                if(inmateModal) inmateModal.classList.add('hidden');
            });
        }
        if (inmateModal) {
            inmateModal.addEventListener('click', (e) => {
                if (e.target === inmateModal) {
                    inmateModal.classList.add('hidden');
                }
            });
        }
    }
  } // End of dashboard-specific initializations
});

// --- expandable detail rows for resident-table ---
document.addEventListener('DOMContentLoaded', () => {
  const rows = document.querySelectorAll('.resident-table tbody tr');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      // Toggle existing detail row
      const next = row.nextElementSibling;
      if (next && next.classList.contains('detail-row')) {
        next.remove();
        return;
      }
      // Remove any other open detail rows
      document.querySelectorAll('.detail-row').forEach(dr => dr.remove());
      // Create new detail row
      const detailRow = document.createElement('tr');
      detailRow.className = 'detail-row';
      const detailCell = document.createElement('td');
      detailCell.colSpan = row.children.length;
      // Build content container
      const content = document.createElement('div');
      content.className = 'detail-content';
      // Populate with desired details (example: repeat row data)
      content.innerHTML = `
        <strong>상세 정보:</strong>
        ${[...row.children].map(td=>td.textContent.trim()).join(' | ')}
      `;
      detailCell.appendChild(content);
      detailRow.appendChild(detailCell);
      row.parentNode.insertBefore(detailRow, row.nextSibling);
      // Trigger expand animation
      setTimeout(() => {
        content.style.maxHeight = content.scrollHeight + 'px';
      }, 10);
    });
  });
});
// --- attach click handlers to detail-view buttons ---
function attachDetailBtns(callerName) {
  document.querySelectorAll('.detail-btn').forEach(btn => {
    btn.onclick = () => {
      if (btn.classList.contains('primary')) {
        openCallModal(callerName);
      } else {
        alert('전화 기능은 아직 지원되지 않습니다.');
      }
    };
  });
}

async function getLocationName(lat, lng) {
    // 캐시 키 생성 (좌표를 3자리로 반올림하여 캐시 효율성 증대)
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    
    // 캐시 확인
    if (window.API_CONFIG.KAKAO_API.ENABLE_CACHE && window.locationCache[cacheKey]) {
        const cached = window.locationCache[cacheKey];
        const now = Date.now();
        
        // 캐시가 유효한지 확인 (5분 이내)
        if (now - cached.timestamp < window.API_CONFIG.KAKAO_API.CACHE_DURATION) {
            if (window.API_CONFIG.DEBUG_MODE) {
                console.log('위치 캐시 사용:', cached.location);
            }
            return { simple: cached.location, full: cached.fullAddress || cached.location, building: cached.buildingName || '' };
        }
    }
    
    // 카카오맵 API 호출
    try {
        const url = `${window.API_CONFIG.KAKAO_API.GEOCODING_URL}?x=${lng}&y=${lat}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `KakaoAK ${window.API_CONFIG.KAKAO_API.REST_API_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API 응답 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.documents && data.documents.length > 0) {
            const address = data.documents[0].address;
            const roadAddress = data.documents[0].road_address;
            
            // 도로명 주소가 있으면 우선 사용, 없으면 지번 주소 사용
            let fullAddress = '';
            if (roadAddress) {
                fullAddress = roadAddress.address_name;
            } else {
                fullAddress = address.address_name;
            }
            
            // 건물/아파트명 추출
            const buildingName = (roadAddress && roadAddress.building_name) || (address && address.building_name) || '';
            
            // 테이블 표시용 간단 주소
            const simpleLocation = `${address.region_1depth_name} ${address.region_2depth_name}`;
            
            // 캐시에 저장 (전체 주소와 간단 주소, 건물명 모두)
            if (window.API_CONFIG.KAKAO_API.ENABLE_CACHE) {
                window.locationCache[cacheKey] = {
                    location: simpleLocation,
                    fullAddress: fullAddress,
                    buildingName: buildingName,
                    timestamp: Date.now()
                };
            }
            
            if (window.API_CONFIG.DEBUG_MODE) {
                console.log('카카오맵 API 위치 결과:', simpleLocation);
                console.log('카카오맵 API 전체 주소:', fullAddress);
                console.log('카카오맵 API 건물명:', buildingName);
            }
            
            return { simple: simpleLocation, full: fullAddress, building: buildingName };
        } else {
            throw new Error('위치 데이터를 찾을 수 없음');
        }
    } catch (error) {
        console.error('카카오맵 API 오류:', error);
        
        // Fallback: 기존 하드코딩 방식 사용
        return getLocationNameFallback(lat, lng);
    }
}

// Fallback 함수 (기존 하드코딩 방식)
function getLocationNameFallback(lat, lng) {
    const locations = [
        { lat: 37.272, lng: 127.118, name: '용인시 수지구', fullName: '경기도 용인시 수지구', building: '' },
        { lat: 37.273, lng: 127.118, name: '용인시 기흥구', fullName: '경기도 용인시 기흥구', building: '' },
        { lat: 37.271, lng: 127.118, name: '용인시 처인구', fullName: '경기도 용인시 처인구', building: '' },
        { lat: 37.5665, lng: 126.9780, name: '서울시 중구', fullName: '서울특별시 중구', building: '' },
        { lat: 37.5172, lng: 127.0473, name: '서울시 강남구', fullName: '서울특별시 강남구', building: '' },
        { lat: 37.4837, lng: 127.0324, name: '서울시 서초구', fullName: '서울특별시 서초구', building: '' } // 서초구 추가
    ];
    
    let closestLocation = locations[0];
    let minDistance = Number.MAX_VALUE;
    
    locations.forEach(loc => {
        const distance = Math.sqrt(Math.pow(lat - loc.lat, 2) + Math.pow(lng - loc.lng, 2));
        if (distance < minDistance) {
            minDistance = distance;
            closestLocation = loc;
        }
    });
    
    if (window.API_CONFIG.DEBUG_MODE) {
        console.log('Fallback 위치 사용:', closestLocation.name);
    }
    
    return { simple: closestLocation.name, full: closestLocation.fullName, building: closestLocation.building };
}

// ===== 인원 관리 모달 기능 =====
// 캐시된 데이터
let cachedResidents = [];
let showDeletedResidents = false; // 삭제된 입소자 표시 여부
let cachedDevices = [];
let editingResidentId = null; // 수정 중인 입소자 ID

function openResidentManagementModal() {
    const modal = document.getElementById('resident-management-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // 프로필/색상 선택 이벤트 바인딩
        initResidentManagementEvents();
        // 입소자 목록 로드
        loadResidentList();
    }
}

function closeResidentManagementModal() {
    const modal = document.getElementById('resident-management-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    // 수정 모드 초기화
    editingResidentId = null;
}

function switchResidentTab(tabName) {
    // 모든 탭 컨텐츠 숨기기
    document.querySelectorAll('.rm-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.rm-modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // 선택한 탭 활성화
    const targetTab = document.getElementById('rm-tab-' + tabName);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    // 탭 버튼 활성화
    const tabs = document.querySelectorAll('.rm-modal-tab');
    if (tabName === 'list' && tabs[0]) tabs[0].classList.add('active');
    if (tabName === 'register' && tabs[1]) tabs[1].classList.add('active');
    if (tabName === 'device' && tabs[2]) tabs[2].classList.add('active');

    // 탭 전환 시 데이터 로드
    if (tabName === 'list') {
        loadResidentList();
    } else if (tabName === 'register') {
        if (!editingResidentId) {
            clearResidentForm();
        }
    } else if (tabName === 'device') {
        loadDeviceList();
    }
}

// ===== 입소자 API 연동 =====
async function loadResidentList() {
    const watcherUserId = window.API_CONFIG.WATCHER_USER_ID;
    const tbody = document.getElementById('rm-resident-list');

    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">로딩 중...</td></tr>';

        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/residents?watcherUserId=${watcherUserId}`, {
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.code === '1000' && result.response) {
            cachedResidents = result.response;
            renderResidentList(cachedResidents);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">데이터를 불러올 수 없습니다.</td></tr>';
        }
    } catch (error) {
        console.error('입소자 목록 로드 실패:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">서버 연결 실패</td></tr>';
    }
}

function renderResidentList(residents) {
    const tbody = document.getElementById('rm-resident-list');
    if (!tbody) return;

    // activeYn에 따라 필터링
    const filteredResidents = residents.filter(r =>
        showDeletedResidents ? r.activeYn === 'N' : r.activeYn !== 'N'
    );

    const emptyMessage = showDeletedResidents
        ? '삭제된 입소자가 없습니다.'
        : '등록된 입소자가 없습니다.';

    if (!filteredResidents || filteredResidents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">${emptyMessage}</td></tr>`;
        updateResidentCounts(0, 0, 0);
        return;
    }

    let connectedCount = 0;
    let disconnectedCount = 0;

    tbody.innerHTML = filteredResidents.map(resident => {
        const isConnected = !!resident.connectedDeviceId;
        if (isConnected) connectedCount++;
        else disconnectedCount++;

        const genderLabel = resident.gender === 'M' || resident.gender === 'male' ? '남' : '여';
        const genderClass = resident.gender === 'M' || resident.gender === 'male' ? 'male' : 'female';
        const emoji = resident.profileEmoji || (genderClass === 'female' ? '👵' : '👴');
        const bgColor = resident.profileColor || '#E5E7EB';

        // 삭제된 입소자면 복구 버튼, 아니면 수정/삭제 버튼
        const actionButtons = showDeletedResidents
            ? `<button class="btn btn-primary btn-sm" onclick="restoreResident('${resident.wardedUserId}')">복구</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="editResident('${resident.wardedUserId}')">수정</button>
               <button class="btn btn-danger btn-sm" onclick="deleteResident('${resident.wardedUserId}')">삭제</button>`;

        return `
            <tr>
              <td>
                <div class="rm-resident-profile">
                  <div class="rm-resident-avatar" style="background: ${bgColor};">${emoji}</div>
                  <div class="rm-resident-name">${resident.userName}</div>
                </div>
              </td>
              <td><span class="rm-gender-badge ${genderClass}">${genderLabel}</span></td>
              <td>${resident.age}세</td>
              <td>${resident.room || '-'}</td>
              <td>${isConnected
                ? `<div class="rm-watch-connected"><span>⌚</span> ${resident.connectedDeviceId}</div>`
                : '<span class="rm-watch-disconnected">미연결</span>'}</td>
              <td><span class="rm-note-text">${resident.notes || '-'}</span></td>
              <td>
                <div class="rm-action-btns">
                  ${actionButtons}
                </div>
              </td>
            </tr>
        `;
    }).join('');

    updateResidentCounts(filteredResidents.length, connectedCount, disconnectedCount);
}

// 삭제된 입소자 보기 토글
function toggleDeletedResidents() {
    showDeletedResidents = !showDeletedResidents;
    const toggleBtn = document.getElementById('rm-toggle-deleted-btn');
    if (toggleBtn) {
        toggleBtn.textContent = showDeletedResidents ? '활성 입소자 보기' : '삭제된 입소자 보기';
        toggleBtn.classList.toggle('active', showDeletedResidents);
    }
    renderResidentList(cachedResidents);
}

// 입소자 복구
async function restoreResident(wardedUserId) {
    if (!confirm('이 입소자를 복구하시겠습니까?')) {
        return;
    }

    const watcherUserId = window.API_CONFIG.WATCHER_USER_ID;

    try {
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/resident/${wardedUserId}/restore?watcherUserId=${watcherUserId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.code === '1000') {
            alert('입소자가 복구되었습니다.');
            loadResidentList();
        } else {
            alert('복구 중 오류가 발생했습니다: ' + (result.message || result.code));
        }
    } catch (error) {
        console.error('입소자 복구 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

function updateResidentCounts(total, connected, disconnected) {
    const totalEl = document.getElementById('rm-total-count');
    const connectedEl = document.getElementById('rm-connected-count');
    const disconnectedEl = document.getElementById('rm-disconnected-count');

    if (totalEl) totalEl.textContent = total;
    if (connectedEl) connectedEl.textContent = connected;
    if (disconnectedEl) disconnectedEl.textContent = disconnected;
}

function editResident(wardedUserId) {
    const resident = cachedResidents.find(r => r.wardedUserId === wardedUserId);
    if (!resident) {
        alert('입소자 정보를 찾을 수 없습니다.');
        return;
    }

    editingResidentId = wardedUserId;

    // 폼에 데이터 채우기
    const nameInput = document.getElementById('rm-input-name');
    const ageInput = document.getElementById('rm-input-age');
    const roomInput = document.getElementById('rm-input-room');
    const notesInput = document.getElementById('rm-input-notes');

    if (nameInput) nameInput.value = resident.userName;
    if (ageInput) ageInput.value = resident.age;
    if (roomInput) roomInput.value = resident.room || '';
    if (notesInput) notesInput.value = resident.notes || '';

    // 성별 선택
    const genderMale = document.getElementById('rm-gender-male');
    const genderFemale = document.getElementById('rm-gender-female');
    if (resident.gender === 'M' || resident.gender === 'male') {
        if (genderMale) genderMale.checked = true;
    } else {
        if (genderFemale) genderFemale.checked = true;
    }

    // 프로필 이모지 선택
    if (resident.profileEmoji) {
        document.querySelectorAll('.rm-profile-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.textContent === resident.profileEmoji) {
                opt.classList.add('selected');
            }
        });
        const preview = document.getElementById('rm-profile-preview');
        if (preview) preview.textContent = resident.profileEmoji;
    }

    // 배경색 선택
    if (resident.profileColor) {
        document.querySelectorAll('.rm-color-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.getAttribute('data-color') === resident.profileColor) {
                opt.classList.add('selected');
            }
        });
        const preview = document.getElementById('rm-profile-preview');
        if (preview) preview.style.background = resident.profileColor;
    }

    switchResidentTab('register');
}

function clearResidentForm() {
    editingResidentId = null;

    const nameInput = document.getElementById('rm-input-name');
    const ageInput = document.getElementById('rm-input-age');
    const roomInput = document.getElementById('rm-input-room');
    const notesInput = document.getElementById('rm-input-notes');

    if (nameInput) nameInput.value = '';
    if (ageInput) ageInput.value = '';
    if (roomInput) roomInput.value = '';
    if (notesInput) notesInput.value = '';

    // 성별 초기화
    const genderMale = document.getElementById('rm-gender-male');
    const genderFemale = document.getElementById('rm-gender-female');
    if (genderMale) genderMale.checked = false;
    if (genderFemale) genderFemale.checked = false;

    // 프로필 초기화
    document.querySelectorAll('.rm-profile-option').forEach((opt, idx) => {
        opt.classList.toggle('selected', idx === 0);
    });
    document.querySelectorAll('.rm-color-option').forEach((opt, idx) => {
        opt.classList.toggle('selected', idx === 0);
    });

    const preview = document.getElementById('rm-profile-preview');
    if (preview) {
        preview.textContent = '👵';
        preview.style.background = '#E5E7EB';
    }
}

async function registerResident() {
    const name = document.getElementById('rm-input-name')?.value;
    const age = document.getElementById('rm-input-age')?.value;
    const gender = document.querySelector('input[name="rm-gender"]:checked')?.value;
    const room = document.getElementById('rm-input-room')?.value;
    const notes = document.getElementById('rm-input-notes')?.value;

    // 선택된 이모지와 색상
    const selectedEmoji = document.querySelector('.rm-profile-option.selected')?.textContent || '👵';
    const selectedColor = document.querySelector('.rm-color-option.selected')?.getAttribute('data-color') || '#E5E7EB';

    if (!name || !age || !gender) {
        alert('이름, 나이, 성별은 필수 입력 항목입니다.');
        return;
    }

    const watcherUserId = window.API_CONFIG.WATCHER_USER_ID;
    const genderCode = gender === 'male' ? 'M' : 'F';

    try {
        let response;

        if (editingResidentId) {
            // 수정 모드
            response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/resident/${editingResidentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userName: name,
                    age: parseInt(age),
                    gender: genderCode,
                    room: room || null,
                    notes: notes || null,
                    profileEmoji: selectedEmoji,
                    profileColor: selectedColor
                })
            });
        } else {
            // 등록 모드
            response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/resident`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    watcherUserId: watcherUserId,
                    userName: name,
                    age: parseInt(age),
                    gender: genderCode,
                    room: room || null,
                    notes: notes || null,
                    profileEmoji: selectedEmoji,
                    profileColor: selectedColor
                })
            });
        }

        const result = await response.json();

        if (result.code === '1000') {
            alert(editingResidentId ? '입소자 정보가 수정되었습니다.' : '입소자가 등록되었습니다.');
            editingResidentId = null;
            clearResidentForm();
            switchResidentTab('list');
        } else {
            alert('처리 중 오류가 발생했습니다: ' + (result.message || result.code));
        }
    } catch (error) {
        console.error('입소자 저장 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

async function deleteResident(wardedUserId) {
    if (!confirm('정말로 이 입소자를 삭제하시겠습니까?')) {
        return;
    }

    const watcherUserId = window.API_CONFIG.WATCHER_USER_ID;

    try {
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/resident/${wardedUserId}?watcherUserId=${watcherUserId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.code === '1000') {
            alert('입소자가 삭제되었습니다.');
            loadResidentList();
        } else {
            alert('삭제 중 오류가 발생했습니다: ' + (result.message || result.code));
        }
    } catch (error) {
        console.error('입소자 삭제 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

// ===== 워치(디바이스) API 연동 =====
async function loadDeviceList() {
    const watcherUserId = window.API_CONFIG.WATCHER_USER_ID;
    const deviceList = document.querySelector('.rm-device-list');

    if (!deviceList) return;

    try {
        deviceList.innerHTML = '<div style="text-align:center;padding:40px;">로딩 중...</div>';

        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/devices?watcherUserId=${watcherUserId}`, {
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.code === '1000' && result.response) {
            cachedDevices = result.response;
            renderDeviceList(cachedDevices);
        } else {
            deviceList.innerHTML = '<div style="text-align:center;padding:40px;">데이터를 불러올 수 없습니다.</div>';
        }
    } catch (error) {
        console.error('워치 목록 로드 실패:', error);
        deviceList.innerHTML = '<div style="text-align:center;padding:40px;">서버 연결 실패</div>';
    }
}

function renderDeviceList(devices) {
    const deviceList = document.querySelector('.rm-device-list');
    if (!deviceList) return;

    if (!devices || devices.length === 0) {
        deviceList.innerHTML = '<div style="text-align:center;padding:40px;">등록된 워치가 없습니다.</div>';
        updateDeviceCounts(0, 0, 0);
        return;
    }

    let connectedCount = 0;
    let disconnectedCount = 0;

    // 미연결 입소자 목록 생성 (select 옵션용)
    const unconnectedResidents = cachedResidents.filter(r => !r.connectedDeviceId);
    const residentOptions = unconnectedResidents.map(r =>
        `<option value="${r.wardedUserId}">${r.userName} (${r.room || '호실없음'})</option>`
    ).join('');

    deviceList.innerHTML = devices.map(device => {
        const isConnected = !!device.connectedResident;
        const isOnline = device.status === 'ONLINE';
        if (isConnected) connectedCount++;
        else disconnectedCount++;

        if (isConnected) {
            const resident = device.connectedResident;
            const emoji = resident.profileEmoji || '👵';
            const bgColor = resident.profileColor || '#E5E7EB';

            return `
                <div class="rm-device-card connected">
                  <div class="rm-device-info">
                    <div class="rm-device-icon">⌚</div>
                    <div>
                      <div class="rm-device-name">${device.deviceName || 'Galaxy Watch'}</div>
                      <div class="rm-device-id">${device.deviceId}</div>
                      <div class="rm-device-status">
                        <span class="rm-device-status-dot ${isOnline ? '' : 'offline'}"></span>
                        ${isOnline ? '온라인' : '오프라인'}${device.batteryLevel ? ` | 배터리 ${device.batteryLevel}%` : ''}
                      </div>
                    </div>
                  </div>
                  <div class="rm-device-mapping">
                    <div class="rm-mapped-resident">
                      <div class="rm-mapped-avatar" style="background: ${bgColor};">${emoji}</div>
                      <span class="rm-mapped-name">${resident.userName}</span>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="disconnectDevice('${device.deviceId}')">연결 해제</button>
                  </div>
                </div>
            `;
        } else {
            return `
                <div class="rm-device-card">
                  <div class="rm-device-info">
                    <div class="rm-device-icon" style="opacity:0.5;">⌚</div>
                    <div>
                      <div class="rm-device-name">${device.deviceName || 'Galaxy Watch'}</div>
                      <div class="rm-device-id">${device.deviceId}</div>
                      <div class="rm-device-status">
                        <span class="rm-device-status-dot ${isOnline ? '' : 'offline'}"></span>
                        ${isOnline ? '온라인' : '오프라인'}${device.batteryLevel ? ` | 배터리 ${device.batteryLevel}%` : ''}
                      </div>
                    </div>
                  </div>
                  <div class="rm-device-mapping">
                    <select class="rm-mapping-select" id="select-${device.deviceId}">
                      <option value="">입소자 선택...</option>
                      ${residentOptions}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="connectDevice('${device.deviceId}')">연결</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDevice('${device.deviceId}')">삭제</button>
                  </div>
                </div>
            `;
        }
    }).join('');

    updateDeviceCounts(devices.length, connectedCount, disconnectedCount);
}

function updateDeviceCounts(total, connected, disconnected) {
    const countDiv = document.querySelector('.rm-tab-content:not(.hidden) .rm-list-count');
    if (countDiv) {
        countDiv.innerHTML = `등록된 워치 <strong>${total}대</strong> | 연결됨 <strong>${connected}대</strong> | 미연결 <strong style="color:#DC2626;">${disconnected}대</strong>`;
    }
}

async function registerWatch() {
    const watchId = document.getElementById('rm-watch-id')?.value;
    const watchName = document.getElementById('rm-watch-name')?.value;

    if (!watchId) {
        alert('워치 ID는 필수 입력 항목입니다.');
        return;
    }

    const watcherUserId = window.API_CONFIG.WATCHER_USER_ID;

    try {
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/device`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                watcherUserId: watcherUserId,
                deviceId: watchId,
                deviceName: watchName || null
            })
        });

        const result = await response.json();

        if (result.code === '1000') {
            alert('워치가 등록되었습니다.');
            document.getElementById('rm-watch-id').value = '';
            document.getElementById('rm-watch-name').value = '';
            loadDeviceList();
        } else if (result.code === '20003') {
            alert('이미 등록된 워치 ID입니다.');
        } else {
            alert('등록 중 오류가 발생했습니다: ' + (result.message || result.code));
        }
    } catch (error) {
        console.error('워치 등록 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

async function connectDevice(deviceId) {
    const selectEl = document.getElementById(`select-${deviceId}`);
    const wardedUserId = selectEl?.value;

    if (!wardedUserId) {
        alert('연결할 입소자를 선택해주세요.');
        return;
    }

    try {
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/device/${deviceId}/connect`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wardedUserId: wardedUserId })
        });

        const result = await response.json();

        if (result.code === '1000') {
            alert('워치가 연결되었습니다.');
            // 입소자 목록도 새로고침 (연결 상태 업데이트)
            await loadResidentList();
            loadDeviceList();
        } else {
            alert('연결 중 오류가 발생했습니다: ' + (result.message || result.code));
        }
    } catch (error) {
        console.error('워치 연결 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

async function disconnectDevice(deviceId) {
    if (!confirm('워치 연결을 해제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/device/${deviceId}/disconnect`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.code === '1000') {
            alert('워치 연결이 해제되었습니다.');
            await loadResidentList();
            loadDeviceList();
        } else {
            alert('연결 해제 중 오류가 발생했습니다: ' + (result.message || result.code));
        }
    } catch (error) {
        console.error('워치 연결 해제 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

async function deleteDevice(deviceId) {
    if (!confirm('정말로 이 워치를 삭제하시겠습니까?')) {
        return;
    }

    const watcherUserId = window.API_CONFIG.WATCHER_USER_ID;

    try {
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/watcher/device/${deviceId}?watcherUserId=${watcherUserId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.code === '1000') {
            alert('워치가 삭제되었습니다.');
            loadDeviceList();
        } else {
            alert('삭제 중 오류가 발생했습니다: ' + (result.message || result.code));
        }
    } catch (error) {
        console.error('워치 삭제 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

function initResidentManagementEvents() {
    // 프로필 이미지 선택
    document.querySelectorAll('.rm-profile-option').forEach(option => {
        option.onclick = function() {
            document.querySelectorAll('.rm-profile-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            // 미리보기 업데이트
            if (!this.classList.contains('rm-profile-upload-option')) {
                const preview = document.getElementById('rm-profile-preview');
                if (preview) {
                    preview.textContent = this.textContent;
                }
            }
        };
    });

    // 배경 색상 선택
    document.querySelectorAll('.rm-color-option').forEach(option => {
        option.onclick = function() {
            document.querySelectorAll('.rm-color-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            // 미리보기 배경색 업데이트
            const color = this.getAttribute('data-color');
            const preview = document.getElementById('rm-profile-preview');
            if (preview && color) {
                preview.style.background = color;
            }
        };
    });
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', function(e) {
    const modal = document.getElementById('resident-management-modal');
    if (modal && e.target === modal) {
        closeResidentManagementModal();
    }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeResidentManagementModal();
    }
});

// ========================================
// AI Daily Report Functions
// ========================================

// AI 리포트 날짜 업데이트
function updateReportDate() {
  const dateEl = document.getElementById('ai-report-date');
  if (!dateEl) return;

  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const formatted = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} (${days[now.getDay()]}) 일일 리포트`;
  dateEl.textContent = formatted;
}

// 전체 데이터 수집 (AI 프롬프트용) - 캐시 사용으로 최적화
async function collectAllDataForAI() {
  const data = {
    residents: [],
    devices: [],
    events: [],
    bioData: [],
    outings: [],
    summary: {}
  };

  try {
    // 캐시된 데이터 사용 (loadDashboardData가 이미 로드한 경우 재사용)
    const cache = await loadDashboardData();

    // 1. 입소자 목록 (activeYn = 'Y' 또는 'y'인 것만) - 캐시에서 가져옴
    data.residents = (cache.residents || []).filter(r => r.activeYn?.toLowerCase() === 'y');

    // 활성 입소자 ID 목록
    const activeResidentIds = data.residents.map(r => r.wardedUserId);

    // 2. 디바이스 (워치) 정보 - 캐시에서 가져옴
    data.devices = cache.devices || [];

    // 4. 각 입소자별 생체 데이터 (캐시에서 가져옴)
    const connectedDevices = data.devices.filter(d =>
      d.connectedResident && activeResidentIds.includes(d.connectedResident.wardedUserId)
    );

    // 3. 이벤트 정보 (활성 입소자만 + 오늘 날짜만 필터링) - 캐시에서 가져옴
    // 이벤트의 wardedUserId는 deviceId(카카오ID) 형태이므로 devices에서 매칭
    const connectedDeviceIds = connectedDevices.map(d => d.deviceId);
    const allEvents = cache.events || [];

    // 오늘 날짜 문자열 (YYYY-MM-DD)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    data.events = allEvents.filter(e => {
      // 활성 입소자의 이벤트인지 확인
      if (!connectedDeviceIds.includes(e.wardedUserId)) return false;

      // 오늘 날짜의 이벤트인지 확인
      if (e.registrationDateTime) {
        const eventDate = e.registrationDateTime.substring(0, 10); // YYYY-MM-DD
        return eventDate === todayStr;
      }
      return false;
    });

    for (const device of connectedDevices) {
      const wardedUserId = device.connectedResident.wardedUserId;
      const cachedBio = cache.bioData[wardedUserId];

      if (cachedBio) {
        data.bioData.push(cachedBio);

        // 5. 외출 정보 분석 (위치 데이터 기반)
        if (cachedBio.location && cachedBio.location.length > 0) {
          const outingReport = analyzeOutingReport(cachedBio.location);
          if (outingReport.hasOuting) {
            data.outings.push({
              residentName: cachedBio.residentName,
              room: cachedBio.room || '미지정',
              outings: outingReport.outings,
              totalDuration: outingReport.totalDuration,
              currentlyOut: outingReport.currentlyOut // 최근 위치 기준으로 현재 외출중 여부
            });
          }
        }
      }
    }

    // 6. 요약 데이터 계산
    const heartRates = data.bioData.map(b => b.heartBeat?.[0]?.heartBeat).filter(hr => hr && hr > 0);
    const steps = data.bioData.map(b => b.steps?.[0]?.stepsDaily).filter(s => s !== undefined);

    // 미착용 디바이스를 퇴근(충전중)과 진짜 미착용으로 분리
    const notWornDevices = data.devices.filter(d => d.connectedResident && !d.isWorn && activeResidentIds.includes(d.connectedResident.wardedUserId));
    const leftForHome = notWornDevices.filter(d => d.isCharging); // 충전중 = 퇴근(워치 반납)
    const actuallyNotWorn = notWornDevices.filter(d => !d.isCharging); // 미충전 = 진짜 미착용 (주의 필요)

    data.summary = {
      totalResidents: data.residents.length,
      connectedWatches: connectedDevices.length,
      lowBattery: data.devices.filter(d => d.connectedResident && d.batteryLevel < 20 && !d.isCharging && activeResidentIds.includes(d.connectedResident.wardedUserId)),
      notWorn: actuallyNotWorn, // 진짜 미착용자만 (충전중 아닌 경우)
      leftForHome: leftForHome, // 퇴근자 (충전중인 미착용)
      events: {
        total: data.events.length,
        unconfirmed: data.events.filter(e => e.status === 'UNCONFIRMED').length,
        fall: data.events.filter(e => e.eventType === 'FALL_DETECTED').length,
        highHR: data.events.filter(e => e.eventType === 'HIGH_HEART_RATE_DETECTED').length,
        lowHR: data.events.filter(e => e.eventType === 'LOW_HEART_RATE_DETECTED').length
      },
      activity: {
        lowSteps: data.bioData.filter(b => (b.steps?.[0]?.stepsDaily || 0) < 1000),
        highSteps: data.bioData.filter(b => (b.steps?.[0]?.stepsDaily || 0) > 5000),
        avgSteps: steps.length > 0 ? steps.reduce((a, b) => a + b, 0) / steps.length : 0,
        minSteps: steps.length > 0 ? Math.min(...steps) : 0,
        maxSteps: steps.length > 0 ? Math.max(...steps) : 0
      },
      heartRate: {
        // 저심박: 40미만, 고심박: 140초과
        critical: data.bioData.filter(b => {
          const hr = b.heartBeat?.[0]?.heartBeat;
          return hr && (hr < 40 || hr > 140);
        }),
        avgHR: heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : 0,
        minHR: heartRates.length > 0 ? Math.min(...heartRates) : 0,
        maxHR: heartRates.length > 0 ? Math.max(...heartRates) : 0,
        allRates: data.bioData.map(b => ({
          name: b.residentName,
          hr: b.heartBeat?.[0]?.heartBeat || 0
        })).filter(x => x.hr > 0)
      },
      outings: {
        total: data.outings.length,
        currentlyOut: data.outings.filter(o => o.currentlyOut).length,
        details: data.outings
      }
    };

  } catch (e) {
    console.error('데이터 수집 실패:', e);
  }

  return data;
}

// AI 요약 생성 (백엔드 프록시 사용)
async function generateAISummary() {
  const summaryEl = document.getElementById('ai-summary-text');
  if (!summaryEl) return;

  // 전체 데이터 수집 (먼저 실행)
  const data = await collectAllDataForAI();
  const s = data.summary;

  // 상세 섹션 먼저 업데이트 (AI 응답 기다리지 않음)
  updateDetailSections(data);

  if (!window.API_CONFIG?.AI_CONFIG?.ENABLED) {
    summaryEl.textContent = 'AI 요약이 비활성화되어 있습니다.';
    return;
  }

  try {
    summaryEl.innerHTML = '<span class="loading">AI 요약 생성 중...</span>';

    // 건강현황 추가 데이터 계산
    const connectedDevices = data.devices?.filter(d => d.connectedResident) || [];
    const wornCount = connectedDevices.filter(d => d.isWorn).length;

    // 추가 컨텍스트 생성 (상세 정보)
    const leftForHomeList = (s.leftForHome || []).map(d => d.connectedResident?.userName).filter(Boolean);
    const actualNotWornList = (s.notWorn || []).map(d => d.connectedResident?.userName).filter(Boolean);

    let additionalContext = '';
    if (s.outings.details && s.outings.details.length > 0) {
      const outingText = s.outings.details.map(o => {
        const status = o.currentlyOut ? '외출중' : '복귀완료';
        const duration = o.totalDuration > 0 ? formatOutingDuration(o.totalDuration) : '';
        return `${o.residentName}(${status}${duration ? ', ' + duration : ''})`;
      }).join(', ');
      additionalContext += `- 외출 상세: ${outingText}\n`;
    }
    if (leftForHomeList.length > 0) {
      additionalContext += `- 퇴근(귀가): ${leftForHomeList.join(', ')}님\n`;
    }
    if (actualNotWornList.length > 0) {
      additionalContext += `- 미착용(확인필요): ${actualNotWornList.join(', ')}님\n`;
    }
    if (s.heartRate.critical.length > 0) {
      additionalContext += `- 심박수 주의: ${s.heartRate.critical.map(b => `${b.residentName}님 ${b.heartBeat?.[0]?.heartBeat}bpm`).join(', ')}\n`;
    }
    if (s.lowBattery.length > 0) {
      additionalContext += `- 배터리 부족: ${s.lowBattery.map(d => `${d.connectedResident?.userName}님 ${d.batteryLevel}%`).join(', ')}\n`;
    }
    if (s.events.total > 0) {
      additionalContext += `- 오늘 이벤트: ${s.events.total}건 (미확인 ${s.events.unconfirmed}건)\n`;
    }

    // 백엔드 프록시 API 호출
    const BASE_URL = window.API_CONFIG?.BASE_URL || '';
    const response = await fetch(`${BASE_URL}/watcher/ai/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        totalResidents: s.totalResidents,
        wornCount: wornCount,
        outingCount: s.outings.currentlyOut,
        alertCount: s.events.unconfirmed,
        avgHeartRate: s.heartRate.average,
        avgOxygen: null,
        currentTime: new Date().toLocaleString('ko-KR'),
        additionalContext: additionalContext || null
      })
    });

    const result = await response.json();

    if (result.code === '1000' && result.response?.summary) {
      summaryEl.textContent = result.response.summary;
    } else {
      summaryEl.textContent = result.message || 'AI 요약을 불러오지 못했습니다.';
    }

  } catch (e) {
    console.error('AI 요약 생성 실패:', e);
    summaryEl.textContent = 'AI 요약을 불러오지 못했습니다.';
  }
}

// 상세 섹션 업데이트 (이벤트/외출/배터리)
function updateDetailSections(data) {
  const s = data.summary;

  // === 이벤트 섹션 ===
  const eventsCount = document.getElementById('events-count');
  const eventsContent = document.getElementById('events-content');

  if (eventsContent) {
    const eventTypeLabels = {
      'FALL_DETECTED': { icon: '🚨', label: '낙상 감지' },
      'HIGH_HEART_RATE_DETECTED': { icon: '💓', label: '고심박 감지' },
      'LOW_HEART_RATE_DETECTED': { icon: '💔', label: '저심박 감지' }
    };

    // deviceId -> 입소자 이름 매핑 생성
    const deviceToResident = {};
    (data.devices || []).forEach(d => {
      if (d.connectedResident) {
        deviceToResident[d.deviceId] = d.connectedResident.userName;
      }
    });

    // 오늘 날짜 이벤트만 필터링
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEvents = (data.events || []).filter(e => {
      const eventDate = new Date(e.registrationDateTime);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === today.getTime();
    });

    // 오늘 이벤트 개수 표시
    if (eventsCount) eventsCount.textContent = `${todayEvents.length}건`;

    if (todayEvents.length > 0) {
      // 정렬: 미확인 우선, 그 다음 최신순
      const sortedEvents = [...todayEvents].sort((a, b) => {
        // 1. UNCONFIRMED 우선
        const aUnconfirmed = !a.status || a.status === 'UNCONFIRMED';
        const bUnconfirmed = !b.status || b.status === 'UNCONFIRMED';
        if (aUnconfirmed && !bUnconfirmed) return -1;
        if (!aUnconfirmed && bUnconfirmed) return 1;
        // 2. 최신순 (시간 내림차순)
        return new Date(b.registrationDateTime) - new Date(a.registrationDateTime);
      });

      eventsContent.innerHTML = sortedEvents.map(event => {
        const eventInfo = eventTypeLabels[event.eventType] || { icon: '⚠️', label: event.eventType };
        const time = new Date(event.registrationDateTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        // 이벤트의 wardedUserId는 deviceId 형태이므로 매핑에서 찾음
        const residentName = event.wardedUserName || deviceToResident[event.wardedUserId] || '알 수 없음';

        // 상태별 클래스 및 라벨
        let statusClass, statusLabel;
        switch (event.status) {
          case 'UNCONFIRMED':
            statusClass = 'status-danger';
            statusLabel = '미확인';
            break;
          case 'CONFIRMED':
            statusClass = 'status-warning';
            statusLabel = '확인중';
            break;
          case 'RESOLVED_ACTION':
            statusClass = 'status-normal';
            statusLabel = '조치완료';
            break;
          case 'RESOLVED_NOISSUE':
            statusClass = 'status-normal';
            statusLabel = '조치완료(이슈없음)';
            break;
          case 'RESOLVED':
            statusClass = 'status-normal';
            statusLabel = '조치완료';
            break;
          default:
            statusClass = 'status-normal';
            statusLabel = event.status || '확인중';
        }

        return `<div class="ai-detail-item">
          <span class="ai-detail-time">${time}</span>
          <span class="ai-detail-name">${residentName}</span>
          <span class="ai-detail-badge">${eventInfo.icon} ${eventInfo.label}</span>
          <span class="ai-detail-status ${statusClass}">${statusLabel}</span>
        </div>`;
      }).join('');
    } else {
      eventsContent.innerHTML = '<div class="ai-detail-empty">오늘 발생한 이벤트가 없습니다.</div>';
    }
  }

  // === 외출 섹션 ===
  const outingCount = document.getElementById('outing-count');
  const outingContent = document.getElementById('outing-content');

  if (outingCount) outingCount.textContent = `${s.outings.total}명`;
  if (outingContent) {
    const outingResidents = s.outings.details || [];
    if (outingResidents.length > 0) {
      outingContent.innerHTML = outingResidents.map(outing => {
        // 현재 외출중: 최근 위치가 요양원 외부
        // 복귀완료: 오늘 외출 기록이 있지만 최근 위치가 요양원 내부 (복귀함)
        const status = outing.currentlyOut ? '외출중' : '복귀완료';
        const statusIcon = outing.currentlyOut ? '🚶' : '✅';
        const statusClass = outing.currentlyOut ? 'status-warning' : 'status-normal';
        const duration = outing.totalDuration > 0 ? formatOutingDuration(outing.totalDuration) : '';

        return `<div class="ai-detail-item">
          <span class="ai-detail-name">${outing.residentName}</span>
          <span class="ai-detail-badge ${statusClass}">${statusIcon} ${status}</span>
          ${duration ? `<span class="ai-detail-location">⏱️ ${duration}</span>` : ''}
        </div>`;
      }).join('');
    } else {
      outingContent.innerHTML = '<div class="ai-detail-empty">오늘 외출 기록이 없습니다.</div>';
    }
  }

  // === 건강 현황 섹션 ===
  const healthCount = document.getElementById('health-count');
  const healthContent = document.getElementById('health-content');

  if (healthCount) {
    const totalWithData = data.bioData?.length || 0;
    healthCount.textContent = `${totalWithData}명`;
  }

  if (healthContent) {
    const healthItems = [];

    // 심박수 통계
    if (s.heartRate && s.heartRate.allRates && s.heartRate.allRates.length > 0) {
      const avgHR = Math.round(s.heartRate.avgHR);
      const abnormalHR = s.heartRate.allRates.filter(r => r.hr < 40 || r.hr > 140);

      healthItems.push(`<div class="ai-detail-item">
        <span class="ai-detail-badge">💓 심박수</span>
        <span class="ai-detail-name">평균 ${avgHR}bpm</span>
        ${abnormalHR.length > 0
          ? `<span class="ai-detail-status status-danger">이상 ${abnormalHR.length}명</span>`
          : `<span class="ai-detail-status status-normal">모두 정상</span>`}
      </div>`);
    }

    // 걸음수 통계
    if (s.activity) {
      const avgSteps = Math.round(s.activity.avgSteps);
      const lowActivity = s.activity.lowSteps?.length || 0;

      healthItems.push(`<div class="ai-detail-item">
        <span class="ai-detail-badge">👟 걸음수</span>
        <span class="ai-detail-name">평균 ${avgSteps.toLocaleString()}보</span>
        ${lowActivity > 0
          ? `<span class="ai-detail-status status-warning">저활동 ${lowActivity}명</span>`
          : `<span class="ai-detail-status status-normal">활동량 양호</span>`}
      </div>`);
    }

    // 워치 착용 현황
    const connectedDevices = data.devices?.filter(d => d.connectedResident) || [];
    const wornCount = connectedDevices.filter(d => d.isWorn).length;
    const notWornCount = connectedDevices.length - wornCount;

    if (connectedDevices.length > 0) {
      healthItems.push(`<div class="ai-detail-item">
        <span class="ai-detail-badge">⌚ 워치 착용</span>
        <span class="ai-detail-name">${wornCount}명 착용중</span>
        ${notWornCount > 0
          ? `<span class="ai-detail-status status-warning">미착용 ${notWornCount}명</span>`
          : `<span class="ai-detail-status status-normal">전원 착용</span>`}
      </div>`);
    }

    // 총 모니터링 인원 (30분 이내 데이터가 있는 경우만 실시간 측정중으로 판단)
    const totalResidents = s.totalResidents || 0;
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // 각 입소자별 최근 데이터 시간 확인
    const activeMonitoring = (data.bioData || []).filter(bio => {
      // heartBeat, steps, location 등에서 가장 최근 타임스탬프 확인
      const timestamps = [];
      if (bio.heartBeat?.[0]?.registrationDateTime) {
        timestamps.push(new Date(bio.heartBeat[0].registrationDateTime));
      }
      if (bio.steps?.[0]?.registrationDateTime) {
        timestamps.push(new Date(bio.steps[0].registrationDateTime));
      }
      if (bio.location?.[0]?.registrationDateTime) {
        timestamps.push(new Date(bio.location[0].registrationDateTime));
      }
      if (timestamps.length === 0) return false;
      const latestTime = new Date(Math.max(...timestamps));
      return latestTime >= thirtyMinutesAgo;
    });

    const activeCount = activeMonitoring.length;
    const inactiveCount = (data.bioData?.length || 0) - activeCount;

    healthItems.push(`<div class="ai-detail-item">
      <span class="ai-detail-badge">👥 모니터링</span>
      <span class="ai-detail-name">총 ${totalResidents}명 중 ${activeCount}명</span>
      ${inactiveCount > 0
        ? `<span class="ai-detail-status status-warning">미수신 ${inactiveCount}명</span>`
        : `<span class="ai-detail-status status-normal">실시간 측정중</span>`}
    </div>`);

    healthContent.innerHTML = healthItems.length > 0
      ? healthItems.join('')
      : '<div class="ai-detail-empty">건강 데이터가 없습니다.</div>';
  }

  // === 배터리 섹션 ===
  const batteryCount = document.getElementById('battery-count');
  const batteryContent = document.getElementById('battery-content');

  if (batteryCount) batteryCount.textContent = `${s.lowBattery.length}명`;
  if (batteryContent) {
    if (s.lowBattery.length > 0) {
      batteryContent.innerHTML = s.lowBattery.map(device => {
        const residentName = device.connectedResident?.userName || '미연결';
        const battery = device.batteryLevel || 0;
        const isCharging = device.isCharging;
        const chargingIcon = isCharging ? '🔌' : '🔋';
        const statusClass = battery < 10 ? 'status-danger' : 'status-warning';

        return `<div class="ai-detail-item">
          <span class="ai-detail-name">${residentName}</span>
          <span class="ai-detail-badge ${statusClass}">${chargingIcon} ${battery}%</span>
          ${isCharging ? '<span class="ai-detail-status status-normal">충전중</span>' : '<span class="ai-detail-status status-warning">충전 필요</span>'}
        </div>`;
      }).join('');
    } else {
      batteryContent.innerHTML = '<div class="ai-detail-empty">배터리 부족 워치가 없습니다.</div>';
    }
  }

  // 경고 섹션 강조
  if (s.events.unconfirmed > 0) {
    document.getElementById('section-events')?.classList.add('section-warning');
  }
  if (s.outings.currentlyOut > 0) {
    document.getElementById('section-outing')?.classList.add('section-warning');
  }
  if (s.lowBattery.length > 0) {
    document.getElementById('section-battery')?.classList.add('section-warning');
  }

  // 건강현황 경고 강조 - 심박수/걸음수/워치착용/모니터링 중 하나라도 문제가 있으면 하이라이트
  const connectedDevicesForHealth = data.devices?.filter(d => d.connectedResident) || [];
  const notWornCountForHealth = connectedDevicesForHealth.length - connectedDevicesForHealth.filter(d => d.isWorn).length;
  const abnormalHRCount = s.heartRate?.allRates?.filter(r => r.hr < 40 || r.hr > 140).length || 0;
  const lowActivityCount = s.activity?.lowSteps?.length || 0;

  // 모니터링 중단 계산 (30분 이내 데이터 없는 경우)
  const nowForHealth = new Date();
  const thirtyMinutesAgoForHealth = new Date(nowForHealth.getTime() - 30 * 60 * 1000);
  const activeMonitoringForHealth = (data.bioData || []).filter(bio => {
    const timestamps = [];
    if (bio.heartBeat?.[0]?.registrationDateTime) {
      timestamps.push(new Date(bio.heartBeat[0].registrationDateTime));
    }
    if (bio.steps?.[0]?.registrationDateTime) {
      timestamps.push(new Date(bio.steps[0].registrationDateTime));
    }
    if (bio.location?.[0]?.registrationDateTime) {
      timestamps.push(new Date(bio.location[0].registrationDateTime));
    }
    if (timestamps.length === 0) return false;
    const latestTime = new Date(Math.max(...timestamps));
    return latestTime >= thirtyMinutesAgoForHealth;
  });
  const inactiveCountForHealth = (data.bioData?.length || 0) - activeMonitoringForHealth.length;

  // 하나라도 문제가 있으면 건강현황 섹션 하이라이트
  if (abnormalHRCount > 0 || lowActivityCount > 0 || notWornCountForHealth > 0 || inactiveCountForHealth > 0) {
    document.getElementById('section-health')?.classList.add('section-warning');
  }
}

// AI 일일 리포트 초기화
async function initAIDailyReport() {
  updateReportDate();
  await generateAISummary();
}

// PDF 인쇄 (placeholder)
function printReport() {
  window.print();
}

// 리포트 전송 (placeholder)
function sendReport() {
  alert('리포트 전송 기능은 추후 구현 예정입니다.');
}

// 페이지 로드 시 AI 리포트 초기화
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.ai-daily-report')) {
    initAIDailyReport();
  }
});