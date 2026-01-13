/**
 * AI 리포트 JavaScript
 * - 개인별 1달간의 데이터를 수집하여 AI가 분석한 종합 리포트 생성
 */

// 전역 변수
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1-indexed
let residentsList = [];
let selectedResident = null;
let monthlyData = null;

// 데모 모드 확인
const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[AI-REPORT] 초기화...');

  // Settings 버튼 바인딩
  const settingsBtn = document.querySelector('.settings-btn');
  if (settingsBtn && typeof openResidentManagementModal === 'function') {
    settingsBtn.addEventListener('click', openResidentManagementModal);
  }

  // 사용자 이름 표시
  const userDisplayName = document.getElementById('user-display-name');
  if (userDisplayName) {
    userDisplayName.textContent = localStorage.getItem('watcherUserName') || 'silvercare2';
  }

  // 월 타이틀 업데이트
  updateMonthTitle();

  // 입소자 목록 로드
  await loadResidentsList();
});

// 월 타이틀 업데이트
function updateMonthTitle() {
  document.getElementById('month-title').textContent = `${currentYear}년 ${currentMonth}월`;
}

// 월 변경
function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear++;
  } else if (currentMonth < 1) {
    currentMonth = 12;
    currentYear--;
  }
  updateMonthTitle();

  // 입소자가 선택되어 있으면 데이터 다시 로드
  if (selectedResident) {
    loadMonthlyData();
  }
}

// 입소자 목록 로드
async function loadResidentsList() {
  const filterSelect = document.getElementById('filter-resident');
  if (!filterSelect) return;

  if (isDemoMode) {
    // 데모 모드: 목업 데이터
    residentsList = [
      { wardedUserId: 'demo001', userName: '김영수', room: '101호', age: 77, gender: 'male', profileEmoji: '👴', profileColor: '#DBEAFE' },
      { wardedUserId: 'demo002', userName: '박순자', room: '102호', age: 84, gender: 'female', profileEmoji: '👵', profileColor: '#FCE7F3' },
      { wardedUserId: 'demo003', userName: '이경숙', room: '103호', age: 79, gender: 'female', profileEmoji: '👵', profileColor: '#D1FAE5' },
      { wardedUserId: 'demo004', userName: '최영자', room: '104호', age: 82, gender: 'female', profileEmoji: '👵', profileColor: '#FEF3C7' },
      { wardedUserId: 'demo005', userName: '김정석', room: '105호', age: 78, gender: 'male', profileEmoji: '👴', profileColor: '#E5E7EB' }
    ];
  } else {
    try {
      const mappings = await fetchMappings();
      residentsList = mappings
        .filter(m => m.activeYn !== 'N')
        .map(m => ({
          wardedUserId: m.wardedUserId, // deviceId (API 호출용)
          originalWardedUserId: m.originalWardedUserId || m.wardedUserId, // 원래 wardedUserId (출퇴근 매칭용)
          userName: m.userName,
          room: m.room || '미지정',
          age: m.age || '-',
          gender: m.gender === 'M' || m.gender === 'male' ? 'male' : 'female',
          profileEmoji: m.profileEmoji || (m.gender === 'M' || m.gender === 'male' ? '👴' : '👵'),
          profileColor: m.profileColor || '#E5E7EB'
        }));
      console.log('[AI-REPORT] 입소자 목록:', residentsList.map(r => ({ name: r.userName, deviceId: r.wardedUserId, originalId: r.originalWardedUserId })));
    } catch (error) {
      console.error('[AI-REPORT] 입소자 목록 로드 실패:', error);
    }
  }

  // 필터 셀렉트 업데이트
  filterSelect.innerHTML = '<option value="">입소자 선택</option>';
  residentsList.forEach(r => {
    const option = document.createElement('option');
    option.value = r.wardedUserId;
    option.textContent = `${r.userName} (${r.room})`;
    filterSelect.appendChild(option);
  });
}

