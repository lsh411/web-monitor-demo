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
const logoEl = document.querySelector('.hello-logo');
const alertSectionEl = document.querySelector('.alert-section');
const residentTbody = document.querySelector('.resident-table tbody');

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
    // 김영수의 심박수(5번째 열, index 4)를 140bpm으로 변경
    if (rows[0]) rows[0].children[4].textContent = '140bpm';
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
    // 김영수의 심박수(5번째 열, index 4)를 68bpm으로 복원
    if (rows[0]) rows[0].children[4].textContent = '68bpm';
    if (statusSpan1) {
      statusSpan1.classList.remove('warning');
      statusSpan1.classList.add('exercise');
      statusSpan1.textContent = '운동';
    }
  }
});

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
    const floorSelectorBtn = document.getElementById('floor-selector-btn');
    const floorOptions = document.getElementById('floor-options');
    const selectedFloorSpan = document.getElementById('selected-floor');
    const floorPlans = document.querySelectorAll('.floor-plan');

    // Toggle dropdown visibility
    floorSelectorBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent click from immediately closing dropdown
        floorOptions.classList.toggle('hidden');
    });

    // Handle floor selection
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

    // Simulate live updates to bio data every second
    function updateResidentVitals() {
        const rows = document.querySelectorAll('.resident-table tbody tr');

        rows.forEach(row => {
            // 확장 상세행(tr.detail-row)은 무시
            if (row.classList.contains('detail-row')) return;

            const heartRateCell = row.children[4];
            const spo2Cell = row.children[5];
            const stepsCell = row.children[7];

            // Extract current values
            let heartRate = parseInt(heartRateCell.textContent.replace('bpm', '').trim());
            let spo2 = parseInt(spo2Cell.textContent.replace('%', '').trim());
            let steps = parseInt(stepsCell.textContent.replace(/,/g, '').trim());

            // Randomly change by ±10%
            heartRate = Math.round(heartRate * (1 + (Math.random() * 0.2 - 0.1)));
            spo2 = Math.round(spo2 * (1 + (Math.random() * 0.2 - 0.1)));
            steps = Math.round(steps * (1 + (Math.random() * 0.2 - 0.1)));

            // Clamp values
            heartRate = Math.max(40, Math.min(heartRate, 180));
            spo2 = Math.max(85, Math.min(spo2, 100));

            // Update text
            heartRateCell.textContent = `${heartRate}bpm`;
            spo2Cell.textContent = `${spo2}%`;
            stepsCell.textContent = steps.toLocaleString();
        });
    }

    // ----- Floor 1 occupancy cycling -----
    const floor1OccupancyCases = [
        { '102': 3, '104': 2, '101': 3, '103': 3, '105': 1, '106': 1 }, // Case 1
        { '102': 2, '화장실': 1, '105': 0, '106': 1 },               // Case 2
        { '101': 4, '103': 2, '응접실': 1, '104': 2 }                    // Case 3
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

    setInterval(() => {
        updateResidentVitals();
        updateFloor1Occupancy();
    }, 1000);

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
    let currentCard = wrapper.querySelector('.card-nutrition');
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
});
