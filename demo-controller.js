/**
 * 갤럭시 워치 데모 컨트롤러
 * "밤을 지키는 시계" 시연용
 */

class DemoController {
    constructor() {
        this.currentScenario = 'normal';
        this.originalFunctions = {};
        
        // API 오버라이드를 가장 먼저 실행
        this.overrideAPICalls();
        
        // 시나리오 초기화
        this.scenarios = this.initScenarios();
        
        // UI 초기화
        this.injectControls();
        this.initializeDemo();
        
        console.log('🎭 데모 모드 활성화됨 - 실제 API 호출 차단됨');
    }
    
    // 데모 컨트롤 버튼 UI 주입 (숨김 처리)
    injectControls() {
        // 기존 메뉴에 이벤트 리스너 추가
        this.attachMenuListeners();
        
        // 숨겨진 상태 표시기만 추가 (키보드 단축키 안내)
        const indicator = document.createElement('div');
        indicator.className = 'demo-indicator';
        indicator.innerHTML = `
            <div class="demo-status" id="demo-status">🎭</div>
            <div class="demo-tooltip" id="demo-tooltip" style="display: none;">
                데모 모드 활성화<br>
                <small>시나리오: <span id="current-scenario">평상시</span></small>
            </div>
        `;
        document.body.appendChild(indicator);
        
        // 스타일 추가
        this.injectStyles();
        
        // 호버 이벤트
        const status = document.getElementById('demo-status');
        const tooltip = document.getElementById('demo-tooltip');
        status.addEventListener('mouseenter', () => tooltip.style.display = 'block');
        status.addEventListener('mouseleave', () => tooltip.style.display = 'none');
    }
    
    // 기존 메뉴에 시나리오 연결
    attachMenuListeners() {
        // 키보드 단축키로만 제어 (메뉴 클릭 방지)
        document.addEventListener('keydown', (e) => {
            if (!e.ctrlKey) return;
            
            switch(e.key) {
                case '1':  // Ctrl+1: 평상시
                    e.preventDefault();
                    this.setScenario('normal');
                    this.showKeyboardHint('평상시 모드');
                    break;
                    
                case '2':  // Ctrl+2: 생체이상
                    e.preventDefault();
                    this.setScenario('vitals');
                    this.showKeyboardHint('생체이상 감지');
                    break;
                    
                case '3':  // Ctrl+3: 낙상감지
                    e.preventDefault();
                    this.setScenario('fall');
                    this.showKeyboardHint('낙상 감지');
                    break;
                    
                case '4':  // Ctrl+4: 무단외출
                    e.preventDefault();
                    this.setScenario('outing');
                    this.showKeyboardHint('무단외출 감지');
                    break;
                    
                case '5':  // Ctrl+5: 수면이상
                    e.preventDefault();
                    this.setScenario('sleep');
                    this.showKeyboardHint('수면이상 분석');
                    break;
                    
                case '9':  // Ctrl+9: 응급상황
                    e.preventDefault();
                    this.setScenario('emergency');
                    this.showKeyboardHint('🆘 응급상황');
                    break;
                    
                case '0':  // Ctrl+0: 단축키 도움말
                    e.preventDefault();
                    this.showShortcutHelp();
                    break;
            }
        });
    }
    
