/**
 * 출퇴근 리포트 JavaScript
 * - 캘린더 뷰로 입소자들의 출퇴근 현황을 표시
 * - 출근: 착용 + 기관 내 위치
 * - 퇴근: 미착용 + 충전중 + 기관 내 위치
 */

// 전역 변수
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let attendanceData = { summaries: [], statistics: {} };
let filteredResident = '';
let residentsList = [];

// 데모 모드 확인
const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('출퇴근 리포트 초기화...');

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

  // 입소자 목록 로드
  await loadResidentsList();

  // 출퇴근 데이터 로드
  await loadAttendanceData();

  // 캘린더 렌더링
  renderCalendar();
});

// 입소자 목록 로드 (활성화된 입소자만)
async function loadResidentsList() {
  const filterSelect = document.getElementById('filter-resident');
  if (!filterSelect) return;

  if (isDemoMode) {
    // 데모 모드: 목업 입소자 데이터 (활성화된 입소자만)
    residentsList = [
      { wardedUserId: 'demo001', userName: '김영수', room: '101호', isActive: true },
      { wardedUserId: 'demo002', userName: '박순자', room: '102호', isActive: true },
      { wardedUserId: 'demo003', userName: '이경숙', room: '103호', isActive: true },
      { wardedUserId: 'demo004', userName: '최영자', room: '104호', isActive: true },
      { wardedUserId: 'demo005', userName: '김정석', room: '105호', isActive: true },
    ];
  } else {
    // 실제 API 호출 - fetchMappings() 사용 (외출리포트와 동일)
    try {
      const mappings = await fetchMappings();
      residentsList = mappings
        .filter(m => m.activeYn !== 'N')
        .map(m => ({
          wardedUserId: m.wardedUserId,
          userName: m.userName,
          room: m.room || '미지정',
          isActive: true
        }));
    } catch (error) {
      console.error('입소자 목록 로드 실패:', error);
    }
  }

  // 필터 셀렉트 업데이트
  filterSelect.innerHTML = '<option value="">전체 입소자</option>';
  residentsList.forEach(r => {
    const option = document.createElement('option');
    option.value = r.wardedUserId;
    option.textContent = `${r.userName} (${r.room})`;
    filterSelect.appendChild(option);
  });
}

