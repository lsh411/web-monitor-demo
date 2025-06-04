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
  refreshBtn.addEventListener('click',()=>{
    const active=document.querySelector('.sidebar-menu li.active');
    const key=active?active.dataset.type:'unconfirmed';
    renderList(key);
    selectAllCb.checked=false;
  });
}
// === Record.html dynamic list logic ===
const sidebarMenuItems = document.querySelectorAll('.sidebar-menu li');

// Record data for each type (now with detail object for each)
const recordData = {
  unconfirmed: [
    {
      time:'10:10',
      img:'assets/status_01.png',
      name:'김순자',
      title:'심박수가 147bpm 이상 입니다.',
      desc:'심박수가 일상생활 상태에서 120BPM 이상으로…',
      right:'방금',
      detail:{
        msg:'심박수가 일상생활 상태에서 120BPM 이상으로 올라갔습니다.<br>도움이 필요하신지 확인이 필요합니다.',
        caller:'김순자',
        location:'1층 거실',
        map:'assets/map_101.png',
        vitals:[
          {label:'심박수',value:'147 bpm',img:'assets/graph_hr.png',time:'방금'},
          {label:'산소포화도',value:'95%',img:'assets/graph_o2.png',time:'5분전'},
          {label:'수면',value:'7.5h',img:'assets/graph_sleep.png',time:'지난 7일'},
          {label:'걸음수',value:'3,482',img:'assets/graph_steps.png',time:'오늘'}
        ]
      }
    },
    {
      time:'09:02',
      img:'assets/status_02.png',
      name:'이경숙',
      title:'낙상이 스마트워치로 확인 되었습니다.',
      desc:'도움이 필요하신지 확인이 필요합니다.',
      right:'1시간전',
      detail:{
        msg:'스마트워치에서 낙상 신호가 감지되었습니다.<br>입소자의 안전을 확인해 주세요.',
        caller:'이경숙',
        location:'2층 복도',
        map:'assets/map_201.png',
        vitals:[
          {label:'심박수',value:'89 bpm',img:'assets/graph_hr.png',time:'1시간전'},
          {label:'산소포화도',value:'97%',img:'assets/graph_o2.png',time:'1시간전'},
          {label:'수면',value:'6.8h',img:'assets/graph_sleep.png',time:'지난 7일'},
          {label:'걸음수',value:'2,150',img:'assets/graph_steps.png',time:'오늘'}
        ]
      }
    },
    {
      time:'09:01',
      img:'assets/status_03.png',
      name:'김정석',
      title:'산소포화도가 90% 미만으로 감지되었습니다.',
      desc:'즉시 산소포화도 확인이 필요합니다.',
      right:'1시간전',
      detail:{
        msg:'산소포화도가 90% 미만으로 감지되었습니다.<br>즉시 산소포화도 확인이 필요합니다.',
        caller:'김정석',
        location:'1층 화장실',
        map:'assets/map_102.png',
        vitals:[
          {label:'심박수',value:'112 bpm',img:'assets/graph_hr.png',time:'1시간전'},
          {label:'산소포화도',value:'89%',img:'assets/graph_o2.png',time:'1시간전'},
          {label:'수면',value:'6.1h',img:'assets/graph_sleep.png',time:'지난 7일'},
          {label:'걸음수',value:'1,930',img:'assets/graph_steps.png',time:'오늘'}
        ]
      }
    }
  ],
  confirmed: [
    {
      time:'08:11',
      img:'assets/status_04.png',
      name:'추순자',
      title:'낙상이 스마트워치로 확인 되었습니다.',
      desc:'도움이 필요하신지 확인이 필요합니다.',
      manager:'박케어',
      progress:'확인 중',
      right:'2시간전',
      detail:{
        msg:'낙상 신호가 감지되어 담당자가 확인 중입니다.<br>입소자의 상태를 확인해 주세요.',
        caller:'추순자',
        location:'2층 욕실',
        map:'assets/map_202.png',
        vitals:[
          {label:'심박수',value:'77 bpm',img:'assets/graph_hr.png',time:'1시간전'},
          {label:'산소포화도',value:'98%',img:'assets/graph_o2.png',time:'1시간전'},
          {label:'수면',value:'7.1h',img:'assets/graph_sleep.png',time:'지난 7일'},
          {label:'걸음수',value:'2,980',img:'assets/graph_steps.png',time:'오늘'}
        ]
      },
      reply:{ written:false, author:'', avatar:'', content:'' }
    }
  ],
  resolved: [
    {
      time:'07:00',
      img:'assets/status_05.png',
      name:'이경미',
      title:'심박수가 151bpm 이상 입니다.',
      desc:'심박수가 휴식 상태에서 120BPM 이상으로…',
      manager:'김헬퍼',
      progress:'완료',
      right:'3시간전',
      detail:{
        msg:'휴식 중 심박수 상승이 감지되었으나 현재 정상으로 회복되었습니다.',
        caller:'이경미',
        location:'1층 운동실',
        map:'assets/map_103.png',
        vitals:[
          {label:'심박수',value:'151 bpm',img:'assets/graph_hr.png',time:'2시간전'},
          {label:'산소포화도',value:'96%',img:'assets/graph_o2.png',time:'2시간전'},
          {label:'수면',value:'7.9h',img:'assets/graph_sleep.png',time:'지난 7일'},
          {label:'걸음수',value:'4,120',img:'assets/graph_steps.png',time:'오늘'}
        ]
      },
      reply:{
        written:true,
        author:'김석우',
        avatar:'assets/helper_kim.png',
        content:'입소자 상태 확인 후 호흡 안정화 확인. 현재 이상 없음으로 판단되어 귀가 조치 완료했습니다.'
      }
    },
    {
      time:'06:45',
      img:'assets/status_06.png',
      name:'곽영철',
      title:'낙상이 스마트워치로 확인 되었습니다.',
      desc:'도움이 필요하신지 확인이 필요합니다.',
      manager:'김헬퍼',
      progress:'완료',
      right:'4시간전',
      detail:{
        msg:'낙상 신호가 감지되었으나 안전이 확인되어 조치가 완료되었습니다.',
        caller:'곽영철',
        location:'1층 식당',
        map:'assets/map_104.png',
        vitals:[
          {label:'심박수',value:'82 bpm',img:'assets/graph_hr.png',time:'2시간전'},
          {label:'산소포화도',value:'97%',img:'assets/graph_o2.png',time:'2시간전'},
          {label:'수면',value:'7.2h',img:'assets/graph_sleep.png',time:'지난 7일'},
          {label:'걸음수',value:'3,790',img:'assets/graph_steps.png',time:'오늘'}
        ]
      },
      reply:{
        written:true,
        author:'김석우',
        avatar:'assets/helper_kim.png',
        content:'현장 도착하여 낙상 상태 확인, 외상 없음. 입소자 안정 후 귀가 조치하였습니다.'
      }
    }
  ]
};
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
    <button class="detail-btn primary">담당자 호출</button>
    <button class="detail-btn">${rec.detail.caller}님에게 전화 걸기</button>
    <button class="detail-btn danger">119에 전화 걸기</button>
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
             <img src="${rec.reply.avatar}" class="reply-avatar">
             <span class="reply-author">${rec.reply.author} 담당자 확인</span>
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

  // Keep ${buttonsHTML} where it was inserted before
  return `
    <div class="detail-top">
      <img src="${rec.img}" class="detail-profile">
      <div class="detail-info">
        <span class="detail-name">${rec.name}</span>
        <span class="detail-extra">77세&nbsp;&nbsp;101호&nbsp;&nbsp;<span class="status-label daily">일상생활</span>&nbsp;&nbsp;담당자: 김석우</span>
      </div>
    </div>
    <p class="detail-msg">${rec.detail.msg}</p>
    ${buttonsHTML}
    ${replyHTML}
    <div class="vital-card">
          <div class="vital-header">
        <span class="vital-label">최근위치</span>
        <span class="vital-time">방금</span>
      </div>
      <div class="vital-value">${rec.detail.location}</div>
      </div>
    <img src="${rec.detail.map}" class="location-img">
    ${vitalsHTML}
  `;
}

