// === List header controls ===
const selectAllCb   = document.getElementById('select-all');
const bulkBtn       = document.getElementById('bulk-action-btn');
const bulkMenu      = document.getElementById('bulk-action-menu');
const refreshBtn    = document.getElementById('refresh-btn');

const recordListBody = document.getElementById('record-list-body');

function getRowCheckboxes(){
  return recordListBody.querySelectorAll('.record-row .rec-checkbox');
}

if(selectAllCb){
  selectAllCb.addEventListener('change',()=>{
    getRowCheckboxes().forEach(cb=>cb.checked = selectAllCb.checked);
  });
}

if(bulkBtn){
  bulkBtn.addEventListener('click',(e)=>{
    e.stopPropagation();
    bulkMenu.classList.toggle('hidden');
  });
  document.addEventListener('click',()=>bulkMenu.classList.add('hidden'));
  bulkMenu.addEventListener('click',(e)=>{
    if(!e.target.dataset.action) return;
    const action=e.target.dataset.action;
    const rows=[...recordListBody.querySelectorAll('.record-row')];
    if(action==='select-all'){
      rows.forEach(r=>r.querySelector('.rec-checkbox').checked=true);
      selectAllCb.checked=true;
    }else if(action==='mark-read'){
      rows.forEach(r=>{
        if(r.querySelector('.rec-checkbox').checked){
          r.classList.add('read');
          r.querySelector('.rec-right').textContent='읽음';
        }
      });
    }else if(action==='mark-unread'){
      rows.forEach(r=>{
        if(r.querySelector('.rec-checkbox').checked){
          r.classList.remove('read');
          r.querySelector('.rec-right').textContent='';
        }
      });
    }
    bulkMenu.classList.add('hidden');
  });
}

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
  resolved: []
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
          resolved: []
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
      resolved: []
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
          resolved: []
        };
      }
      return;
    }

    let cacheHitCount = 0;

    // Process events and create record entries
    for (const event of events) {
      const resident = mappings.find(m => m.wardedUserId === event.wardedUserId);
      if (!resident) continue;

      // Get bio data for vitals
      const bioData = await fetchLatestBioData(event.wardedUserId);
      
      const record = await createRecordFromEvent(event, resident, bioData);
      
      // 캐시에서 처리 상태 확인
      const cachedStatus = getProcessedEventFromCache(event.eventId);
      
      if (cachedStatus) {
        // 캐시에서 처리 상태 복원
        if (cachedStatus.recordData && cachedStatus.recordData.reply) {
          record.reply = cachedStatus.recordData.reply;
        }
        recordData[cachedStatus.category].push(record);
        cacheHitCount++;
        console.log(`🔄 이벤트 ${event.eventId}를 캐시에서 ${cachedStatus.category}로 복원`);
      } else {
        // 새로운 이벤트는 API 상태 또는 미확인으로 분류
        if (event.status === 'UNCONFIRMED' || !event.status) {
          recordData.unconfirmed.push(record);
        } else if (event.status === 'CONFIRMED') {
          recordData.confirmed.push(record);
        } else if (event.status === 'RESOLVED') {
          recordData.resolved.push(record);
        }
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
        resolved: []
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
    resolved: []
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
      eventId: event.eventId,
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
    resolved: []
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
    
    if (bioData.steps && bioData.steps.length > 0) {
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

  const record = {
    time: timeStr,
    img: resident.userProfileUrl || 'assets/status_01.png',
    name: resident.userName,
    title: eventTypeDetails.title,
    desc: eventTypeDetails.desc,
    right: timeAgoStr,
    timestamp: event.registrationDateTime,
    eventId: event.eventId,
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
    
    // Render initial list
    renderList('unconfirmed');
    syncSidebarCounts();
    
    // Select first record
    setTimeout(() => {
      const firstRow = recordListBody.querySelector('.record-row');
      if (firstRow) {
        firstRow.click();
      }
    }, 100);
    
  } catch (error) {
    console.error('Error initializing record data:', error);
    if (recordListBody) {
      recordListBody.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">데이터 로드 실패</div>';
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
    
    if (ENABLE_MOCK_DATA) {
        console.log('🎭 목업 모드: mockData.mappings 반환');
        return mockData.mappings;
    }
    
    console.log('🌐 실제 API 호출 시작...');
    try {
        const url = `${API_BASE_URL}/watcher/mappings?watcherUserId=${WATCHER_USER_ID}`;
        console.log('📞 API 호출:', url);
        
        const response = await fetch(url, {
            headers: {'Content-Type': 'application/json'}
        });
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📋 Response data:', data);
        
        if (data.code === "1000") {
            const filtered = data.response.filter(m => m.activeYn === 'o' || m.activeYn === 'y');
            console.log('✅ 필터링된 매핑:', filtered);
            return filtered;
        } else {
            console.warn('⚠️ API returned error code:', data.code, data.message);
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

async function fetchLatestBioData(wardedUserId) {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
    
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
            return data.response;
        } else {
            console.log('API error:', data);
        }
    } catch (error) {
        console.error('Error fetching bio data:', error);
    }
    return null;
}

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
    const ageStr = String(age);
    
    if (ageStr.length === 4) {
        const ageGroup = ageStr.substring(0, 2);
        return `${ageGroup}대`;
    }
    
    const ageNum = parseInt(ageStr);
    if (!isNaN(ageNum)) {
        const ageGroup = Math.floor(ageNum / 10) * 10;
        return `${ageGroup}대`;
    }
    
    return ageStr + '세';
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

// 위치 정보 포맷팅 (이모지 포함)
function formatLocationWithDistance(lat, lng, locationName) {
    const distance = calculateDistance(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng, lat, lng);
    
    if (distance <= FACILITY_LOCATION.buffer) {
        // 기관 내에 있음
        return `<span class="location-emoji">🏥</span>기관 입소중`;
    } else {
        // 기관 밖에 있음
        const distanceText = distance < 1 ? 
            `${Math.round(distance * 1000)}m` : 
            `${distance.toFixed(1)}km`;
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
        locationNameEl.textContent = '기관 입소중';
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
        locationNameEl.textContent = '기관 입소중';
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

// 외출 리포트 분석 함수
function analyzeOutingReport(locationData) {
    if (!locationData || locationData.length === 0) {
        return { hasOuting: false, status: '데이터 없음', outings: [], totalDuration: 0 };
    }
    
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // 오늘 위치 데이터만 필터링하고 시간순 정렬
    const todayLocations = locationData.filter(loc => {
        const locDate = new Date(loc.registrationDateTime);
        return locDate >= todayStart;
    }).sort((a, b) => new Date(a.registrationDateTime) - new Date(b.registrationDateTime));
    
    console.log(`오늘 위치 데이터 ${todayLocations.length}개:`, todayLocations);
    
    if (todayLocations.length === 0) {
        return { hasOuting: false, status: '오늘 데이터 없음', outings: [], totalDuration: 0 };
    }
    
    const outings = [];
    let totalOutingMinutes = 0;
    let currentOutingStart = null;
    
    // 위치 데이터를 순회하며 외출 구간 분석
    for (let i = 0; i < todayLocations.length; i++) {
        const loc = todayLocations[i];
        const distance = calculateDistance(FACILITY_LOCATION.lat, FACILITY_LOCATION.lng, loc.latitude, loc.longitude);
        const isOutside = distance > FACILITY_LOCATION.buffer;
        
        if (isOutside) {
            // 외출 위치 발견
            if (!currentOutingStart) {
                // 새로운 외출 시작
                currentOutingStart = new Date(loc.registrationDateTime);
            }
            
            outings.push({
                latitude: loc.latitude,
                longitude: loc.longitude,
                time: loc.registrationDateTime,
                distance: distance
            });
        } else {
            // 기관 내부 위치 (복귀)
            if (currentOutingStart) {
                // 외출에서 복귀
                const returnTime = new Date(loc.registrationDateTime);
                const outingDuration = Math.round((returnTime - currentOutingStart) / (1000 * 60)); // 분 단위
                totalOutingMinutes += outingDuration;
                currentOutingStart = null;
            }
        }
    }
    
    // 현재도 외출 중인 경우 (마지막 위치가 외부)
    if (currentOutingStart) {
        const now = new Date();
        const currentOutingDuration = Math.round((now - currentOutingStart) / (1000 * 60)); // 분 단위
        totalOutingMinutes += currentOutingDuration;
    }
    
    const hasOuting = outings.length > 0;
    const status = hasOuting ? '오늘 외출 있음' : '오늘 외출 없음';
    
    return { hasOuting, status, outings, totalDuration: totalOutingMinutes };
}

// 오늘 날짜의 모든 위치 데이터 가져오기 함수
async function fetchTodayLocationData(wardedUserId) {
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'http://localhost:3001';
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
    
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

// 외출 리포트 모달 표시 함수
async function showOutingReport(userName, wardedUserId, locationData, outingReport) {
    const modal = document.getElementById('outing-report-modal');
    const residentNameEl = document.getElementById('report-resident-name');
    const reportDateEl = document.getElementById('report-date');
    const reportStatusEl = document.getElementById('report-status');
    const outingListEl = document.getElementById('outing-list');
    
    if (!modal) return;
    
    // 모달 표시
    modal.classList.remove('hidden');
    
    // 헤더 정보 설정
    residentNameEl.textContent = `${userName} 님`;
    const today = new Date();
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const weekday = weekdays[today.getDay()];
    reportDateEl.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${weekday}`;
    
    // 요약 정보 설정
    if (outingReport.hasOuting) {
        const durationText = outingReport.totalDuration > 0 ? 
            formatOutingDuration(outingReport.totalDuration) : '0분';
        reportStatusEl.textContent = `총 ${durationText}의 외출이 확인되었습니다.`;
        reportStatusEl.className = 'outing-status-yes';
    } else {
        reportStatusEl.textContent = '오늘 외출이 확인되지 않았습니다.';
        reportStatusEl.className = 'outing-status-no';
    }
    
    // 외출 목록 생성 (최근 시간부터 정렬)
    outingListEl.innerHTML = '';
    
    if (outingReport.outings.length > 0) {
        // 시간순으로 내림차순 정렬 (최근 시간이 먼저)
        const sortedOutings = [...outingReport.outings].sort((a, b) => 
            new Date(b.time) - new Date(a.time)
        );
        
        for (const outing of sortedOutings) {
            try {
                const locationInfo = await getLocationName(outing.latitude, outing.longitude);
                const outingItem = document.createElement('div');
                outingItem.className = 'outing-item';
                
                const time = new Date(outing.time);
                const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                
                const distanceText = outing.distance < 1 ? 
                    `${Math.round(outing.distance * 1000)}m` : 
                    `${outing.distance.toFixed(1)}km`;
                
                const locationText = locationInfo.building ? 
                    `${locationInfo.full} (${locationInfo.building})` : 
                    locationInfo.full;
                
                outingItem.innerHTML = `
                    <div class="outing-time-main">${timeStr}</div>
                    <div class="outing-location-sub">${locationText}</div>
                    <div class="outing-distance-sub">기관에서 ${distanceText}</div>
                `;
                
                // 클릭 시 지도 표시
                outingItem.onclick = () => {
                    showLocationMapWithTime(outing.latitude, outing.longitude, locationInfo, userName, timeStr);
                };
                
                outingListEl.appendChild(outingItem);
            } catch (error) {
                console.error('외출 위치 정보 가져오기 실패:', error);
            }
        }
    } else {
        outingListEl.innerHTML = '<div style="text-align: center; padding: 40px; color: #6B7280;">오늘 외출 기록이 없습니다.</div>';
    }
}

// 모달 닫기 이벤트
document.addEventListener('DOMContentLoaded', function() {
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
            outingReportModal.classList.add('hidden');
        });
        
        outingReportModal.addEventListener('click', (e) => {
            if (e.target === outingReportModal) {
                outingReportModal.classList.add('hidden');
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
  document.querySelector('[data-type="unconfirmed"] .sub-count').textContent = recordData.unconfirmed.length;
  document.querySelector('[data-type="confirmed"]   .sub-count').textContent = recordData.confirmed.length;
  document.querySelector('[data-type="resolved"]    .sub-count').textContent = recordData.resolved.length;
}
// === Helper to build detail HTML ===
function buildDetailHTML(rec, showButtons, showEditDone){
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
    <button class="detail-btn primary confirm-btn">확인</button>
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
          <button class="reply-submit">확인</button>
          <button class="reply-cancel">취소</button>
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

  // Keep ${buttonsHTML} where it was inserted before
  return `
    <div class="detail-top">
      <img src="${rec.img}" class="detail-profile">
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
  `;
}

function renderList(typeKey){
  const list = recordData[typeKey] || [];
  let html='';
  list.forEach((item, index)=>{
    html += `<div class="record-row" data-time="${item.time}" data-event-id="${item.eventId || ''}" data-warded-user-id="${item.wardedUserId || ''}" data-record-index="${index}">
      <input type="checkbox" class="rec-checkbox">
      <img src="${item.img}" class="rec-profile" alt="${item.name}">
      <div class="rec-main">
        <div class="rec-name-title">${item.name}  ${item.title}</div>
        <div class="rec-desc">${item.desc}</div>
      </div>
      <div class="rec-right">${item.right}</div>
    </div>`;
  });
  recordListBody.innerHTML = html;
  attachRecordRowListeners(); // rebind
}

// Sidebar menu interaction for record.html
if (sidebarMenuItems.length && recordListBody) {
  sidebarMenuItems.forEach(item=>{
    item.addEventListener('click',()=>{
      sidebarMenuItems.forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      const key=item.dataset.type;
      renderList(key);
      syncSidebarCounts();
    });
  });
  
  // Initialize with real data
  initializeRecordData();
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
      const activeType = document.querySelector('.sidebar-menu li.active').dataset.type;
      
      // Get record object using index for reliability
      const recObj = recordData[activeType][recordIndex];
      
      
      if (!recObj) {
        console.error('Record object not found');
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
        
        detailBody.innerHTML = buildDetailHTML(recObj, activeType === 'unconfirmed', activeType === 'confirmed');
        attachReplyHandlers();
        
        // 확인 버튼 클릭 이벤트 추가 (미확인 → 확인된 위험신호로 이동)
        const confirmBtn = detailBody.querySelector('.confirm-btn');
        if (confirmBtn && activeType === 'unconfirmed') {
          confirmBtn.onclick = () => {
            // 미확인 위험신호에서 항목 제거
            const unconfirmedIndex = recordData.unconfirmed.findIndex(r => 
              r.time === recObj.time && r.name === recObj.name && r.eventId === recObj.eventId
            );
            
            if (unconfirmedIndex !== -1) {
              // 미확인에서 제거
              const confirmedRecord = recordData.unconfirmed.splice(unconfirmedIndex, 1)[0];
              
              // 확인된 위험신호에 추가 (reply 정보 추가)
              confirmedRecord.reply = { 
                written: false, 
                author: '', 
                avatar: '', 
                content: '' 
              };
              recordData.confirmed.unshift(confirmedRecord);
              
              // 캐시에 처리 상태 저장
              saveProcessedEventToCache(confirmedRecord.eventId, 'confirmed', confirmedRecord);
              
              // 사이드바 카운트 업데이트
              syncSidebarCounts();
              
              // 미확인 목록 새로고침
              renderList('unconfirmed');
              
              // 디테일 패널 클리어
              document.querySelector('.detail-title').textContent = '';
              document.querySelector('.detail-body').innerHTML = '';
              document.querySelector('.detail-time').textContent = '';
              
              console.log('항목이 확인된 위험신호로 이동되었습니다:', confirmedRecord.name, confirmedRecord.title);
            }
          };
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
  if (bioData.steps && bioData.steps.length > 0) {
    const stepsVital = vitals.find(v => v.label === '걸음수');
    if (stepsVital) {
      stepsVital.value = bioData.steps[0].stepsDaily.toLocaleString();
      stepsVital.time = dateAgo(bioData.steps[0].step_date);
    }
  }
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
        detailBody.innerHTML = buildDetailHTML(recObj,false,false);
        attachReplyHandlers();
        // pre‑fill textarea with previous content
        const newTextarea = document.querySelector('.reply-text');
        if(newTextarea) newTextarea.value = recObj.reply.content;
      };
    }
    const completeBtn = document.querySelector('.reply-complete');
    if (completeBtn) {
      completeBtn.onclick = () => {
        const selRow = document.querySelector('.record-row.selected-row');
        if (!selRow) return;
        const time = selRow.dataset.time;
        const name = selRow.querySelector('.rec-main .rec-name-title').textContent.split(' ')[0];
        // remove from confirmed
        const idx = recordData.confirmed.findIndex(r => r.time === time && r.name === name);
        if (idx === -1) return;
        const recObj = recordData.confirmed.splice(idx, 1)[0];
        // add to resolved
        recordData.resolved.unshift(recObj);
        
        // 캐시에 처리 상태 저장
        saveProcessedEventToCache(recObj.eventId, 'resolved', recObj);
        
        syncSidebarCounts();
        // if viewing confirmed, refresh list and clear detail
        const activeType = document.querySelector('.sidebar-menu li.active')?.dataset.type;
        if (activeType === 'confirmed') {
          renderList('confirmed');
          document.querySelector('.detail-title').textContent = '';
          document.querySelector('.detail-body').innerHTML = '';
          document.querySelector('.detail-time').textContent = '';
        }
      };
    }
    return;
  }
  const textArea = editor.querySelector('.reply-text');
  editor.querySelector('.reply-submit').onclick = ()=>{
    if(!textArea.value.trim()) return alert('내용을 입력하세요');
    // Save text locally
    const selRow = document.querySelector('.record-row.selected-row');
    const type   = document.querySelector('.sidebar-menu li.active').dataset.type;
    const time   = selRow.dataset.time;
    const name   = selRow.querySelector('.rec-main .rec-name-title').textContent.split(' ')[0];
    const recObj = recordData[type].find(r=>r.time===time && r.name===name);
    recObj.reply = {
      written:true,
      author:'김석우',
      avatar:'assets/helper_kim.png',
      content:textArea.value
    };
    
    // Move data between categories based on current type
    if (type === 'unconfirmed') {
      // Move from unconfirmed to confirmed
      const idx = recordData.unconfirmed.findIndex(r => r.time === time && r.name === name);
      if (idx !== -1) {
        const removedRec = recordData.unconfirmed.splice(idx, 1)[0];
        recordData.confirmed.unshift(removedRec);
        
        // 캐시에 처리 상태 저장
        saveProcessedEventToCache(removedRec.eventId, 'confirmed', removedRec);
        
        syncSidebarCounts();
        // Refresh unconfirmed list and clear detail
        renderList('unconfirmed');
        document.querySelector('.detail-title').textContent = '';
        document.querySelector('.detail-body').innerHTML = '';
        document.querySelector('.detail-time').textContent = '';
      }
    } else if (type === 'confirmed') {
      // Move from confirmed to resolved
      const idx = recordData.confirmed.findIndex(r => r.time === time && r.name === name);
      if (idx !== -1) {
        const removedRec = recordData.confirmed.splice(idx, 1)[0];
        recordData.resolved.unshift(removedRec);
        
        // 캐시에 처리 상태 저장
        saveProcessedEventToCache(removedRec.eventId, 'resolved', removedRec);
        
        syncSidebarCounts();
        // Refresh confirmed list and clear detail
        renderList('confirmed');
        document.querySelector('.detail-title').textContent = '';
        document.querySelector('.detail-body').innerHTML = '';
        document.querySelector('.detail-time').textContent = '';
      }
    } else {
      // For resolved or other types, just re-render detail
      const detailBody = document.querySelector('.detail-body');
      const activeType = document.querySelector('.sidebar-menu li.active').dataset.type;
      detailBody.innerHTML = buildDetailHTML(recObj, activeType === 'unconfirmed', activeType === 'confirmed');
      attachReplyHandlers();
    }
  };
  editor.querySelector('.reply-cancel').onclick = ()=>{ textArea.value=''; };
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
        
        if (ENABLE_MOCK_DATA) {
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
                console.log('Filtered mappings:', data.response.filter(m => m.activeYn === 'o' || m.activeYn === 'y'));
                return data.response.filter(m => m.activeYn === 'o' || m.activeYn === 'y');
            } else {
                console.log('API returned error code:', data.code, data.message);
            }
        } catch (error) {
            console.error('Error fetching mappings:', error);
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

    // 나이를 연령대로 변환하는 함수
    function formatAge(age) {
        // age가 문자열일 수 있으므로 숫자로 변환
        const ageStr = String(age);
        
        // 4자리 형식 (예: 7079)인 경우
        if (ageStr.length === 4) {
            const ageGroup = ageStr.substring(0, 2);
            return `${ageGroup}대`;
        }
        
        // 2자리 또는 3자리 숫자인 경우
        const ageNum = parseInt(ageStr);
        if (!isNaN(ageNum)) {
            const ageGroup = Math.floor(ageNum / 10) * 10;
            return `${ageGroup}대`;
        }
        
        // 기본값
        return ageStr + '세';
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
        'USER_ACTIVITY_EXERCISE': {
            'ActivityType.STILL': 'statusRelax',
            'ActivityType.WALKING': 'statusWalk',
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
        // 해당 사용자의 모든 이벤트 찾기
        const userEvents = events.filter(e => e.wardedUserId === bioData.wardedUserId);
        
        if (userEvents.length > 0) {
            // 시간순으로 정렬 (최신순)
            userEvents.sort((a, b) => new Date(b.registrationDateTime || b.timestamp) - new Date(a.registrationDateTime || a.timestamp));
            
            console.log(`👤 ${bioData.wardedUserId}의 이벤트 ${userEvents.length}개:`, userEvents.map(e => ({
                eventId: e.eventId,
                eventType: e.eventType,
                time: e.registrationDateTime || e.timestamp
            })));
            
            // 각 이벤트를 시간순으로 확인하여 미처리된 가장 최근 이벤트 찾기
            for (const event of userEvents) {
                const cachedStatus = getProcessedEventFromCache(event.eventId);
                
                // 이벤트가 처리되지 않았으면 경고 상태 표시
                if (!cachedStatus || cachedStatus.category === 'unconfirmed') {
                    console.log(`⚠️ 미처리 이벤트 발견: ${event.eventId} (${event.eventType})`);
                    switch(event.eventType) {
                        case 'FALL_DETECTED': return { class: 'warning', text: '낙상' };
                        case 'HIGH_HEART_RATE_DETECTED': return { class: 'warning', text: '빈맥' };
                        case 'LOW_HEART_RATE_DETECTED': return { class: 'warning', text: '서맥' };
                    }
                } else {
                    console.log(`✅ 처리된 이벤트: ${event.eventId} (${cachedStatus.category})`);
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

    // 테이블 렌더링 함수
    async function renderResidentTable() {
        const tbody = document.querySelector('.resident-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">데이터 로딩 중...</td></tr>';

        try {
            // 1. 매핑 정보 가져오기
            const mappings = await fetchMappings();
            console.log('전체 매핑 정보:', mappings);
            
            if (mappings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">등록된 피보호자가 없습니다.</td></tr>';
                return;
            }

            // 2. 각 피보호자 정보 가져오기
            wardedUsers = [];
            for (const mapping of mappings) {
                console.log('개별 매핑 정보:', mapping);
                // 매핑 데이터에 이미 사용자 정보가 포함되어 있음
                wardedUsers.push({
                    wardedUserId: mapping.wardedUserId,
                    userName: mapping.userName,
                    age: mapping.age,
                    profileUrl: mapping.userProfileUrl,
                    gender: mapping.gender,
                    phoneNo: mapping.phoneNo,
                    room: mapping.room || '미지정' // API에 room 정보가 있다고 가정
                });
            }

            // 3. 이벤트 데이터 가져오기
            const events = await fetchEvents();

            // 4. 초기 테이블 렌더링
            tbody.innerHTML = '';
            wardedUsers.forEach((user, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${user.profileUrl || 'assets/status_01.png'}" alt="${user.userName} 프로필" class="profile-img"> ${user.userName}</td>
                    <td>${formatAge(user.age)}</td>
                    <td><span class="status-label daily">일상생활</span></td>
                    <!-- <td>${user.room}</td> -->
                    <td class="location">--</td>
                    <td class="outing-report">--</td>
                    <td class="heart-rate">--bpm</td>
                    <!-- <td class="spo2">--%</td> -->
                    <!-- <td class="sleep">--h</td> -->
                    <td class="steps">--</td>
                `;
                tbody.appendChild(tr);
            });

            // 5. 생체 데이터 업데이트 시작
            updateResidentVitals(events);
            
            // 초기 로드 시 마지막 새로고침 시간 설정
            lastRefreshTime = new Date();

        } catch (error) {
            console.error('Error rendering table:', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">데이터 로드 실패</td></tr>';
        }
    }

    // 실시간 생체 데이터 업데이트 함수
    async function updateResidentVitals(events = []) {
        const rows = document.querySelectorAll('.resident-table tbody tr');

        for (let i = 0; i < wardedUsers.length && i < rows.length; i++) {
            const user = wardedUsers[i];
            const row = rows[i];
            
            // 확장 상세행은 무시
            if (row.classList.contains('detail-row')) continue;

            try {
                const bioData = await fetchLatestBioData(user.wardedUserId);
                console.log(`Processing bio data for ${user.userName}:`, bioData);
                
                if (bioData) {
                    // 캐시 업데이트
                    bioDataCache[user.wardedUserId] = bioData;

                    // 생체 데이터 업데이트 - 실제 API 응답 구조에 맞게 수정
                    let heartRate = '--';
                    let spo2 = '--';
                    let steps = '--';
                    let heartRateTime = null;
                    let spo2Time = null;
                    let stepsDate = null;
                    let location = '--';
                    let locationTime = null;
                    let statusTime = null;
                    
                    // 위치 데이터 - location 배열의 첫 번째 값 (가장 최근)
                    let latestGpsData = null;
                    let locationInfo = null;
                    if (bioData.location && bioData.location.length > 0) {
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
                    
                    console.log(`Extracted values - HR: ${heartRate}, SpO2: ${spo2}, Steps: ${steps}`);
                    
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

                    // 테이블 셀 업데이트
                    const statusCell = row.children[2];
                    const locationCell = row.children[3];  // 호수 제거로 인덱스 변경
                    const outingReportCell = row.children[4];  // 외출 리포트 셀 추가
                    const heartRateCell = row.children[5];  // 인덱스 변경
                    // const spo2Cell = row.children[6];  // 주석처리
                    // const sleepCell = row.children[7];  // 주석처리
                    const stepsCell = row.children[6];  // 인덱스 변경
                    
                    // 상태 업데이트
                    const statusLabel = statusCell.querySelector('.status-label');
                    statusLabel.className = `status-label ${status.class}`;
                    statusLabel.textContent = status.text;
                    
                    // 위치 및 기타 데이터 업데이트
                    // dashboard-poc.html에서는 위치에 이모지와 거리 정보 표시
                    if (window.location.pathname.includes('dashboard-poc.html')) {
                        if (location !== '위치 정보 없음' && location !== '--' && latestGpsData && latestGpsData.length > 0) {
                            const gps = latestGpsData[0];
                            locationCell.innerHTML = formatLocationWithDistance(gps.latitude, gps.longitude, location);
                            locationCell.classList.add('location-cell');
                            
                            // 위치 클릭 이벤트 리스너 추가
                            locationCell.onclick = () => {
                                const userName = row.children[0].textContent.trim();
                                // 최신 위치 정보 사용
                                const latestGps = latestGpsData[0];
                                const latestTime = new Date(latestGps.registrationDateTime);
                                const timeStr = `${latestTime.getHours().toString().padStart(2, '0')}:${latestTime.getMinutes().toString().padStart(2, '0')}`;
                                showLocationMapWithTime(latestGps.latitude, latestGps.longitude, locationInfo, userName, timeStr);
                            };
                        } else {
                            locationCell.textContent = location;
                        }
                        
                        // 외출 리포트 분석 및 업데이트 (Period API 데이터 사용)
                        const todayLocationData = await fetchTodayLocationData(user.wardedUserId);
                        const outingReport = analyzeOutingReport(todayLocationData);
                        outingReportCell.innerHTML = `<span class="outing-report-cell ${outingReport.hasOuting ? 'outing-status-yes' : 'outing-status-no'}">${outingReport.status}</span>`;
                        outingReportCell.classList.add('outing-report-cell');
                        
                        // 외출 리포트 클릭 이벤트 (이미 가져온 데이터 재사용)
                        outingReportCell.onclick = async () => {
                            const userName = row.children[0].textContent.trim();
                            console.log(`🎯 외출 리포트 클릭: ${userName} (${user.wardedUserId})`);
                            console.log(`📍 사용할 오늘 위치 데이터: ${todayLocationData.length}개`);
                            console.log(`📊 외출 리포트 분석 결과:`, outingReport);
                            
                            showOutingReport(userName, user.wardedUserId, todayLocationData, outingReport);
                        };
                    } else {
                        locationCell.textContent = location;
                        outingReportCell.textContent = '--';
                    }
                    
                    heartRateCell.textContent = heartRate !== '--' ? `${heartRate}bpm` : '--bpm';
                    // spo2Cell.textContent = spo2 !== '--' ? `${spo2}%` : '--%';  // 주석처리
                    // sleepCell.textContent = sleepHours !== '--' ? sleepHours : '--h';  // 주석처리
                    stepsCell.textContent = steps !== '--' ? steps.toLocaleString() : '--';
                    
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

    // 초기 로드 시 테이블 렌더링
    renderResidentTable();

    // 주기적으로 데이터 업데이트
    setInterval(async () => {
        try {
            // 이벤트 데이터 다시 가져오기
            const events = await fetchEvents();
            
            // 생체 데이터 업데이트
            await updateResidentVitals(events);
            
            // 관리기록 페이지가 활성화되어 있으면 record data도 업데이트
            if (window.location.pathname.includes('record.html') || window.location.pathname.endsWith('record.html')) {
                await updateRecordDataIfNeeded();
            }
            
            // 마지막 새로고침 시간 업데이트
            lastRefreshTime = new Date();
            
            // 층별 거주 인원 업데이트 (데모용 유지)
            updateFloor1Occupancy();
        } catch (error) {
            console.error('Error in periodic update:', error);
        }
    }, UPDATE_INTERVAL); // 설정된 주기로 업데이트

    // 중복 함수 제거됨 - 상단의 async getLocationName 함수 사용

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
        // Prevent navigation if already on the page (optional, but good UX)
        // However, for simplicity now, we'll just navigate.
        // Consider adding: if (window.location.pathname.endsWith(pageToNavigate)) return;
        window.location.href = pageToNavigate;
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