// 출퇴근 데이터 로드
async function loadAttendanceData() {
  const fromDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const toDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${lastDay}`;

  if (isDemoMode) {
    // 데모 모드: 목업 데이터 생성
    attendanceData = generateDemoAttendanceData(fromDate, toDate);
  } else {
    // 실제 API 호출
    try {
      const watcherUserId = localStorage.getItem('watcherUserId') || window.API_CONFIG.WATCHER_USER_ID;
      const response = await fetch(
        `${window.API_CONFIG.BASE_URL}/watcher/attendance/report?watcherUserId=${watcherUserId}&fromDate=${fromDate}&toDate=${toDate}`
      );
      const data = await response.json();
      console.log('📋 출퇴근 API 응답:', data);
      if (data.code === '1000' && data.response) {
        attendanceData = data.response;
        console.log('📋 출퇴근 summaries:', attendanceData.summaries?.filter(s => s.clockInTime || s.clockOutTime));
      }
    } catch (error) {
      console.error('출퇴근 데이터 로드 실패:', error);
      attendanceData = { summaries: [], statistics: {} };
    }
  }

  // 요약 카드 업데이트
  updateSummaryCards();
}

// 데모용 출퇴근 데이터 생성 (출근한 사람만 기록)
function generateDemoAttendanceData(fromDate, toDate) {
  const summaries = [];
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  // 각 입소자별로 출근 데이터만 생성
  residentsList.forEach(resident => {
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      // 주말은 대부분 미출근
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPresent = isWeekend ? Math.random() > 0.8 : Math.random() > 0.15;

      // 출근한 경우에만 기록 추가
      if (isPresent) {
        // 출근 시간: 8:30 ~ 9:30
        const clockInHour = 8 + Math.floor(Math.random() * 2);
        const clockInMin = Math.floor(Math.random() * 60);

        // 퇴근 시간: 16:00 ~ 18:00
        const clockOutHour = 16 + Math.floor(Math.random() * 3);
        const clockOutMin = Math.floor(Math.random() * 60);

        const clockInTime = `${dateStr}T${String(clockInHour).padStart(2, '0')}:${String(clockInMin).padStart(2, '0')}:00`;
        const clockOutTime = `${dateStr}T${String(clockOutHour).padStart(2, '0')}:${String(clockOutMin).padStart(2, '0')}:00`;

        const durationMinutes = (clockOutHour - clockInHour) * 60 + (clockOutMin - clockInMin);

        summaries.push({
          date: dateStr,
          wardedUserId: resident.wardedUserId,
          residentName: resident.userName,
          clockInTime: clockInTime,
          clockOutTime: clockOutTime,
          durationMinutes: durationMinutes,
          events: []
        });
      }
      // 미출근인 경우 기록 추가하지 않음

      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  // 통계 계산
  const presentCount = summaries.length;
  const durationsWithData = summaries.filter(s => s.durationMinutes).map(s => s.durationMinutes);
  const avgDuration = durationsWithData.length > 0
    ? Math.round(durationsWithData.reduce((a, b) => a + b, 0) / durationsWithData.length)
    : 0;

  // 전체 일수 계산
  const totalDaysInMonth = new Date(toDate).getDate();
  const totalPossibleRecords = totalDaysInMonth * residentsList.length;

  return {
    fromDate,
    toDate,
    summaries,
    statistics: {
      totalDays: totalDaysInMonth,
      presentDays: presentCount,
      absentDays: totalPossibleRecords - presentCount,
      averageDurationMinutes: avgDuration,
      attendanceRate: totalPossibleRecords > 0 ? (presentCount / totalPossibleRecords * 100) : 0
    }
  };
}

// 요약 카드 업데이트
function updateSummaryCards() {
  const stats = attendanceData.statistics || {};
  const summaries = attendanceData.summaries || [];

  // 전체 입소자 수
  document.getElementById('total-residents').textContent = residentsList.length + '명';

  // 출근일 (출근 기록이 있는 날만)
  const presentDays = summaries.filter(s => s.clockInTime).length;
  document.getElementById('present-days').textContent = presentDays + '일';

  // 출근율
  const totalRecords = summaries.length;
  const rate = totalRecords > 0 ? (presentDays / totalRecords * 100).toFixed(1) : 0;
  document.getElementById('present-rate').textContent = `출근율 ${rate}%`;

  // 평균 체류시간
  const durationsWithData = summaries.filter(s => s.durationMinutes).map(s => s.durationMinutes);
  if (durationsWithData.length > 0) {
    const avgMin = Math.round(durationsWithData.reduce((a, b) => a + b, 0) / durationsWithData.length);
    const hours = Math.floor(avgMin / 60);
    const mins = avgMin % 60;
    document.getElementById('avg-duration').textContent = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  } else {
    document.getElementById('avg-duration').textContent = '-';
  }

  // 이번 달 기록 (출퇴근 이벤트 수)
  const eventsCount = summaries.filter(s => s.clockInTime || s.clockOutTime).length;
  document.getElementById('total-records').textContent = eventsCount + '건';
}

// 캘린더 렌더링
function renderCalendar() {
  const calendarGrid = document.getElementById('calendar-grid');
  if (!calendarGrid) return;

  // 월 제목 업데이트
  document.getElementById('month-title').textContent = `${currentYear}년 ${currentMonth + 1}월`;

  // 그리드 초기화
  calendarGrid.innerHTML = '';

  // 요일 헤더
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  weekdays.forEach((day, index) => {
    const weekdayEl = document.createElement('div');
    weekdayEl.className = 'calendar-weekday';
    if (index === 0) weekdayEl.classList.add('sunday');
    if (index === 6) weekdayEl.classList.add('saturday');
    weekdayEl.textContent = day;
    calendarGrid.appendChild(weekdayEl);
  });

  // 이번 달 첫째 날과 마지막 날
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  const lastDate = lastDay.getDate();

  // 이전 달 날짜
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayEl = createDayElement(prevMonthLastDay - i, true);
    calendarGrid.appendChild(dayEl);
  }

  // 이번 달 날짜
  const today = new Date();
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;

    const dayEl = createDayElement(day, false, dateStr, dayOfWeek, isToday);
    calendarGrid.appendChild(dayEl);
  }

  // 다음 달 날짜
  const totalCells = calendarGrid.children.length;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    const dayEl = createDayElement(i, true);
    calendarGrid.appendChild(dayEl);
  }
}

// 날짜 셀 생성
function createDayElement(day, isOtherMonth, dateStr = '', dayOfWeek = 0, isToday = false) {
  const dayEl = document.createElement('div');
  dayEl.className = 'calendar-day';

  if (isOtherMonth) {
    dayEl.classList.add('other-month');
  }
  if (isToday) {
    dayEl.classList.add('today');
  }
  if (dayOfWeek === 0) {
    dayEl.classList.add('sunday');
  } else if (dayOfWeek === 6) {
    dayEl.classList.add('saturday');
  }

  // 날짜 숫자
  const dayNumber = document.createElement('div');
  dayNumber.className = 'day-number';
  dayNumber.textContent = day;
  dayEl.appendChild(dayNumber);

  // 해당 날짜의 출퇴근 데이터
  if (!isOtherMonth && dateStr) {
    const dayAttendance = getDayAttendance(dateStr);

    // 출근 또는 퇴근 기록이 있는 사람만 필터링
    const validAttendance = dayAttendance.filter(a => a.clockInTime || a.clockOutTime);

    if (validAttendance.length > 0) {
      const dayEvents = document.createElement('div');
      dayEvents.className = 'day-events';

      // 최대 3명까지만 표시
      validAttendance.slice(0, 3).forEach(att => {
        const item = document.createElement('div');
        // 출근만: clock-in (초록), 퇴근만: clock-out (파란), 출퇴근 모두: clock-out (파란)
        if (att.clockOutTime) {
          item.className = 'day-attendance-item clock-out';
        } else {
          item.className = 'day-attendance-item clock-in';
        }

        const name = document.createElement('span');
        name.className = 'day-attendance-name';
        name.textContent = att.residentName;
        item.appendChild(name);

        const time = document.createElement('span');
        time.className = 'day-attendance-time';
        // 출퇴근 시간 표시: 09:00->18:10 형식
        const inTimeStr = att.clockInTime
          ? `${new Date(att.clockInTime).getHours()}:${String(new Date(att.clockInTime).getMinutes()).padStart(2, '0')}`
          : '';
        const outTimeStr = att.clockOutTime
          ? `${new Date(att.clockOutTime).getHours()}:${String(new Date(att.clockOutTime).getMinutes()).padStart(2, '0')}`
          : '';

        if (att.clockInTime && att.clockOutTime) {
          // 출퇴근 모두: 09:00->18:10
          time.textContent = `${inTimeStr}->${outTimeStr}`;
        } else if (att.clockInTime) {
          // 출근만: 09:00->
          time.textContent = `${inTimeStr}->`;
        } else if (att.clockOutTime) {
          // 퇴근만: ->18:10
          time.textContent = `->${outTimeStr}`;
        }
        item.appendChild(time);

        dayEvents.appendChild(item);
      });

      // 더 있으면 표시
      if (validAttendance.length > 3) {
        const more = document.createElement('div');
        more.className = 'day-attendance-item clock-in';
        more.style.justifyContent = 'center';
        more.style.fontSize = '9px';
        more.style.color = '#6B7280';
        more.textContent = `+${validAttendance.length - 3}명`;
        dayEvents.appendChild(more);
      }

      dayEl.appendChild(dayEvents);

      // 클릭 이벤트
      dayEl.onclick = () => showDayDetail(dateStr, dayAttendance);
    }
  }

  return dayEl;
}

// 특정 날짜의 출퇴근 데이터 가져오기
function getDayAttendance(dateStr) {
  let data = attendanceData.summaries || [];

  // 필터 적용
  if (filteredResident) {
    data = data.filter(s => s.wardedUserId === filteredResident);
  }

  return data.filter(s => s.date === dateStr);
}

// 날짜 상세 모달 표시 (출근 또는 퇴근 기록이 있는 사람)
function showDayDetail(dateStr, attendance) {
  const modal = document.getElementById('day-detail-modal');
  const detailTitle = document.getElementById('detail-title');
  const detailList = document.getElementById('detail-list');

  if (!modal || !detailTitle || !detailList) return;

  // 출근 또는 퇴근 기록이 있는 사람 필터링
  const validAttendance = attendance.filter(a => a.clockInTime || a.clockOutTime);

  // 제목 설정
  const date = new Date(dateStr);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  detailTitle.textContent = `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]}) 출퇴근 현황 (${validAttendance.length}명)`;

  // 목록 생성
  detailList.innerHTML = '';

  if (validAttendance.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.padding = '20px';
    emptyMsg.style.color = '#6B7280';
    emptyMsg.textContent = '출퇴근 기록이 없습니다.';
    detailList.appendChild(emptyMsg);
  } else {
    validAttendance.forEach(att => {
      const item = document.createElement('div');
      // 출근만: clock-in (초록), 퇴근만/출퇴근 모두: clock-out (파란)
      if (att.clockOutTime) {
        item.className = 'day-detail-item clock-out';
      } else {
        item.className = 'day-detail-item clock-in';
      }

      const profile = document.createElement('div');
      profile.className = 'detail-profile';
      profile.textContent = att.residentName ? att.residentName.charAt(0) : '?';
      item.appendChild(profile);

      const info = document.createElement('div');
      info.className = 'detail-info';

      const name = document.createElement('div');
      name.className = 'detail-name';
      name.textContent = att.residentName || '알 수 없음';
      info.appendChild(name);

      const times = document.createElement('div');
      times.className = 'detail-times';
      let timeText = '';

      if (att.clockInTime) {
        const inTime = new Date(att.clockInTime);
        timeText = `출근 ${inTime.getHours()}:${String(inTime.getMinutes()).padStart(2, '0')}`;
      }

      if (att.clockOutTime) {
        const outTime = new Date(att.clockOutTime);
        if (timeText) {
          timeText += ` → 퇴근 ${outTime.getHours()}:${String(outTime.getMinutes()).padStart(2, '0')}`;
        } else {
          timeText = `퇴근 ${outTime.getHours()}:${String(outTime.getMinutes()).padStart(2, '0')}`;
        }
      }
      times.textContent = timeText;
      info.appendChild(times);

      if (att.durationMinutes) {
        const duration = document.createElement('div');
        duration.className = 'detail-duration';
        const hours = Math.floor(att.durationMinutes / 60);
        const mins = att.durationMinutes % 60;
        duration.textContent = hours > 0 ? `체류시간: ${hours}시간 ${mins}분` : `체류시간: ${mins}분`;
        info.appendChild(duration);
      }

      item.appendChild(info);

      const status = document.createElement('div');
      // 퇴근 기록이 있으면 "퇴근" (파란색), 출근만 있으면 "출근" (초록색)
      if (att.clockOutTime) {
        status.className = 'detail-status clock-out';
        status.textContent = '퇴근';
      } else {
        status.className = 'detail-status present';
        status.textContent = '출근';
      }
      item.appendChild(status);

      detailList.appendChild(item);
    });
  }

  modal.classList.add('active');
}

// 상세 모달 닫기
function closeDayDetail() {
  const modal = document.getElementById('day-detail-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// 월 변경
function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }

  loadAttendanceData().then(() => {
    renderCalendar();
  });
}

// 입소자 필터
function filterByResident() {
  const select = document.getElementById('filter-resident');
  filteredResident = select ? select.value : '';
  renderCalendar();
  updateSummaryCards();
}

// 인쇄
function printReport() {
  window.print();
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  const modal = document.getElementById('day-detail-modal');
  if (modal && modal.classList.contains('active') && e.target === modal) {
    closeDayDetail();
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDayDetail();
  }
});

// 페이지 네비게이션
function navigateTo(page) {
  const urlParams = new URLSearchParams(window.location.search);
  const isDemoMode = urlParams.get('demo') === 'true';

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

// 로그아웃
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}