// 입소자 선택 변경
function onResidentChange() {
  const select = document.getElementById('filter-resident');
  const generateBtn = document.getElementById('generate-btn');
  const selectPrompt = document.getElementById('select-prompt');
  const reportContent = document.getElementById('report-content');

  if (select.value) {
    selectedResident = residentsList.find(r => r.wardedUserId === select.value);
    generateBtn.disabled = false;
    selectPrompt.style.display = 'none';
    reportContent.style.display = 'flex';
    reportContent.style.flexDirection = 'column';
    reportContent.style.gap = '16px';

    // 프로필 업데이트
    updateResidentProfile();

    // 데이터 로드 및 통계 카드 업데이트
    loadMonthlyData();
  } else {
    selectedResident = null;
    generateBtn.disabled = true;
    selectPrompt.style.display = 'block';
    reportContent.style.display = 'none';
  }
}

// 입소자 프로필 업데이트
function updateResidentProfile() {
  if (!selectedResident) return;

  document.getElementById('resident-avatar').style.background = selectedResident.profileColor;
  document.getElementById('resident-avatar').textContent = selectedResident.profileEmoji;
  document.getElementById('resident-name').textContent = selectedResident.userName;
  document.getElementById('resident-age').textContent = `${selectedResident.age}세`;
  document.getElementById('resident-room').textContent = selectedResident.room;
  document.getElementById('report-period').textContent = `${currentYear}년 ${currentMonth}월`;
}

// 월별 데이터 로드
async function loadMonthlyData() {
  if (!selectedResident) return;

  const fromDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const toDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${lastDay}`;

  console.log(`[AI-REPORT] 데이터 로드: ${selectedResident.userName}, ${fromDate} ~ ${toDate}`);
  console.log(`[AI-REPORT] wardedUserId: ${selectedResident.wardedUserId}`);

  // AI 리포트 초기화
  const aiReportText = document.getElementById('ai-report-text');
  aiReportText.innerHTML = '입소자를 선택하고 "AI 리포트 생성" 버튼을 클릭하세요.';
  aiReportText.classList.remove('loading');

  if (isDemoMode) {
    // 데모 모드: 목업 통계 데이터
    monthlyData = generateDemoMonthlyData();
    updateStatsCards(monthlyData);
  } else {
    try {
      // 병렬 API 호출
      const [heartBeatData, stepsData, attendanceData, locationData, eventData] = await Promise.all([
        fetchPeriodData(selectedResident.wardedUserId, fromDate, toDate, 'HEART_BEAT'),
        fetchPeriodData(selectedResident.wardedUserId, fromDate, toDate, 'STEPS'),
        fetchAttendanceReport(fromDate, toDate),
        fetchPeriodData(selectedResident.wardedUserId, fromDate, toDate, 'LOCATION'),
        fetchPeriodData(selectedResident.wardedUserId, fromDate, toDate, 'EVENT')
      ]);

      // 디버그: API 응답 구조 확인
      console.log('[AI-REPORT] 🔍 API 응답 디버그:');
      console.log('  - heartBeatData:', heartBeatData);
      console.log('  - stepsData:', stepsData);
      console.log('  - attendanceData:', attendanceData);
      console.log('  - locationData:', locationData);
      console.log('  - eventData:', eventData);

      const rawData = {
        heartBeat: heartBeatData,
        steps: stepsData,
        attendance: attendanceData,
        location: locationData,
        event: eventData
      };

      console.log('[AI-REPORT] 🔍 rawData 구조:');
      console.log('  - rawData.heartBeat:', rawData.heartBeat);
      console.log('  - rawData.heartBeat?.heartBeat:', rawData.heartBeat?.heartBeat);
      console.log('  - Array.isArray(rawData.heartBeat):', Array.isArray(rawData.heartBeat));
      console.log('  - rawData.steps:', rawData.steps);
      console.log('  - rawData.steps?.stepsDaily:', rawData.steps?.stepsDaily);

      monthlyData = await processMonthlyData(rawData);

      console.log('[AI-REPORT] 📊 처리된 monthlyData:', monthlyData);

      updateStatsCards(monthlyData);
    } catch (error) {
      console.error('[AI-REPORT] 데이터 로드 실패:', error);
      monthlyData = generateDemoMonthlyData();
      updateStatsCards(monthlyData);
    }
  }
}

// 기간별 데이터 조회 API
async function fetchPeriodData(wardedUserId, fromDate, toDate, bioDataType) {
  try {
    const url = `${window.API_CONFIG.BASE_URL}/watcher/period?wardedUserId=${wardedUserId}&fromDate=${fromDate}&toDate=${toDate}&bioDataTypes=${bioDataType}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.code === '1000' && data.response) {
      return data.response;
    }
    return null;
  } catch (error) {
    console.error(`[AI-REPORT] ${bioDataType} 데이터 조회 실패:`, error);
    return null;
  }
}