function renderList(typeKey){
  const list = recordData[typeKey] || [];
  let html='';
  list.forEach(item=>{
    html += `<div class="record-row" data-time="${item.time}">
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
  renderList('unconfirmed');
  syncSidebarCounts();
  // --- default-select first unconfirmed record on load ---
  const firstRow = recordListBody.querySelector('.record-row');
  if (firstRow) {
    firstRow.click();
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
    row.addEventListener('click',()=>{
      rows.forEach(r=>r.classList.remove('selected-row'));
      row.classList.add('selected-row');
      const time=row.dataset.time;
      const name=row.querySelector('.rec-main .rec-name-title').textContent.split(' ')[0];
      const title=row.querySelector('.rec-name-title').textContent.replace(name,'').trim();
      if(detailTime) detailTime.textContent=`2025.5.8 목 ${time}`;
      if(detailTitle) detailTitle.textContent=title;
      if(detailBody){
        const recObj = recordData[document.querySelector('.sidebar-menu li.active').dataset.type]
                         .find(r=>r.time===time && r.name===name);
        const activeType = document.querySelector('.sidebar-menu li.active').dataset.type;
        detailBody.innerHTML = buildDetailHTML(recObj || {}, activeType === 'unconfirmed', activeType === 'confirmed');
        attachReplyHandlers();
        attachDetailBtns(recObj.detail.caller);
      }
    });
  });
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
    // Re‑render detail
    const detailBody = document.querySelector('.detail-body');
    const activeType = document.querySelector('.sidebar-menu li.active').dataset.type;
    detailBody.innerHTML = buildDetailHTML(recObj, activeType === 'unconfirmed', activeType === 'confirmed');
    attachReplyHandlers();
    attachDetailBtns(recObj.detail.caller);
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

    // AWS API Configuration
    const API_BASE_URL = window.API_CONFIG?.BASE_URL || 'https://your-api-endpoint.com';
    const WATCHER_USER_ID = window.API_CONFIG?.WATCHER_USER_ID || 'watcher_001';
    const UPDATE_INTERVAL = window.API_CONFIG?.UPDATE_INTERVAL || 5000;
    const ENABLE_MOCK_DATA = window.API_CONFIG?.ENABLE_MOCK_DATA || false;
    
    // 피보호자 데이터 캐시
    let wardedUsers = [];
    let bioDataCache = {};

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
                heartBeatList: [{ heartBeat: 68 + Math.floor(Math.random() * 10) }],
                oxygenStatusList: [{ oxygenSaturation: 95 + Math.floor(Math.random() * 5) }],
                stepsList: [{ steps: 3482 + Math.floor(Math.random() * 500) }]
            },
            'ward002': {
                heartBeatList: [{ heartBeat: 72 + Math.floor(Math.random() * 10) }],
                oxygenStatusList: [{ oxygenSaturation: 94 + Math.floor(Math.random() * 5) }],
                stepsList: [{ steps: 4200 + Math.floor(Math.random() * 500) }]
            },
            'ward003': {
                heartBeatList: [{ heartBeat: 70 + Math.floor(Math.random() * 10) }],
                oxygenStatusList: [{ oxygenSaturation: 96 + Math.floor(Math.random() * 5) }],
                stepsList: [{ steps: 3800 + Math.floor(Math.random() * 500) }]
            },
            'ward004': {
                heartBeatList: [{ heartBeat: 65 + Math.floor(Math.random() * 10) }],
                oxygenStatusList: [{ oxygenSaturation: 97 + Math.floor(Math.random() * 5) }],
                stepsList: [{ steps: 2100 + Math.floor(Math.random() * 500) }]
            },
            'ward005': {
                heartBeatList: [{ heartBeat: 69 + Math.floor(Math.random() * 10) }],
                oxygenStatusList: [{ oxygenSaturation: 95 + Math.floor(Math.random() * 5) }],
                stepsList: [{ steps: 3300 + Math.floor(Math.random() * 500) }]
            }
        },
        events: []
    };

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

    // AWS API 호출 함수들
    async function fetchMappings() {
        if (ENABLE_MOCK_DATA) {
            return mockData.mappings;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/watcher/mappings?watcherUserId=${WATCHER_USER_ID}`, {
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
            if (data.code === "1000") {
                return data.response.filter(m => m.activeYn === 'o');
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
            const response = await fetch(`${API_BASE_URL}/ward/user?wardedUserId=${wardedUserId}`, {
                headers: {'Content-Type': 'application/json'}
            });
            const data = await response.json();
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
                heartBeatList: [{ heartBeat: baseBio.heartBeatList[0].heartBeat + Math.floor(Math.random() * 10 - 5) }],
                oxygenStatusList: [{ oxygenSaturation: baseBio.oxygenStatusList[0].oxygenSaturation + Math.floor(Math.random() * 4 - 2) }],
                stepsList: [{ steps: baseBio.stepsList[0].steps + Math.floor(Math.random() * 100) }]
            };
        }
        
        try {
            const bioTypes = ['heartBeatList', 'oxygenStatusList', 'stepsList'].join(',');
            const response = await fetch(
                `${API_BASE_URL}/watcher/latest?wardedUserId=${wardedUserId}&bioDataTypes=${bioTypes}&limit=1`,
                { headers: {'Content-Type': 'application/json'} }
            );
            const data = await response.json();
            if (data.code === "1000") {
                return data.response;
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

    // 상태 라벨 결정 함수
    function determineStatus(bioData, events) {
        // 이벤트가 있으면 우선 처리
        const recentEvent = events.find(e => e.wardedUserId === bioData.wardedUserId);
        if (recentEvent && recentEvent.eventType) {
            switch(recentEvent.eventType) {
                case 'FALL_DETECTION': return { class: 'warning', text: '낙상' };
                case 'HIGH_HEART_RATE': return { class: 'warning', text: '고심박' };
                case 'LOW_OXYGEN': return { class: 'warning', text: '저산소' };
            }
        }
        
        // 생체 데이터 기반 상태 결정
        const heartRate = bioData.heartBeatList?.[0]?.heartBeat || 0;
        const steps = bioData.stepsList?.[0]?.steps || 0;
        
        if (heartRate > 100) return { class: 'exercise', text: '운동' };
        if (steps < 100) return { class: 'sleep', text: '수면' };
        if (steps > 3000) return { class: 'moving', text: '이동' };
        return { class: 'daily', text: '일상생활' };
    }

    // 테이블 렌더링 함수
    async function renderResidentTable() {
        const tbody = document.querySelector('.resident-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">데이터 로딩 중...</td></tr>';

        try {
            // 1. 매핑 정보 가져오기
            const mappings = await fetchMappings();
            if (mappings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">등록된 피보호자가 없습니다.</td></tr>';
                return;
            }

            // 2. 각 피보호자 정보 가져오기
            wardedUsers = [];
            for (const mapping of mappings) {
                const userInfo = await fetchWardedUserInfo(mapping.wardedUserId);
                if (userInfo) {
                    wardedUsers.push({
                        ...userInfo,
                        room: mapping.room || '미지정' // API에 room 정보가 있다고 가정
                    });
                }
            }

            // 3. 이벤트 데이터 가져오기
            const events = await fetchEvents();

            // 4. 초기 테이블 렌더링
            tbody.innerHTML = '';
            wardedUsers.forEach((user, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${user.profileUrl || 'assets/status_01.png'}" alt="${user.userName} 프로필" class="profile-img"> ${user.userName}</td>
                    <td>${user.age}세</td>
                    <td><span class="status-label daily">일상생활</span></td>
                    <td>${user.room}</td>
                    <td class="heart-rate">--bpm</td>
                    <td class="spo2">--%</td>
                    <td class="sleep">--h</td>
                    <td class="steps">--</td>
                    <td>...</td>
                `;
                tbody.appendChild(tr);
            });

            // 5. 생체 데이터 업데이트 시작
            updateResidentVitals(events);

        } catch (error) {
            console.error('Error rendering table:', error);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">데이터 로드 실패</td></tr>';
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
                if (bioData) {
                    // 캐시 업데이트
                    bioDataCache[user.wardedUserId] = bioData;

                    // 생체 데이터 업데이트
                    const heartRate = bioData.heartBeatList?.[0]?.heartBeat || '--';
                    const spo2 = bioData.oxygenStatusList?.[0]?.oxygenSaturation || '--';
                    const steps = bioData.stepsList?.[0]?.steps || '--';
                    
                    // 수면 시간은 현재 API에 없으므로 더미 데이터 사용
                    const sleepHours = (6 + Math.random() * 3).toFixed(1); // 6~9시간 사이의 랜덤 값

                    row.children[4].textContent = heartRate !== '--' ? `${heartRate}bpm` : '--bpm';
                    row.children[5].textContent = spo2 !== '--' ? `${spo2}%` : '--%';
                    row.children[6].textContent = `${sleepHours}h`; // 수면 시간
                    row.children[7].textContent = steps !== '--' ? steps.toLocaleString() : '--';

                    // 상태 업데이트
                    const status = determineStatus(bioData, events);
                    const statusLabel = row.querySelector('.status-label');
                    statusLabel.className = `status-label ${status.class}`;
                    statusLabel.textContent = status.text;
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
            
            // 층별 거주 인원 업데이트 (데모용 유지)
            updateFloor1Occupancy();
        } catch (error) {
            console.error('Error in periodic update:', error);
        }
    }, UPDATE_INTERVAL); // 설정된 주기로 업데이트

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

  const gnbBtns = document.querySelectorAll('.gnb-btn');

  // Function to set active GNB button based on current page
  function setActiveGnbButton() {
    const currentPage = window.location.pathname.split('/').pop(); // Gets 'index.html', 'record.html', etc.
    gnbBtns.forEach(btn => {
      const pageName = btn.dataset.page;
      if (pageName === currentPage) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      // Special case for root path, activate dashboard
      if (currentPage === '' && pageName === 'index.html') {
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