    // 키보드 힌트 표시 (시연자만 보임)
    showKeyboardHint(text) {
        // 기존 힌트 제거
        const existing = document.querySelector('.keyboard-hint');
        if (existing) existing.remove();
        
        const hint = document.createElement('div');
        hint.className = 'keyboard-hint';
        hint.textContent = text;
        hint.style.cssText = `
            position: fixed;
            bottom: 70px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 15px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 9998;
            animation: fadeInOut 2s;
        `;
        
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 2000);
    }
    
    // 단축키 도움말 표시
    showShortcutHelp() {
        const help = document.createElement('div');
        help.className = 'shortcut-help';
        help.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        background: white; padding: 20px; border-radius: 10px;
                        box-shadow: 0 5px 20px rgba(0,0,0,0.3); z-index: 10002;">
                <h3 style="margin: 0 0 15px 0;">🎮 데모 단축키</h3>
                <div style="font-size: 14px; line-height: 1.8;">
                    <div><b>Ctrl+1</b> : 평상시</div>
                    <div><b>Ctrl+2</b> : 생체이상</div>
                    <div><b>Ctrl+3</b> : 낙상감지</div>
                    <div><b>Ctrl+4</b> : 무단외출</div>
                    <div><b>Ctrl+5</b> : 수면이상</div>
                    <div><b>Ctrl+9</b> : 응급상황</div>
                    <div style="margin-top: 10px; color: #666;">ESC 키로 닫기</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(help);
        
        // ESC로 닫기
        const closeHelp = (e) => {
            if (e.key === 'Escape') {
                help.remove();
                document.removeEventListener('keydown', closeHelp);
            }
        };
        document.addEventListener('keydown', closeHelp);
        
        // 클릭으로도 닫기
        help.addEventListener('click', () => help.remove());
    }
    
    // 데모 전용 스타일 주입
    injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* 데모 상태 표시기 (작은 아이콘) */
            .demo-indicator {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
            }
            
            .demo-status {
                width: 40px;
                height: 40px;
                background: rgba(102, 126, 234, 0.1);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                cursor: help;
                transition: all 0.3s;
            }
            
            .demo-status:hover {
                background: rgba(102, 126, 234, 0.2);
                transform: scale(1.1);
            }
            
            .demo-tooltip {
                position: absolute;
                bottom: 50px;
                right: 0;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-size: 12px;
                white-space: nowrap;
                pointer-events: none;
            }
            
            /* 메뉴 아이템 시각적 피드백 */
            .menu-item.demo-active {
                background: rgba(102, 126, 234, 0.1);
                transition: background 0.3s;
            }
            
            /* 긴급 상황 애니메이션 */
            @keyframes emergency-blink {
                0%, 50% { background: #ff4444; }
                25%, 75% { background: #ff6666; }
            }
            
            .emergency-mode {
                animation: emergency-blink 1s infinite;
            }
            
            /* 알림 팝업 */
            .demo-notification {
                position: fixed;
                top: 80px;
                right: 20px;
                background: white;
                color: #333;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                z-index: 10001;
                min-width: 300px;
                transform: translateX(400px);
                transition: transform 0.5s;
            }
            
            .demo-notification.show {
                transform: translateX(0);
            }
            
            .demo-notification.alert {
                border-left: 5px solid #ff4444;
            }
            
            .demo-notification.warning {
                border-left: 5px solid #ffaa00;
            }
            
            .demo-notification.info {
                border-left: 5px solid #4444ff;
            }
            
            /* 키보드 힌트 애니메이션 */
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(10px); }
                20% { opacity: 1; transform: translateY(0); }
                80% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 인디케이터 플래시 효과
    flashIndicator() {
        const status = document.getElementById('demo-status');
        if (status) {
            status.style.background = 'rgba(102, 126, 234, 0.5)';
            setTimeout(() => {
                status.style.background = 'rgba(102, 126, 234, 0.1)';
            }, 300);
        }
    }
    
    // API 호출 오버라이드
    overrideAPICalls() {
        console.log('🔧 API 오버라이드 시작 - 실제 API 호출 완전 차단');
        
        // 즉시 전역 함수들을 데모 데이터로 대체
        window.fetchMappings = () => {
            console.log('📊 데모 매핑 데이터 반환');
            return Promise.resolve(this.getDemoMappings());
        };
        
        window.fetchEvents = () => {
            console.log('📊 데모 이벤트 데이터 반환');
            return Promise.resolve(this.getDemoEvents());
        };
        
        window.fetchLatestBioData = (wardedUserId) => {
            console.log('📊 데모 바이오 데이터 반환:', wardedUserId);
            return Promise.resolve(this.getDemoBioData(wardedUserId));
        };
        
        window.fetchTodayLocationData = (wardedUserId) => {
            console.log('📊 데모 위치 데이터 반환:', wardedUserId);
            return Promise.resolve(this.getDemoLocationData(wardedUserId));
        };
        
        // fetchRecordData도 오버라이드
        window.fetchRecordData = async () => {
            console.log('📊 데모 레코드 데이터 반환');
            return Promise.resolve(this.getDemoRecordData());
        };
        
        console.log('✅ 모든 API 함수 오버라이드 완료 - 실제 API 호출 차단됨');
    }
    
    // 시나리오 초기화
    initScenarios() {
        return {
            normal: {
                name: '평상시 모니터링',
                description: '26명 입소자의 실시간 생체신호가 자동 측정되고 있습니다.<br>체온(5분), 혈압(30분), 심박수(실시간) 모니터링 중',
                data: this.getNormalScenarioData()
            },
            vitals: {
                name: '생체신호 이상 감지',
                description: '🚨 새벽 2시: 302호 박순자(84세)<br>체온 39.2°C + 심박수 125bpm 감지!<br>고온 위험, 즉시 확인 필요',
                data: this.getVitalsScenarioData()
            },
            fall: {
                name: '낙상 감지',
                description: '🚨 새벽 3시: 104호 김정석(78세)<br>1층 화장실에서 낙상 감지!<br>저혈압(85/50) 확인, 즉시 확인 필요',
                data: this.getFallScenarioData()
            },
            outing: {
                name: '치매 어르신 무단외출',
                description: '🚨 새벽 4시: 203호 최영자(82세) 무단외출 감지!<br>현재 위치: 서울 송파구 마천동 7<br>(세븐일레븐 마천파크점, 117m)<br>즉시 확인 필요',
                data: this.getOutingScenarioData()
            },
            sleep: {
                name: '수면 이상',
                description: '⚠️ 이경숙(79세) 수면질 불량(15점)<br>깊은수면 0분, 12회 깸<br>낙상위험 85%, 오전 보행보조 필수',
                data: this.getSleepScenarioData()
            },
            emergency: {
                name: '응급상황',
                description: '🆘 김영수(77세) 서맥 위험!<br>심박수 25bpm, 의식 저하<br>119 신고 검토, AED 1층 복도',
                data: this.getEmergencyScenarioData()
            }
        };
    }
    
    // 평상시 시나리오 데이터
    getNormalScenarioData() {
        // 상태 랜덤 선택 함수
        const getRandomStatus = () => {
            const statuses = ['일상생활', '운동', '이동', '수면'];
            const weights = [50, 15, 10, 25]; // 가중치 (확인중 제거, 수면 비중 증가)
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < statuses.length; i++) {
                random -= weights[i];
                if (random <= 0) return statuses[i];
            }
            return '일상생활';
        };
        
        // 실내 위치 랜덤 선택 함수
        const getRandomIndoorLocation = () => {
            const locations = [
                '101호실', '102호실', '103호실', '104호실', '105호실', '106호실',
                '201호실', '202호실', '203호실',
                '1층 거실', '1층 복도', '1층 화장실', '1층 식당',
                '2층 거실', '2층 복도', '2층 화장실',
                '물리치료실', '상담실', '휴게실'
            ];
            return locations[Math.floor(Math.random() * locations.length)];
        };
        
        // 26명의 고정 입소자 데이터
        const residents = [
            { wardedUserId: 'ward001', userName: '김영수', age: 77, room: '101호', 
              profileImg: 'assets/status_01.png', temp: 36.5, bp: '120/80', hr: 68, spo2: 98, 
              sleep: '양호(82점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward002', userName: '김순자', age: 84, room: '101호',
              profileImg: 'assets/status_02.png', temp: 36.4, bp: '118/75', hr: 72, spo2: 97, 
              sleep: '양호(78점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward003', userName: '신영자', age: 82, room: '101호',
              profileImg: 'assets/status_03.png', temp: 36.6, bp: '125/82', hr: 70, spo2: 96, 
              sleep: '주의(55점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward004', userName: '김정석', age: 78, room: '102호',
              profileImg: 'assets/status_04.png', temp: 36.3, bp: '115/70', hr: 65, spo2: 98, 
              sleep: '양호(75점)', location: getRandomIndoorLocation(), outing: '병원(오전 10시)', status: getRandomStatus() },
            { wardedUserId: 'ward005', userName: '서영숙', age: 84, room: '102호',
              profileImg: 'assets/status_05.png', temp: 36.5, bp: '130/85', hr: 69, spo2: 97, 
              sleep: '양호(80점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward006', userName: '박영철', age: 86, room: '103호',
              profileImg: 'assets/status_06.png', temp: 36.4, bp: '122/78', hr: 70, spo2: 96, 
              sleep: '양호(76점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '이동' },
            { wardedUserId: 'ward007', userName: '김경숙', age: 87, room: '103호',
              profileImg: 'assets/status_07.png', temp: 36.3, bp: '115/72', hr: 65, spo2: 97, 
              sleep: '양호(84점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '수면' },
            { wardedUserId: 'ward008', userName: '이경미', age: 88, room: '103호',
              profileImg: 'assets/status_08.png', temp: 36.5, bp: '125/80', hr: 72, spo2: 95, 
              sleep: '양호(72점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '운동' },
            { wardedUserId: 'ward009', userName: '최영자', age: 90, room: '103호',
              profileImg: 'assets/status_09.png', temp: 36.6, bp: '128/82', hr: 67, spo2: 98, 
              sleep: '주의(62점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward010', userName: '이송자', age: 79, room: '104호',
              profileImg: 'assets/status_10.png', temp: 36.4, bp: '120/75', hr: 75, spo2: 94, 
              sleep: '양호(71점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '운동' },
            { wardedUserId: 'ward011', userName: '추순자', age: 88, room: '104호',
              profileImg: 'assets/status_11.png', temp: 36.5, bp: '118/74', hr: 66, spo2: 96, 
              sleep: '양호(77점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward012', userName: '정기숙', age: 86, room: '105호',
              profileImg: 'assets/status_12.png', temp: 36.3, bp: '124/79', hr: 69, spo2: 95, 
              sleep: '양호(79점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward013', userName: '최민준', age: 72, room: '105호',
              profileImg: 'assets/status_13.png', temp: 36.4, bp: '112/68', hr: 64, spo2: 98, 
              sleep: '우수(88점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '수면' },
            { wardedUserId: 'ward014', userName: '강지우', age: 75, room: '106호',
              profileImg: 'assets/status_01.png', temp: 36.5, bp: '122/76', hr: 71, spo2: 96, 
              sleep: '양호(74점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '이동' },
            { wardedUserId: 'ward015', userName: '윤서아', age: 81, room: '106호',
              profileImg: 'assets/status_02.png', temp: 36.6, bp: '126/81', hr: 73, spo2: 95, 
              sleep: '양호(70점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '운동' },
            { wardedUserId: 'ward016', userName: '임하윤', age: 77, room: '107호',
              profileImg: 'assets/status_03.png', temp: 36.4, bp: '119/74', hr: 68, spo2: 97, 
              sleep: '양호(81점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward017', userName: '한지호', age: 83, room: '107호',
              profileImg: 'assets/status_04.png', temp: 36.3, bp: '116/71', hr: 66, spo2: 98, 
              sleep: '우수(85점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '수면' },
            { wardedUserId: 'ward018', userName: '오은서', age: 74, room: '108호',
              profileImg: 'assets/status_05.png', temp: 36.5, bp: '128/83', hr: 74, spo2: 94, 
              sleep: '주의(58점)', location: getRandomIndoorLocation(), outing: '병원 예정', status: '운동' },
            { wardedUserId: 'ward019', userName: '서예준', age: 89, room: '108호',
              profileImg: 'assets/status_06.png', temp: 36.4, bp: '121/77', hr: 67, spo2: 96, 
              sleep: '양호(73점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward020', userName: '권도윤', age: 71, room: '109호',
              profileImg: 'assets/status_07.png', temp: 36.6, bp: '123/78', hr: 70, spo2: 95, 
              sleep: '주의(64점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '이동' },
            { wardedUserId: 'ward021', userName: '황시우', age: 78, room: '109호',
              profileImg: 'assets/status_08.png', temp: 36.3, bp: '114/69', hr: 65, spo2: 97, 
              sleep: '우수(86점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '수면' },
            { wardedUserId: 'ward022', userName: '송지아', age: 85, room: '110호',
              profileImg: 'assets/status_09.png', temp: 36.5, bp: '127/82', hr: 72, spo2: 95, 
              sleep: '양호(72점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '운동' },
            { wardedUserId: 'ward023', userName: '정수빈', age: 73, room: '110호',
              profileImg: 'assets/status_10.png', temp: 36.4, bp: '117/73', hr: 69, spo2: 96, 
              sleep: '양호(78점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() },
            { wardedUserId: 'ward024', userName: '조하준', age: 80, room: '111호',
              profileImg: 'assets/status_11.png', temp: 36.5, bp: '120/75', hr: 66, spo2: 98, 
              sleep: '우수(83점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: '수면' },
            { wardedUserId: 'ward025', userName: '유채원', age: 76, room: '111호',
              profileImg: 'assets/status_12.png', temp: 36.3, bp: '125/79', hr: 71, spo2: 95, 
              sleep: '주의(67점)', location: getRandomIndoorLocation(), outing: '산책 예정', status: '이동' },
            { wardedUserId: 'ward026', userName: '이하준', age: 79, room: '112호',
              profileImg: 'assets/status_01.png', temp: 36.4, bp: '119/74', hr: 68, spo2: 97, 
              sleep: '양호(75점)', location: getRandomIndoorLocation(), outing: '외출 없음', status: getRandomStatus() }
        ];
        
        // 초기 데이터 저장 (나중에 변동 시뮬레이션에 사용)
        if (!this.baselineData) {
            this.baselineData = JSON.parse(JSON.stringify(residents));
        }
        
        return { residents, events: [] };
    }
    
    // 생체이상 시나리오 데이터
    getVitalsScenarioData() {
        const data = this.getNormalScenarioData();
        
        // 박순자 할머니 상태 변경
        const target = data.residents.find(r => r.userName === '김순자');
        if (target) {
            target.temp = 39.2;
            target.hr = 125;
            target.bp = '150/95';
            target.spo2 = 94;
            target.status = '긴급확인';
            target.location = '101호실';
        }
        
        // 이벤트 추가
        data.events.push({
            eventId: 'demo_vitals_001',
            eventType: 'HIGH_HEART_RATE_DETECTED',
            wardedUserId: 'ward002',
            registrationDateTime: new Date().toISOString(),
            status: 'UNCONFIRMED'
        });
        
        return data;
    }
    
    // 낙상 시나리오 데이터
    getFallScenarioData() {
        const data = this.getNormalScenarioData();
        
        // 김정석 할아버지 상태 변경
        const target = data.residents.find(r => r.userName === '김정석');
        if (target) {
            target.bp = '85/50';
            target.status = '낙상';
            target.location = '1층 화장실';
            target.hr = 95;
        }
        
        // 이벤트 추가
        data.events.push({
            eventId: 'demo_fall_001',
            eventType: 'FALL_DETECTED',
            wardedUserId: 'ward004',
            registrationDateTime: new Date().toISOString(),
            status: 'UNCONFIRMED'
        });
        
        return data;
    }
    
    // 무단외출 시나리오 데이터
    getOutingScenarioData() {
        const data = this.getNormalScenarioData();
        
        // 신영자 할머니를 최영자로 변경하고 외출 상태로
        const target = data.residents.find(r => r.userName === '신영자');
        if (target) {
            target.userName = '최영자';
            target.location = '서울 송파구 마천동 7';
            target.outing = '무단외출 감지';
            target.status = '배회중';
        }
        
        return data;
    }
    
    // 수면이상 시나리오 데이터
    getSleepScenarioData() {
        const data = this.getNormalScenarioData();
        
        // 서영숙 할머니를 이경숙으로 변경하고 수면 불량 상태로
        const target = data.residents.find(r => r.userName === '서영숙');
        if (target) {
            target.userName = '이경숙';
            target.age = 79;
            target.sleep = '불량(15점)';
            target.status = '주의필요';
            target.hr = 78;
            target.bp = '135/88';
        }
        
        return data;
    }
    
    // 응급상황 시나리오 데이터
    getEmergencyScenarioData() {
        const data = this.getNormalScenarioData();
        
        // 김영수 할아버지 응급 상태
        const target = data.residents.find(r => r.userName === '김영수');
        if (target) {
            target.hr = 25;
            target.bp = '85/50';
            target.spo2 = 88;
            target.status = '응급';
            target.location = '101호실';
        }
        
        // 이벤트 추가
        data.events.push({
            eventId: 'demo_emergency_001',
            eventType: 'EMERGENCY',
            wardedUserId: 'ward001',
            registrationDateTime: new Date().toISOString(),
            status: 'UNCONFIRMED'
        });
        
        // 화면 깜빡임 효과
        setTimeout(() => {
            const demoControls = document.querySelector('.demo-controls');
            if (demoControls) {
                demoControls.classList.add('emergency-mode');
            }
        }, 500);
        
        return data;
    }
    
    // 시나리오 설정
    setScenario(scenarioName) {
        this.currentScenario = scenarioName;
        const scenario = this.scenarios[scenarioName];
        
        // 이벤트 시작 시간 기록 (이벤트 처리 시뮬레이션용)
        this.eventStartTime = Date.now();
        
        // 현재 시나리오 표시 업데이트
        const currentScenarioEl = document.getElementById('current-scenario');
        if (currentScenarioEl) {
            currentScenarioEl.textContent = scenario.name;
        }
        
        // 시각적 피드백 (짧은 플래시)
        this.flashIndicator();
        
        // 응급 모드 해제
        const demoControls = document.querySelector('.demo-controls');
        if (demoControls) {
            demoControls.classList.remove('emergency-mode');
        }
        
        // 데이터 업데이트
        this.updateDemoData();
        
        // 알림 표시
        if (scenarioName !== 'normal') {
            this.showNotification(scenario.name, scenario.description);
        }
        
        // 페이지별 새로고침 - 시나리오 변경 시 즉시 반영
        if (window.location.pathname.includes('dashboard.html')) {
            // 대시보드 테이블 즉시 새로고침 (이상 상태 바로 표시)
            if (typeof window.renderResidentTable === 'function') {
                console.log('🔄 시나리오 변경 - 테이블 즉시 새로고침');
                window.renderResidentTable();
            }
        } else if (window.location.pathname.includes('record.html')) {
            // record.html 페이지 새로고침
            if (typeof initializeRecordData === 'function') {
                initializeRecordData();
            }
        }
        
        // 시나리오별 특수 효과
        this.applyScenarioEffects(scenarioName);
    }
    
    // 시나리오별 특수 효과 적용
    applyScenarioEffects(scenarioName) {
        switch(scenarioName) {
            case 'outing':
                // 무단외출 시나리오 - 3초 후 위치 모달 자동 팝업
                setTimeout(() => {
                    // 실제 마천동 편의점 좌표 사용
                    this.showLocationModal('최영자', '서울 송파구 마천동 7 (세븐일레븐 마천파크점)', 117, 37.5012627374623, 127.146985013987);
                }, 3000);
                break;
                
            case 'vitals':
                // 생체신호 이상 - 2초 후 위치 모달 표시
                setTimeout(() => {
                    this.showLocationModal('박순자', '302호실', 0, 37.501610, 127.148037);
                }, 2000);
                break;
                
            case 'emergency':
                // 응급상황 - 화면 깜빡임과 함께 긴급 알림
                this.triggerEmergencyAlert();
                // 2초 후 위치 모달 표시
                setTimeout(() => {
                    this.showLocationModal('김영수', '101호실', 0, 37.501610, 127.148037);
                }, 2000);
                break;
                
            case 'fall':
                // 낙상 시나리오 - 2초 후 위치 표시
                setTimeout(() => {
                    this.showLocationModal('김정석', '1층 화장실', 0, 37.501610, 127.148037);
                }, 2000);
                break;
        }
    }
    
    // 위치 모달 표시
    showLocationModal(residentName, locationName, distance, lat, lng) {
        // 위치 모달 HTML 생성 (기존 모달이 없는 경우)
        let modal = document.getElementById('demo-location-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'demo-location-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <button class="modal-close" onclick="this.parentElement.parentElement.classList.add('hidden')">✕</button>
                    <h2 class="modal-title">📍 위치 추적 정보</h2>
                    <div style="margin-bottom: 16px;">
                        <h3 id="demo-location-resident" style="margin: 0 0 8px 0; font-size: 1.2rem; font-weight: 600;"></h3>
                        <p id="demo-location-info" style="margin: 0 0 4px 0; color: #374151;"></p>
                        <p id="demo-location-distance" style="margin: 0; color: #6B7280; font-size: 0.875rem;"></p>
                    </div>
                    <div id="demo-map-container" style="width: 100%; height: 300px; border-radius: 8px; overflow: hidden; background: #e5e7eb;">
                    </div>
                    <div style="margin-top: 16px; padding: 12px; background: #fef2f2; border-radius: 6px; border-left: 4px solid #ef4444;">
                        <p style="margin: 0; color: #991b1b; font-weight: 500;">⚠️ 즉시 대응 필요</p>
                        <p style="margin: 4px 0 0 0; color: #7f1d1d; font-size: 0.875rem;">당직 직원 : 이승훈 간호사 - 개인 휴대폰 알림 완료</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // 모달 내용 업데이트
        const residentEl = document.getElementById('demo-location-resident');
        const infoEl = document.getElementById('demo-location-info');
        const distanceEl = document.getElementById('demo-location-distance');
        
        if (residentEl) residentEl.textContent = residentName + ' 어르신';
        if (infoEl) infoEl.textContent = '현재 위치: ' + locationName;
        if (distanceEl) distanceEl.textContent = distance > 0 ? `요양원으로부터 ${distance}m 떨어진 위치` : '요양원 내부';
        
        // 모달 표시
        modal.classList.remove('hidden');
        
        // 카카오맵 초기화 (약간의 지연 후 실행하여 DOM이 준비되도록 함)
        setTimeout(() => {
            const mapContainer = document.getElementById('demo-map-container');
            console.log('🗺️ 카카오맵 초기화 시도:', {
                container: !!mapContainer,
                kakao: !!window.kakao,
                maps: !!(window.kakao && window.kakao.maps),
                lat: lat,
                lng: lng
            });
            
            if (mapContainer && window.kakao && window.kakao.maps) {
                try {
                    // 요양원 위치
                    const nursingHomeLatLng = new kakao.maps.LatLng(37.501610, 127.148037);
                    
                    // 거리에 따라 지도 레벨 조정
                    // 실내(0m): 레벨 2 (더 확대)
                    // 100m 이상: 레벨 4 (두 마커 모두 보기)
                    const zoomLevel = distance > 100 ? 4 : 2;
                    
                    const mapOption = {
                        center: new kakao.maps.LatLng(lat, lng),
                        level: zoomLevel
                    };
                    
                    const map = new kakao.maps.Map(mapContainer, mapOption);
                    
                    // 현재 위치 마커
                    const currentMarker = new kakao.maps.Marker({
                        position: new kakao.maps.LatLng(lat, lng),
                        title: residentName + ' 어르신 현재 위치'
                    });
                    currentMarker.setMap(map);
                    
                    // 현재 위치 인포윈도우
                    const currentIwContent = `<div style="padding:10px; font-size:12px; width:200px;">
                                         <strong>${residentName} 어르신</strong><br>
                                         현재 위치: ${locationName}
                                       </div>`;
                    const currentInfowindow = new kakao.maps.InfoWindow({
                        content: currentIwContent
                    });
                    currentInfowindow.open(map, currentMarker);
                    
                    // 무단외출인 경우 요양원 마커도 추가
                    if (distance > 100) {  // 100m 이상 떨어진 경우 요양원 마커 표시
                        // 요양원 마커 (다른 색상)
                        const nursingHomeMarker = new kakao.maps.Marker({
                            position: nursingHomeLatLng,
                            title: '요양원 위치'
                        });
                        nursingHomeMarker.setMap(map);
                        
                        // 요양원 인포윈도우
                        const nursingHomeIwContent = `<div style="padding:10px; font-size:12px; width:150px;">
                                             <strong>헬로온 요양원</strong><br>
                                             서울 송파구 오금로
                                           </div>`;
                        const nursingHomeInfowindow = new kakao.maps.InfoWindow({
                            content: nursingHomeIwContent
                        });
                        nursingHomeInfowindow.open(map, nursingHomeMarker);
                        
                        // 두 마커가 모두 보이도록 bounds 설정
                        const bounds = new kakao.maps.LatLngBounds();
                        bounds.extend(new kakao.maps.LatLng(lat, lng));
                        bounds.extend(nursingHomeLatLng);
                        map.setBounds(bounds);
                        
                        // 두 지점 사이에 선 그리기
                        const linePath = [
                            nursingHomeLatLng,
                            new kakao.maps.LatLng(lat, lng)
                        ];
                        
                        const polyline = new kakao.maps.Polyline({
                            path: linePath,
                            strokeWeight: 3,
                            strokeColor: '#FF0000',
                            strokeOpacity: 0.7,
                            strokeStyle: 'dashed'
                        });
                        
                        polyline.setMap(map);
                    }
                    
                    console.log('✅ 카카오맵 초기화 성공');
                } catch (error) {
                    console.error('❌ 카카오맵 초기화 오류:', error);
                }
            } else {
                console.error('❌ 카카오맵 API 로드 실패 또는 컨테이너 없음');
            }
        }, 500);
        
        // 자동 닫기 제거 - 사용자가 X 버튼을 눌러야만 닫힘
    }
    
    // 응급 상황 알림 효과
    triggerEmergencyAlert() {
        // 화면 전체 깜빡임 효과
        const flashOverlay = document.createElement('div');
        flashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 0, 0, 0.3);
            z-index: 10000;
            pointer-events: none;
            animation: emergency-flash 0.5s 3;
        `;
        
        // 애니메이션 스타일 추가
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes emergency-flash {
                0%, 100% { opacity: 0; }
                50% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(flashOverlay);
        
        // 1.5초 후 제거
        setTimeout(() => {
            flashOverlay.remove();
        }, 1500);
        
        // 응급 알림음 효과 (시각적 표시)
        const alertSound = document.createElement('div');
        alertSound.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10001;
            text-align: center;
            border: 3px solid #ef4444;
        `;
        alertSound.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 10px;">🚨</div>
            <h2 style="color: #ef4444; margin: 0 0 10px 0;">응급상황 발생!</h2>
            <p style="margin: 0; color: #374151;">119 자동 신고 완료</p>
        `;
        
        document.body.appendChild(alertSound);
        
        // 3초 후 제거
        setTimeout(() => {
            alertSound.remove();
        }, 3000);
    }
    
    // 알림 표시
    showNotification(title, message) {
        // 기존 알림 제거
        const existing = document.querySelector('.demo-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = 'demo-notification alert';
        notification.innerHTML = `
            <h4 style="margin: 0 0 10px 0;">${title}</h4>
            <p style="margin: 0;">${message}</p>
        `;
        
        document.body.appendChild(notification);
        
        // 애니메이션
        setTimeout(() => notification.classList.add('show'), 100);
        
        // 5초 후 자동 제거
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }
    
    // 데모 데이터 제공 함수들
    getDemoMappings() {
        const scenario = this.scenarios[this.currentScenario];
        return scenario.data.residents.map(r => ({
            wardedUserId: r.wardedUserId,
            userName: r.userName,
            age: r.age,
            userProfileUrl: r.profileImg || `assets/status_${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')}.png`,
            room: r.room,
            activeYn: 'o'
        }));
    }
    
    getDemoEvents() {
        const scenario = this.scenarios[this.currentScenario];
        // 항상 배열을 반환하도록 보장
        return Promise.resolve(scenario.data.events || []);
    }
    
    getDemoBioData(wardedUserId) {
        const scenario = this.scenarios[this.currentScenario];
        const resident = scenario.data.residents.find(r => r.wardedUserId === wardedUserId);
        
        if (!resident) return null;
        
        // 혈압 파싱
        const [systolic, diastolic] = resident.bp.split('/').map(v => parseInt(v) || 0);
        
        // 걸음수 처리 (실시간 변동 데이터 사용)
        const stepsDaily = resident.steps || (1000 + Math.floor(Math.random() * 5000));
        
        // 상태 데이터 처리 - resident.status가 있으면 사용, 없으면 랜덤
        let userActionStatus = 'USER_ACTIVITY_PASSIVE';
        let phoneUserStatus = 'ActivityType.STILL';
        
        if (resident.status) {
            // resident.status에 따라 매핑
            const statusMap = {
                '일상생활': { action: 'USER_ACTIVITY_PASSIVE', phone: 'ActivityType.STILL' },
                '운동': { action: 'USER_ACTIVITY_EXERCISE', phone: 'ActivityType.UNKNOWN' },
                '이동': { action: 'USER_ACTIVITY_PASSIVE', phone: 'ActivityType.IN_VEHICLE' },
                '수면': { action: 'USER_ACTIVITY_ASLEEP', phone: 'ActivityType.STILL' },
                // 특수 상태들
                '낙상': { action: 'USER_ACTIVITY_PASSIVE', phone: 'ActivityType.STILL', special: 'FALL' },
                '긴급확인': { action: 'USER_ACTIVITY_PASSIVE', phone: 'ActivityType.STILL', special: 'EMERGENCY' },
                '배회중': { action: 'USER_ACTIVITY_PASSIVE', phone: 'ActivityType.WALKING', special: 'WANDERING' },
                '주의필요': { action: 'USER_ACTIVITY_PASSIVE', phone: 'ActivityType.STILL', special: 'ATTENTION' },
                '응급': { action: 'USER_ACTIVITY_PASSIVE', phone: 'ActivityType.STILL', special: 'CRITICAL' }
            };
            
            const mapped = statusMap[resident.status] || statusMap['일상생활'];
            userActionStatus = mapped.action;
            phoneUserStatus = mapped.phone;
            
            // 특수 상태인 경우 specialStatus 추가
            if (mapped.special) {
                resident.specialStatus = mapped.special;
            }
        }
        
        const bioData = {
            wardedUserId: wardedUserId,
            heartBeat: [{ heartBeat: resident.hr, registrationDateTime: new Date().toISOString() }],
            oxygenStatus: [{ oxygenSaturation: resident.spo2, registrationDateTime: new Date().toISOString() }],
            steps: [{ stepsDaily: stepsDaily, step_date: new Date().toISOString().split('T')[0] }],
            temperature: [{ temperature: resident.temp, registrationDateTime: new Date().toISOString() }],
            bloodPressure: [{ 
                systolic: systolic, 
                diastolic: diastolic, 
                registrationDateTime: new Date().toISOString() 
            }],
            sleep: this.parseSleepQuality(resident.sleep),
            location: [{ 
                latitude: 37.501610 + (Math.random() - 0.5) * 0.01,
                longitude: 127.148037 + (Math.random() - 0.5) * 0.01,
                registrationDateTime: new Date().toISOString()
            }],
            userActionStatus: [{ userActionStatus: userActionStatus, registrationDateTime: new Date().toISOString() }],
            phoneUserStatus: [{ type: phoneUserStatus, registrationDateTime: new Date().toISOString() }],
            // 데모용 실내 위치 추가
            indoorLocation: resident.location || '위치 정보 없음',
            // 외출 정보 추가
            outing: resident.outing || '외출 없음'
        };
        
        // 특수 상태 추가
        if (resident.specialStatus) {
            bioData.specialStatus = resident.specialStatus;
            bioData.status = resident.status; // 원래 상태명도 포함
        }
        
        return bioData;
    }
    
    getDemoLocationData(wardedUserId) {
        console.log('🔍 getDemoLocationData 호출:', wardedUserId);
        
        // 김정석 외출 이력 데이터를 먼저 확인 (병원 방문)
        if (wardedUserId === 'ward004') {
            console.log('🏥 김정석 외출 데이터 생성 중...');
            const locations = [];
            const now = new Date();
            
            // 오전 10시 외출
            const outTime = new Date(now);
            outTime.setHours(10, 0, 0, 0);
            
            // 요양원 -> 병원 경로
            locations.push({
                latitude: 37.501610,  // 요양원
                longitude: 127.148037,
                registrationDateTime: new Date(outTime.getTime() - 60 * 60 * 1000).toISOString() // 9시
            });
            
            locations.push({
                latitude: 37.5055,  // 병원 근처 (요양원에서 약 500m)
                longitude: 127.1455,
                registrationDateTime: outTime.toISOString() // 10시
            });
            
            locations.push({
                latitude: 37.5065,  // 병원 (요양원에서 약 600m)
                longitude: 127.1450,
                registrationDateTime: new Date(outTime.getTime() + 10 * 60 * 1000).toISOString() // 10시 10분
            });
            
            // 병원에서 머무름 (11시까지)
            for (let i = 1; i <= 5; i++) {
                locations.push({
                    latitude: 37.5065 + (Math.random() - 0.5) * 0.0001,
                    longitude: 127.1450 + (Math.random() - 0.5) * 0.0001,
                    registrationDateTime: new Date(outTime.getTime() + (10 + i * 10) * 60 * 1000).toISOString()
                });
            }
            
            // 복귀
            locations.push({
                latitude: 37.5055,  // 병원 근처
                longitude: 127.1455,
                registrationDateTime: new Date(outTime.getTime() + 60 * 60 * 1000).toISOString() // 11시
            });
            
            locations.push({
                latitude: 37.501610,  // 요양원 복귀
                longitude: 127.148037,
                registrationDateTime: new Date(outTime.getTime() + 70 * 60 * 1000).toISOString() // 11시 10분
            });
            
            console.log('🏥 김정석 외출 데이터 생성 완료:', locations.length + '개 위치');
            return locations;
        }
        
        const scenario = this.scenarios[this.currentScenario];
        const resident = scenario.data.residents.find(r => r.wardedUserId === wardedUserId);
        
        if (!resident) return [];
        
        // 외출 시나리오인 경우 여러 위치 데이터 생성
        if (this.currentScenario === 'outing' && resident.outing === '무단외출 감지') {
            const locations = [];
            const now = new Date();
            
            for (let i = 0; i < 10; i++) {
                const time = new Date(now.getTime() - (i * 5 * 60 * 1000)); // 5분 간격
                locations.push({
                    latitude: 37.501610 + (Math.random() - 0.5) * 0.005,
                    longitude: 127.148037 + (Math.random() - 0.5) * 0.005,
                    registrationDateTime: time.toISOString()
                });
            }
            
            return locations;
        }
        
        return [{
            latitude: 37.501610,
            longitude: 127.148037,
            registrationDateTime: new Date().toISOString()
        }];
    }
    
    // 수면질 파싱
    parseSleepQuality(sleepText) {
        const score = parseInt(sleepText.match(/\d+/)?.[0] || 50);
        
        if (score >= 70) {
            return {
                deepSleep: 120 + Math.floor(Math.random() * 60),
                lightSleep: 180 + Math.floor(Math.random() * 60),
                awakeCount: Math.floor(Math.random() * 3),
                score: score
            };
        } else if (score >= 40) {
            return {
                deepSleep: 60 + Math.floor(Math.random() * 60),
                lightSleep: 200 + Math.floor(Math.random() * 60),
                awakeCount: 3 + Math.floor(Math.random() * 5),
                score: score
            };
        } else {
            return {
                deepSleep: Math.floor(Math.random() * 30),
                lightSleep: 100 + Math.floor(Math.random() * 100),
                awakeCount: 8 + Math.floor(Math.random() * 8),
                score: score
            };
        }
    }
    
    // 데모 데이터 업데이트
    updateDemoData() {
        // 현재 시나리오의 데이터로 전역 변수 업데이트
        const scenario = this.scenarios[this.currentScenario];
        
        // wardedUsers 업데이트
        if (window.wardedUsers) {
            window.wardedUsers = scenario.data.residents.map(r => ({
                wardedUserId: r.wardedUserId,
                userName: r.userName,
                age: r.age,
                profileUrl: `assets/status_${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')}.png`,
                room: r.room
            }));
        }
    }
    
    // 초기화
    initializeDemo() {
        // URL 파라미터에서 초기 시나리오 확인
        const urlParams = new URLSearchParams(window.location.search);
        const initialScenario = urlParams.get('scenario') || 'normal';
        
        // 페이지 로드 완료 후 시나리오만 설정 (렌더링은 script.js에서 자동으로 함)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setScenario(initialScenario);
            });
        } else {
            this.setScenario(initialScenario);
        }
        
        // record.html 페이지인 경우 추가 초기화
        if (window.location.pathname.includes('record.html')) {
            this.initializeRecordPage();
        }
        
        // 실시간 데이터 변동 시뮬레이션 시작
        this.startRealTimeSimulation();
    }
    
    // 실시간 데이터 변동 시뮬레이션
    startRealTimeSimulation() {
        // 10초마다 심박수 변동
        this.heartRateInterval = setInterval(() => {
            if (this.currentScenario === 'normal') {
                this.simulateHeartRateFluctuation();
            }
        }, 10000);
        
        // 1분마다 혈압, SpO2, 체온, 상태 변동
        this.vitalSignsInterval = setInterval(() => {
            if (this.currentScenario === 'normal') {
                this.simulateVitalSignsFluctuation();
                this.simulateStatusFluctuation();
            }
        }, 60000); // 1분마다
    }
    
    // 심박수 변동 시뮬레이션 (10초마다)
    simulateHeartRateFluctuation() {
        const scenario = this.scenarios[this.currentScenario];
        if (!scenario || !scenario.data || !scenario.data.residents) return;
        
        // 각 입소자의 심박수만 변동
        scenario.data.residents.forEach((resident, index) => {
            // 기준값이 있으면 그것을 중심으로 변동
            const baseline = this.baselineData ? this.baselineData[index].hr : resident.hr;
            
            // 심박수 변동 (기준값 ±5 범위)
            const variation = Math.floor(Math.random() * 11) - 5;
            resident.hr = Math.max(60, Math.min(100, baseline + variation));
            
            // 걸음수 증가 (활동 중인 경우)
            if (resident.status === '일상생활' || resident.status === '운동') {
                const steps = Math.floor(Math.random() * 100);
                if (!resident.steps) resident.steps = 0;
                resident.steps += steps;
            }
        });
        
        // 화면 업데이트
        this.updateDisplay();
        console.log('💓 심박수 업데이트 (10초)');
    }
    
    // 혈압, SpO2, 체온 변동 시뮬레이션 (1분마다)
    simulateVitalSignsFluctuation() {
        const scenario = this.scenarios[this.currentScenario];
        if (!scenario || !scenario.data || !scenario.data.residents) return;
        
        scenario.data.residents.forEach((resident, index) => {
            const baseline = this.baselineData ? this.baselineData[index] : resident;
            
            // 체온 변동 (기준값 ±0.2 범위)
            const tempVariation = (Math.random() * 0.4 - 0.2);
            resident.temp = parseFloat((parseFloat(baseline.temp) + tempVariation).toFixed(1));
            resident.temp = Math.max(36.0, Math.min(37.5, resident.temp));
            
            // 혈압 변동 (기준값 ±5 범위)
            const [baseSystolic, baseDiastolic] = baseline.bp.split('/').map(v => parseInt(v));
            const systolicVariation = Math.floor(Math.random() * 11) - 5;
            const diastolicVariation = Math.floor(Math.random() * 7) - 3;
            const newSystolic = Math.max(100, Math.min(140, baseSystolic + systolicVariation));
            const newDiastolic = Math.max(60, Math.min(90, baseDiastolic + diastolicVariation));
            resident.bp = `${newSystolic}/${newDiastolic}`;
            
            // 산소포화도 변동 (기준값 ±2 범위)
            const spo2Variation = Math.floor(Math.random() * 5) - 2;
            resident.spo2 = Math.max(94, Math.min(100, baseline.spo2 + spo2Variation));
        });
        
        // 화면 업데이트
        this.updateDisplay();
        console.log('🌡️ 혈압/체온/SpO2 업데이트 (1분)');
    }
    
    // 상태 변동 시뮬레이션 (1분마다)
    simulateStatusFluctuation() {
        const scenario = this.scenarios[this.currentScenario];
        if (!scenario || !scenario.data || !scenario.data.residents) return;
        
        // 상태 랜덤 선택 함수
        const getRandomStatus = () => {
            const statuses = ['일상생활', '운동', '이동', '수면'];
            const weights = [50, 15, 10, 25]; // 가중치 (확인중 제거, 수면 비중 증가)
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < statuses.length; i++) {
                random -= weights[i];
                if (random <= 0) return statuses[i];
            }
            return '일상생활';
        };
        
        // 각 입소자의 상태를 랜덤하게 변경 (30% 확률로만 변경)
        scenario.data.residents.forEach((resident) => {
            if (Math.random() < 0.3) { // 30% 확률로 상태 변경
                const newStatus = getRandomStatus();
                if (resident.status !== newStatus) {
                    console.log(`📊 ${resident.userName}의 상태 변경: ${resident.status} → ${newStatus}`);
                    resident.status = newStatus;
                }
            }
        });
        
        // 화면 업데이트
        this.updateDisplay();
        console.log('🔄 상태 업데이트 (1분)');
    }
    
    // 화면 업데이트 헬퍼 함수
    updateDisplay() {
        // 화면 업데이트
        if (window.location.pathname.includes('dashboard.html')) {
            if (typeof renderResidentTable === 'function') {
                renderResidentTable();
            }
        }
        
        // 마지막 업데이트 시간 표시
        const lastRefreshEl = document.querySelector('.last-refresh');
        if (lastRefreshEl) {
            lastRefreshEl.textContent = '방금 전 refresh';
        }
    }
    
    // 정리 함수
    cleanup() {
        // 시뮬레이션 인터벌 정리
        if (this.heartRateInterval) {
            clearInterval(this.heartRateInterval);
        }
        if (this.vitalSignsInterval) {
            clearInterval(this.vitalSignsInterval);
        }
    }
    
    // record.html 페이지 초기화
    initializeRecordPage() {
        console.log('🎭 record.html 데모 모드 초기화');
        
        // fetchRecordData 오버라이드를 위해 잠시 대기
        const overrideRecordFunctions = () => {
            if (window.fetchRecordData) {
                this.originalFunctions.fetchRecordData = window.fetchRecordData;
                window.fetchRecordData = async () => {
                    return this.getDemoRecordData();
                };
                console.log('✅ record.html 데모 데이터 오버라이드 완료');
                
                // 자동 업데이트 제거 - 사용자가 수동으로 새로고침하도록 함
                // (자동 업데이트 시 항상 첫 번째 리스트로 돌아가는 문제 방지)
            } else {
                // 함수가 아직 로드되지 않았으면 재시도
                setTimeout(overrideRecordFunctions, 100);
            }
        };
        
        // 페이지 로드 후 오버라이드 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', overrideRecordFunctions);
        } else {
            overrideRecordFunctions();
        }
    }
    
    // 데모용 레코드 데이터 생성
    getDemoRecordData() {
        const scenario = this.scenarios[this.currentScenario];
        const events = scenario.data.events || [];
        const residents = scenario.data.residents;
        
        // 기본 레코드 데이터 구조
        const recordData = {
            unconfirmed: [],
            confirmed: [],
            resolved: []
        };
        
        // 현재 시간 기준으로 이벤트 상태 결정
        const now = Date.now();
        const eventStartTime = this.eventStartTime || now;
        const elapsedSeconds = Math.floor((now - eventStartTime) / 1000);
        
        // 이벤트 처리 시뮬레이션 헬퍼 함수
        const processEvent = (eventData, confirmAfter = 30, resolveAfter = 90, staffName = "김간호사") => {
            // 시나리오별 답변 메시지
            const getStaffMessages = (scenario) => {
                const messages = {
                    vitals: {
                        confirm: "고열 확인했습니다. 해열제 준비하고 즉시 방문하겠습니다.",
                        resolve: "해열제 투약 완료. 체온 37.2°C로 안정되었습니다. 30분마다 모니터링 중입니다."
                    },
                    fall: {
                        confirm: "낙상 확인했습니다. 응급키트 가지고 즉시 출동합니다.",
                        resolve: "외상 처치 완료. 혈압 정상화(110/70). 보행기 지원 중입니다."
                    },
                    outing: {
                        confirm: "무단외출 확인. 현재 위치 추적 중이며 즉시 출동합니다.",
                        resolve: "안전하게 모시고 왔습니다. 건강 체크 완료. 향후 GPS 모니터링 강화합니다."
                    },
                    sleep: {
                        confirm: "수면 이상 확인했습니다. 수면 환경 점검하러 가겠습니다.",
                        resolve: "수면 환경 개선 완료. 조명 조절, 소음 차단 조치했습니다."
                    },
                    emergency: {
                        confirm: "응급상황! CPR 준비하고 119 신고 완료. AED 가지고 달려갑니다.",
                        resolve: "응급처치 완료. 의식 회복, 생체신호 정상화. 병원 이송 준비 중입니다."
                    }
                };
                return messages[scenario] || messages.vitals;
            };
            
            const staffMessages = getStaffMessages(this.currentScenario);
            
            if (elapsedSeconds < confirmAfter) {
                // 30초 이전: 미확인 상태
                recordData.unconfirmed.push(eventData);
            } else if (elapsedSeconds < resolveAfter) {
                // 30-90초: 확인중 상태
                eventData.right = `${Math.floor(elapsedSeconds)}초 전`;
                eventData.staffReply = {
                    time: new Date(eventStartTime + confirmAfter * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}),
                    name: staffName,
                    message: staffMessages.confirm
                };
                recordData.confirmed.push(eventData);
            } else {
                // 90초 이후: 해결 완료
                eventData.right = `${Math.floor(elapsedSeconds / 60)}분 전`;
                eventData.staffReply = {
                    time: new Date(eventStartTime + confirmAfter * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}),
                    name: staffName,
                    message: staffMessages.confirm
                };
                eventData.resolution = {
                    time: new Date(eventStartTime + resolveAfter * 1000).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}),
                    name: staffName,
                    message: staffMessages.resolve
                };
                recordData.resolved.push(eventData);
            }
            return eventData;
        };
        
        // 시나리오별 레코드 생성
        switch(this.currentScenario) {
            case 'vitals':
                // 생체이상 시나리오 - 김순자 할머니 고열 감지
                processEvent({
                    time: "02:15",
                    img: "assets/status_02.png",
                    name: "김순자",
                    title: "고열 및 높은 심박수 감지",
                    desc: "체온 38.2°C, 심박수 125bpm. 감염 의심, 즉시 확인 필요",
                    right: "방금 전",
                    timestamp: new Date().toISOString(),
                    eventId: 'demo_vitals_001',
                    wardedUserId: 'ward002',
                    detail: {
                        msg: "체온이 38.2°C로 높고 심박수가 125bpm으로 비정상적으로 높습니다. 감염이 의심되니 즉시 확인이 필요합니다.",
                        caller: "김순자",
                        location: "요양원 101호실",
                        map: "assets/map_101.png",
                        vitals: [
                            { label: '체온', value: '38.2°C', time: '방금 전', status: 'danger' },
                            { label: '심박수', value: '125 bpm', time: '방금 전', status: 'danger' },
                            { label: '혈압', value: '150/95', time: '5분 전', status: 'warning' },
                            { label: '산소포화도', value: '94%', time: '10분 전', status: 'warning' }
                        ]
                    }
                });
                break;
                
            case 'fall':
                // 낙상 시나리오 - 김정석 할아버지 낙상
                processEvent({
                    time: "03:07",
                    img: "assets/status_04.png",
                    name: "김정석",
                    title: "낙상이 스마트워치로 확인 되었습니다.",
                    desc: "1층 화장실에서 낙상 감지. 저혈압(85/50) 확인",
                    right: "방금 전",
                    timestamp: new Date().toISOString(),
                    eventId: 'demo_fall_001',
                    wardedUserId: 'ward004',
                    detail: {
                        msg: "스마트워치에서 낙상 신호가 감지되었습니다. 1층 화장실에서 넘어지신 것으로 확인됩니다.",
                        caller: "김정석",
                        location: "1층 화장실",
                        map: "assets/map_101.png",
                        vitals: [
                            { label: '혈압', value: '85/50', time: '방금 전', status: 'danger' },
                            { label: '심박수', value: '95 bpm', time: '방금 전', status: 'warning' },
                            { label: '체온', value: '36.3°C', time: '10분 전' },
                            { label: '산소포화도', value: '98%', time: '10분 전' }
                        ]
                    }
                });
                break;
                
            case 'outing':
                // 무단외출 시나리오 - 최영자 할머니
                processEvent({
                    time: "04:23",
                    img: "assets/status_03.png",
                    name: "최영자",
                    title: "무단외출 감지",
                    desc: "치매 어르신이 새벽에 무단외출. 서울 송파구 마천동 7 위치",
                    right: "5분 전",
                    timestamp: new Date().toISOString(),
                    eventId: 'demo_outing_001',
                    wardedUserId: 'ward003',
                    detail: {
                        msg: "치매 증상이 있는 최영자 어르신이 새벽 4시에 무단외출하셨습니다. 현재 서울 송파구 마천동 7 (세븐일레븐 마천파크점)에 계신 것으로 확인됩니다.",
                        caller: "최영자",
                        location: "서울 송파구 마천동 7",
                        map: "assets/map_101.png",
                        vitals: [
                            { label: '심박수', value: '88 bpm', time: '방금 전', status: 'warning' },
                            { label: '걸음수', value: '523', time: '최근 30분' },
                            { label: '이동거리', value: '200m', time: '최근 30분' },
                            { label: '현재위치', value: '편의점', time: '방금 전', status: 'danger' }
                        ]
                    }
                });
                break;
                
            case 'sleep':
                // 수면이상 시나리오 - 이경숙 할머니
                processEvent({
                    time: "05:30",
                    img: "assets/status_05.png",
                    name: "이경숙",
                    title: "수면 이상 패턴 감지",
                    desc: "수면질 불량(15점) - 깊은수면 0분, 12회 깸. 낙상위험 85%",
                    right: "30분 전",
                    timestamp: new Date().toISOString(),
                    eventId: 'demo_sleep_001',
                    wardedUserId: 'ward005',
                    detail: {
                        msg: "이경숙 어르신의 수면 패턴이 매우 불량합니다. 깊은 수면이 전혀 없고 12회나 깨셨습니다. 낙상 위험이 85%로 매우 높습니다.",
                        caller: "이경숙",
                        location: "102호실",
                        map: "assets/map_101.png",
                        vitals: [
                            { label: '수면점수', value: '15점', time: '오늘 밤', status: 'danger' },
                            { label: '깊은수면', value: '0분', time: '오늘 밤', status: 'danger' },
                            { label: '얕은수면', value: '180분', time: '오늘 밤' },
                            { label: '깬 횟수', value: '12회', time: '오늘 밤', status: 'danger' },
                            { label: '낙상위험도', value: '85%', time: '예측', status: 'danger' }
                        ]
                    }
                });
                break;
                
            case 'emergency':
                // 응급상황 시나리오 - 김영수 할아버지
                processEvent({
                    time: "06:45",
                    img: "assets/status_01.png",
                    name: "김영수",
                    title: "🆘 응급상황 - 심정지 의심",
                    desc: "심박수 0, 활동없음 3분. 119 자동신고 완료",
                    right: "긴급",
                    timestamp: new Date().toISOString(),
                    eventId: 'demo_emergency_001',
                    wardedUserId: 'ward001',
                    detail: {
                        msg: "김영수 어르신의 심박수가 감지되지 않고 3분간 활동이 없습니다. 119에 자동 신고되었습니다. AED는 1층 복도에 있습니다.",
                        caller: "김영수",
                        location: "101호실",
                        map: "assets/map_101.png",
                        vitals: [
                            { label: '심박수', value: '미감지', time: '3분 전', status: 'danger' },
                            { label: '활동상태', value: '없음', time: '3분 전', status: 'danger' },
                            { label: '119 신고', value: '완료', time: '2분 전', status: 'info' },
                            { label: 'AED 위치', value: '1층 복도', time: '안내', status: 'info' }
                        ]
                    }
                });
                break;
                
            default:
                // 평상시 - 이벤트 없음
                break;
        }
        
        // wardedUsers 데이터 설정 (record.html에서도 필요)
        if (!window.wardedUsers || window.wardedUsers.length === 0) {
            window.wardedUsers = residents.map(r => ({
                wardedUserId: r.wardedUserId,
                userName: r.userName,
                age: r.age,
                profileUrl: `assets/status_${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')}.png`,
                room: r.room
            }));
        }
        
        return recordData;
    }
}

// 데모 모드 활성화 확인 및 초기화
if (new URLSearchParams(window.location.search).get('demo') === 'true') {
    window.demoController = new DemoController();
    console.log('✅ 데모 컨트롤러 로드 완료');
}