// 출퇴근 리포트 조회 API
async function fetchAttendanceReport(fromDate, toDate) {
  try {
    const watcherUserId = localStorage.getItem('watcherUserId') || window.API_CONFIG.WATCHER_USER_ID;
    const url = `${window.API_CONFIG.BASE_URL}/watcher/attendance/report?watcherUserId=${watcherUserId}&fromDate=${fromDate}&toDate=${toDate}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.code === '1000' && data.response) {
      return data.response;
    }
    return null;
  } catch (error) {
    console.error('[AI-REPORT] 출퇴근 데이터 조회 실패:', error);
    return null;
  }
}

// 월별 데이터 처리
async function processMonthlyData(rawData) {
  const result = {
    heartBeat: { avg: 0, min: 0, max: 0, highCount: 0, lowCount: 0, data: [] },
    steps: { total: 0, dailyAvg: 0, maxDay: null, minDay: null, data: [] },
    attendance: { presentDays: 0, totalDays: 0, rate: 0, avgDuration: 0, avgClockIn: null },
    outing: { count: 0, totalMinutes: 0, locations: [] },
    event: { fallCount: 0, highHrCount: 0, lowHrCount: 0 }
  };

  // 심박수 처리 - API 응답 구조: data.response = { heartBeat: [...] }
  // fetchPeriodData가 data.response를 반환하므로 rawData.heartBeat = { heartBeat: [...] }
  // 또는 rawData.heartBeat.heartBeat = [...]
  const heartBeatArray = rawData.heartBeat?.heartBeat || (Array.isArray(rawData.heartBeat) ? rawData.heartBeat : []);
  if (heartBeatArray.length > 0) {
    const hrValues = heartBeatArray.map(d => d.heartBeat).filter(v => v > 0);
    if (hrValues.length > 0) {
      result.heartBeat.avg = Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length);
      result.heartBeat.min = Math.min(...hrValues);
      result.heartBeat.max = Math.max(...hrValues);
      result.heartBeat.highCount = hrValues.filter(v => v > 120).length;
      result.heartBeat.lowCount = hrValues.filter(v => v < 40).length;
      result.heartBeat.data = heartBeatArray;
    }
  }

  // 걸음수 처리 - API 응답 구조: data.response = { steps: [...] }, 각 항목에 stepsDaily, step_date 필드
  const stepsArray = rawData.steps?.steps || (Array.isArray(rawData.steps) ? rawData.steps : []);
  console.log('[AI-REPORT] 🦶 걸음수 배열:', stepsArray.length, '개');
  if (stepsArray.length > 0) {
    // 일별 집계 - step_date 필드 사용, stepsDaily 값 사용
    const dailySteps = {};
    stepsArray.forEach(d => {
      const date = d.step_date || d.registrationDateTime?.split('T')[0];
      const stepValue = d.stepsDaily || d.steps || 0;
      if (date && stepValue > 0) {
        // 같은 날짜의 최대값 사용
        if (!dailySteps[date] || stepValue > dailySteps[date]) {
          dailySteps[date] = stepValue;
        }
      }
    });

    const dailyValues = Object.entries(dailySteps);
    console.log('[AI-REPORT] 🦶 일별 걸음수:', dailyValues);
    if (dailyValues.length > 0) {
      result.steps.total = dailyValues.reduce((sum, [, steps]) => sum + steps, 0);
      result.steps.dailyAvg = Math.round(result.steps.total / dailyValues.length);

      const sorted = dailyValues.sort((a, b) => b[1] - a[1]);
      result.steps.maxDay = { date: sorted[0][0], steps: sorted[0][1] };
      result.steps.minDay = { date: sorted[sorted.length - 1][0], steps: sorted[sorted.length - 1][1] };
    }
  }

  // 출퇴근 처리 - attendance API는 originalWardedUserId 사용
  if (rawData.attendance?.summaries) {
    // originalWardedUserId로 필터링 (attendance API는 원래 wardedUserId 사용)
    const targetId = selectedResident.originalWardedUserId || selectedResident.wardedUserId;
    console.log('[AI-REPORT] 📅 출퇴근: targetId =', targetId);

    const mySummaries = rawData.attendance.summaries.filter(
      s => s.wardedUserId === targetId
    );
    console.log('[AI-REPORT] 📅 출퇴근: 필터된 mySummaries =', mySummaries.length, '개');

    const presentDays = mySummaries.filter(s => s.clockInTime);
    result.attendance.presentDays = presentDays.length;
    result.attendance.totalDays = new Date(currentYear, currentMonth, 0).getDate();
    result.attendance.rate = result.attendance.totalDays > 0
      ? Math.round((result.attendance.presentDays / result.attendance.totalDays) * 100 * 10) / 10
      : 0;

    // 평균 체류시간
    const durations = mySummaries.filter(s => s.durationMinutes).map(s => s.durationMinutes);
    if (durations.length > 0) {
      result.attendance.avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }

    // 평균 출근시간
    const clockInTimes = presentDays
      .filter(s => s.clockInTime)
      .map(s => {
        const time = new Date(s.clockInTime);
        return time.getHours() * 60 + time.getMinutes();
      });
    if (clockInTimes.length > 0) {
      const avgMinutes = Math.round(clockInTimes.reduce((a, b) => a + b, 0) / clockInTimes.length);
      const hours = Math.floor(avgMinutes / 60);
      const mins = avgMinutes % 60;
      result.attendance.avgClockIn = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
  }

  // 외출 처리 (위치 데이터 기반) - API 응답 구조: data.response = { location: [...] }
  const locationArray = rawData.location?.location || (Array.isArray(rawData.location) ? rawData.location : []);
  console.log('[AI-REPORT] 📍 위치 배열:', locationArray.length, '개');
  if (locationArray.length > 0) {
    const outings = await processOutingFromLocation(locationArray);
    result.outing.count = outings.count;
    result.outing.totalMinutes = outings.totalMinutes;
    result.outing.locations = outings.locations;
  }

  // 이벤트 처리 - API 응답 구조: data.response = { event: [...] } 또는 배열
  const eventArray = rawData.event?.event || (Array.isArray(rawData.event) ? rawData.event : []);
  console.log('[AI-REPORT] 🚨 이벤트 배열:', eventArray.length, '개');
  if (eventArray.length > 0) {
    eventArray.forEach(e => {
      if (e.eventType === 'FALL_DETECTED') result.event.fallCount++;
      else if (e.eventType === 'HIGH_HEART_RATE_DETECTED') result.event.highHrCount++;
      else if (e.eventType === 'LOW_HEART_RATE_DETECTED') result.event.lowHrCount++;
    });
  }

  return result;
}

// 위치 데이터에서 외출 정보 추출 (outing-report.js 로직 적용)
async function processOutingFromLocation(locationData) {
  const config = window.API_CONFIG?.FACILITY || {};
  const outingThresholdKm = config.OUTING_THRESHOLD_KM || 0.05; // 50m
  const facilityLat = config.LATITUDE || 37.501610;
  const facilityLng = config.LONGITUDE || 127.148037;

  // excludedYn 필터링 및 시간순 정렬
  const sorted = [...locationData]
    .filter(loc => loc.excludedYn !== 'Y')
    .sort((a, b) => new Date(a.registrationDateTime) - new Date(b.registrationDateTime));

  if (sorted.length === 0) {
    return { count: 0, totalMinutes: 0, locations: [] };
  }

  const outings = [];
  let currentOuting = null;

  sorted.forEach(loc => {
    const distanceKm = calculateDistance(facilityLat, facilityLng, loc.latitude, loc.longitude);
    const distanceM = distanceKm * 1000;

    // 정확도 기반 필터링: 1000m 이내 외출은 정확도 40m 이하만 인정
    const accuracy = loc.accuracy || null;
    if (distanceM <= 1000 && distanceM > outingThresholdKm * 1000) {
      if (accuracy === null || accuracy > 40) {
        return; // 정확도가 없거나 40m 초과면 스킵
      }
    }

    const isOutside = distanceKm > outingThresholdKm;
    const locTime = new Date(loc.registrationDateTime);

    if (isOutside) {
      if (!currentOuting) {
        // 외출 시작
        currentOuting = {
          startTime: locTime,
          endTime: locTime,
          maxDistance: distanceM,
          lastLat: loc.latitude,
          lastLng: loc.longitude
        };
      } else {
        // 외출 진행 중
        currentOuting.endTime = locTime;
        if (distanceM > currentOuting.maxDistance) {
          currentOuting.maxDistance = distanceM;
          currentOuting.lastLat = loc.latitude;
          currentOuting.lastLng = loc.longitude;
        }
      }
    } else if (currentOuting) {
      // 외출 종료 (시설 안으로 복귀)
      const durationMin = Math.round((currentOuting.endTime - currentOuting.startTime) / 60000);
      if (durationMin >= 5) { // 5분 이상만 기록 (outing-report.js와 동일)
        outings.push({
          duration: durationMin,
          maxDistance: currentOuting.maxDistance,
          lat: currentOuting.lastLat,
          lng: currentOuting.lastLng
        });
      }
      currentOuting = null;
    }
  });

  // 마지막 외출이 아직 진행 중인 경우
  if (currentOuting) {
    const durationMin = Math.round((currentOuting.endTime - currentOuting.startTime) / 60000);
    if (durationMin >= 5) {
      outings.push({
        duration: durationMin,
        maxDistance: currentOuting.maxDistance,
        lat: currentOuting.lastLat,
        lng: currentOuting.lastLng
      });
    }
  }

  const totalMinutes = outings.reduce((sum, o) => sum + o.duration, 0);
  console.log(`[AI-REPORT] 🚗 외출 처리: ${outings.length}회, 총 ${totalMinutes}분`);

  // 주요 방문지 역지오코딩 (최대 3개)
  const locations = [];
  const uniqueLocations = outings.slice(0, 3); // 최대 3개 외출에 대해 주소 조회

  for (const outing of uniqueLocations) {
    try {
      // script.js의 getLocationName 함수 사용
      if (typeof getLocationName === 'function') {
        const locationInfo = await getLocationName(outing.lat, outing.lng);
        // full 주소에서 구/동 까지만 추출 (예: "서울 중구 남대문로5가")
        let address = locationInfo?.full || locationInfo?.simple;
        if (address && address !== '위치 정보 없음') {
          // 주소 간략화: "시/도 구/군 동/읍/면" 까지만 (번지 제외)
          const simplified = simplifyAddress(address);
          locations.push(simplified);
        }
      }
    } catch (err) {
      console.warn('[AI-REPORT] 역지오코딩 실패:', err);
    }
  }

  // 중복 제거
  const uniqueLocationNames = [...new Set(locations)];
  console.log(`[AI-REPORT] 🚗 주요 방문지:`, uniqueLocationNames);

  return {
    count: outings.length,
    totalMinutes: totalMinutes,
    locations: uniqueLocationNames
  };
}

// 주소 간략화 (시/도 구/군 동/읍/면 까지만)
function simplifyAddress(address) {
  if (!address) return '';

  // 도로명 주소인 경우: "서울 중구 남대문로5가 84-15" → "서울 중구 남대문로5가"
  // 지번 주소인 경우: "서울 중구 남대문동5가 831" → "서울 중구 남대문동5가"

  // 숫자+번지(-포함) 패턴 제거 (예: "84-15", "831", "123-4")
  let simplified = address.replace(/\s+\d+(-\d+)?$/, '');

  // 너무 길면 마지막 부분 제거
  const parts = simplified.split(' ');
  if (parts.length > 3) {
    simplified = parts.slice(0, 3).join(' ');
  }

  return simplified;
}

// 거리 계산 (Haversine) - 킬로미터 반환
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반지름 (킬로미터)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // 킬로미터 단위
}

// 데모용 월별 데이터 생성
function generateDemoMonthlyData() {
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const presentDays = Math.floor(daysInMonth * 0.85);

  return {
    heartBeat: {
      avg: 68 + Math.floor(Math.random() * 10),
      min: 52 + Math.floor(Math.random() * 8),
      max: 88 + Math.floor(Math.random() * 15),
      highCount: Math.floor(Math.random() * 3),
      lowCount: Math.floor(Math.random() * 2)
    },
    steps: {
      total: 80000 + Math.floor(Math.random() * 40000),
      dailyAvg: 2500 + Math.floor(Math.random() * 1500),
      maxDay: { date: `${currentMonth}/8`, steps: 4500 + Math.floor(Math.random() * 1500) },
      minDay: { date: `${currentMonth}/22`, steps: 800 + Math.floor(Math.random() * 600) }
    },
    attendance: {
      presentDays: presentDays,
      totalDays: daysInMonth,
      rate: Math.round((presentDays / daysInMonth) * 100 * 10) / 10,
      avgDuration: 400 + Math.floor(Math.random() * 100),
      avgClockIn: `09:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}`
    },
    outing: {
      count: 2 + Math.floor(Math.random() * 4),
      totalMinutes: 180 + Math.floor(Math.random() * 300),
      locations: ['병원', '편의점', '공원']
    },
    event: {
      fallCount: Math.floor(Math.random() * 2),
      highHrCount: Math.floor(Math.random() * 3),
      lowHrCount: Math.floor(Math.random() * 2)
    }
  };
}

// 통계 카드 업데이트
function updateStatsCards(data) {
  // 심박 지표 (고심박 제거됨)
  document.querySelector('.stats-card:nth-child(1) .stats-row:nth-child(1) .stats-value').textContent = `${data.heartBeat.avg} bpm`;
  document.querySelector('.stats-card:nth-child(1) .stats-row:nth-child(2) .stats-value').textContent = `${data.heartBeat.min}~${data.heartBeat.max} bpm`;
  document.querySelector('.stats-card:nth-child(1) .stats-row:nth-child(3) .stats-value').textContent = `${data.heartBeat.lowCount}회`;

  // 활동량
  document.querySelector('.stats-card:nth-child(2) .stats-row:nth-child(1) .stats-value').textContent = `${data.steps.total.toLocaleString()} 보`;
  document.querySelector('.stats-card:nth-child(2) .stats-row:nth-child(2) .stats-value').textContent = `${data.steps.dailyAvg.toLocaleString()} 보`;
  document.querySelector('.stats-card:nth-child(2) .stats-row:nth-child(3) .stats-value').textContent = data.steps.maxDay ? `${data.steps.maxDay.date} (${data.steps.maxDay.steps.toLocaleString()}보)` : '-';
  document.querySelector('.stats-card:nth-child(2) .stats-row:nth-child(4) .stats-value').textContent = data.steps.minDay ? `${data.steps.minDay.date} (${data.steps.minDay.steps.toLocaleString()}보)` : '-';

  // 출퇴근 현황
  document.querySelector('.stats-card:nth-child(3) .stats-row:nth-child(1) .stats-value').textContent = `${data.attendance.presentDays}일 / ${data.attendance.totalDays}일`;
  document.querySelector('.stats-card:nth-child(3) .stats-row:nth-child(2) .stats-value').textContent = `${data.attendance.rate}%`;
  const avgDurationHours = Math.floor(data.attendance.avgDuration / 60);
  const avgDurationMins = data.attendance.avgDuration % 60;
  document.querySelector('.stats-card:nth-child(3) .stats-row:nth-child(3) .stats-value').textContent = `${avgDurationHours}시간 ${avgDurationMins}분`;
  document.querySelector('.stats-card:nth-child(3) .stats-row:nth-child(4) .stats-value').textContent = data.attendance.avgClockIn || '-';

  // 외출 현황
  document.querySelector('.stats-card:nth-child(4) .stats-row:nth-child(1) .stats-value').textContent = `${data.outing.count}회`;
  const outingHours = Math.floor(data.outing.totalMinutes / 60);
  const outingMins = data.outing.totalMinutes % 60;
  document.querySelector('.stats-card:nth-child(4) .stats-row:nth-child(2) .stats-value').textContent = `${outingHours}시간 ${outingMins}분`;
  document.querySelector('.stats-card:nth-child(4) .stats-row:nth-child(3) .stats-value').textContent = data.outing.locations.length > 0 ? data.outing.locations.slice(0, 2).join(', ') : '-';
  // 최장 외출 시간 계산 (평균이 아닌 실제 최장 외출이 필요하지만, 현재 데이터 구조상 평균 사용)
  const avgOutingMinutes = data.outing.count > 0 ? Math.round(data.outing.totalMinutes / data.outing.count) : 0;
  const maxOutingHours = Math.floor(avgOutingMinutes / 60);
  const maxOutingMins = avgOutingMinutes % 60;
  const maxOutingText = data.outing.count > 0
    ? (maxOutingHours > 0 ? `${maxOutingHours}시간 ${maxOutingMins}분` : `${maxOutingMins}분`)
    : '-';
  document.querySelector('.stats-card:nth-child(4) .stats-row:nth-child(4) .stats-value').textContent = maxOutingText;

  // 이벤트 발생 (고심박 알림 제거됨)
  document.querySelector('.stats-card:nth-child(5) .stats-row:nth-child(1) .stats-value').textContent = `${data.event.fallCount}회`;
  document.querySelector('.stats-card:nth-child(5) .stats-row:nth-child(2) .stats-value').textContent = `${data.event.lowHrCount}회`;

  // 리포트 기간 업데이트
  document.getElementById('report-period').textContent = `${currentYear}년 ${currentMonth}월`;
}

// AI 리포트 생성 (백엔드 프록시 사용)
async function generateReport() {
  if (!selectedResident || !monthlyData) {
    alert('입소자를 선택해주세요.');
    return;
  }

  const aiReportText = document.getElementById('ai-report-text');
  const generateBtn = document.getElementById('generate-btn');

  // 로딩 상태
  aiReportText.innerHTML = '<span class="loading-spinner"></span> AI가 리포트를 생성하고 있습니다...';
  aiReportText.classList.add('loading');
  generateBtn.disabled = true;

  try {
    const d = monthlyData;
    const r = selectedResident;

    // 추가 컨텍스트 생성 (상세 프롬프트용)
    const additionalContext = `## 기본 정보
- 이름: ${r.userName}
- 나이: ${r.age}세
- 호실: ${r.room}

## 건강 지표
### 심박수 (1달 통계)
- 평균: ${d.heartBeat.avg}bpm
- 범위: ${d.heartBeat.min}~${d.heartBeat.max}bpm
- 저심박 발생 (40bpm 미만): ${d.heartBeat.lowCount}회

### 이벤트 발생
- 낙상 감지: ${d.event.fallCount}회
- 저심박 알림: ${d.event.lowHrCount}회

## 생활 패턴
### 활동량
- 총 걸음수: ${d.steps.total.toLocaleString()}보
- 일평균 걸음수: ${d.steps.dailyAvg.toLocaleString()}보
- 최다 걸음일: ${d.steps.maxDay?.date || '-'} (${d.steps.maxDay?.steps?.toLocaleString() || 0}보)
- 최소 걸음일: ${d.steps.minDay?.date || '-'} (${d.steps.minDay?.steps?.toLocaleString() || 0}보)

### 출퇴근 현황
- 출근일: ${d.attendance.presentDays}일 / ${d.attendance.totalDays}일
- 출근율: ${d.attendance.rate}%
- 평균 체류시간: ${Math.floor(d.attendance.avgDuration / 60)}시간 ${d.attendance.avgDuration % 60}분
- 평균 출근시간: ${d.attendance.avgClockIn || '-'}

### 외출 현황 (주의 필요 지표)
- 총 외출 횟수: ${d.outing.count}회
- 총 외출 시간: ${Math.floor(d.outing.totalMinutes / 60)}시간 ${d.outing.totalMinutes % 60}분
- 주요 방문지: ${d.outing.locations.length > 0 ? d.outing.locations.join(', ') : '기록 없음'}`;

    // 백엔드 프록시 API 호출
    const BASE_URL = window.API_CONFIG?.BASE_URL || '';
    const response = await fetch(`${BASE_URL}/watcher/ai/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        residentName: r.userName,
        residentAge: r.age,
        reportMonth: `${currentYear}년 ${currentMonth}월`,
        outingData: null,
        vitalStats: {
          avgHeartRate: d.heartBeat.avg,
          minHeartRate: d.heartBeat.min,
          maxHeartRate: d.heartBeat.max,
          avgOxygen: null,
          avgSteps: d.steps.dailyAvg,
          sleepQuality: null
        },
        additionalContext: additionalContext
      })
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const result = await response.json();

    if (result.code === '1000' && result.response?.report) {
      // 리포트 표시 (마크다운 간단 변환)
      aiReportText.innerHTML = formatReportText(result.response.report);
    } else {
      aiReportText.innerHTML = result.message || '리포트 생성에 실패했습니다.';
    }
    aiReportText.classList.remove('loading');

  } catch (error) {
    console.error('[AI-REPORT] 리포트 생성 실패:', error);
    aiReportText.innerHTML = `리포트 생성 중 오류가 발생했습니다: ${error.message}`;
    aiReportText.classList.remove('loading');
  } finally {
    generateBtn.disabled = false;
  }
}

// 리포트 프롬프트 생성
function buildReportPrompt() {
  const d = monthlyData;
  const r = selectedResident;

  return `당신은 노인요양시설의 건강관리 전문가입니다.
다음은 ${r.userName}님(${r.age}세)의 ${currentYear}년 ${currentMonth}월 한 달간 데이터입니다.

## 기본 정보
- 이름: ${r.userName}
- 나이: ${r.age}세
- 호실: ${r.room}

## 건강 지표
### 심박수 (1달 통계)
- 평균: ${d.heartBeat.avg}bpm
- 범위: ${d.heartBeat.min}~${d.heartBeat.max}bpm
- 저심박 발생 (40bpm 미만): ${d.heartBeat.lowCount}회

### 이벤트 발생
- 낙상 감지: ${d.event.fallCount}회
- 저심박 알림: ${d.event.lowHrCount}회

## 생활 패턴
### 활동량
- 총 걸음수: ${d.steps.total.toLocaleString()}보
- 일평균 걸음수: ${d.steps.dailyAvg.toLocaleString()}보
- 최다 걸음일: ${d.steps.maxDay?.date || '-'} (${d.steps.maxDay?.steps?.toLocaleString() || 0}보)
- 최소 걸음일: ${d.steps.minDay?.date || '-'} (${d.steps.minDay?.steps?.toLocaleString() || 0}보)

### 출퇴근 현황
- 출근일: ${d.attendance.presentDays}일 / ${d.attendance.totalDays}일
- 출근율: ${d.attendance.rate}%
- 평균 체류시간: ${Math.floor(d.attendance.avgDuration / 60)}시간 ${d.attendance.avgDuration % 60}분
- 평균 출근시간: ${d.attendance.avgClockIn || '-'}

### 외출 현황 (주의 필요 지표)
- 총 외출 횟수: ${d.outing.count}회
- 총 외출 시간: ${Math.floor(d.outing.totalMinutes / 60)}시간 ${d.outing.totalMinutes % 60}분
- 주요 방문지: ${d.outing.locations.length > 0 ? d.outing.locations.join(', ') : '기록 없음'}
※ 외출은 무단이탈/배회 위험이 있어 주의가 필요한 지표입니다. 외출 횟수가 많거나 외출 시간이 길면 관리자 확인이 필요합니다.

위 데이터를 바탕으로 다음 항목을 포함한 종합 리포트를 작성해주세요:
1. 📋 종합 평가 (2-3문장)
2. ❤️ 건강 지표 분석 (심박수, 이벤트 발생 관련)
3. 🚶 생활 패턴 분석 (활동량, 출퇴근, 외출 관련)
4. 💡 케어 권장사항 (3가지)
5. 🔍 다음 달 관찰 포인트

한국어로 작성하고, 의료 전문용어보다 이해하기 쉬운 표현을 사용해주세요.
각 섹션 제목은 위의 이모지와 함께 **굵게** 표시해주세요.
최상단에 별도의 제목(# 또는 ##)은 넣지 말고, 바로 1번 항목부터 시작해주세요.`;
}

// 리포트 텍스트 포맷팅
function formatReportText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/• /g, '&bull; ');
}

// 페이지 이동
function navigateTo(page) {
  const urlParams = new URLSearchParams(window.location.search);
  const isDemoMode = urlParams.get('demo') === 'true';
  window.location.href = isDemoMode ? page + '?demo=true' : page;
}

// 로그아웃
function logout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('watcherUserId');
  window.location.href = 'index.html';
}
