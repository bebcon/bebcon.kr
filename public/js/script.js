/**
 * [수정] 터치, 썸네일, 슬라이드 애니메이션을 지원하는 슬라이더 클래스
 * - effect: 'slide' (가로이동) 또는 'fade' (기본값) 선택 가능
 */
class TouchSlider {
    constructor(container, options = {}) {
        this.container = container;
        // 옵션 설정
        this.itemSelector = options.itemSelector || '.slide-item';
        this.activeClass = options.activeClass || 'active';
        this.intervalTime = options.intervalTime || 3000;
        this.autoplay = options.autoplay !== false; // 기본값 true
        this.enableTouch = options.enableTouch !== false; // 기본값 true
        this.effect = options.effect || 'fade'; // 'fade' or 'slide'
        this.onSlideChange = options.onSlideChange || null; // 슬라이드 변경 시 콜백

        // DOM 요소
        this.slides = Array.from(this.container.querySelectorAll(this.itemSelector));
        // 슬라이드 효과일 경우 트랙(부모) 요소가 필요
        this.track = this.slides.length > 0 ? this.slides[0].parentElement : null;

        this.prevBtn = this.container.querySelector(options.prevBtnSelector || '.prev-slide');
        this.nextBtn = this.container.querySelector(options.nextBtnSelector || '.next-slide');
        this.pauseBtn = this.container.querySelector(options.pauseBtnSelector || '#pause-btn');
        this.counter = this.container.querySelector(options.counterSelector || '.slide-counter');
        
        // 썸네일 관련
        this.thumbnailContainer = options.thumbnailContainer || null;
        this.thumbnails = [];

        // 상태 변수
        this.currentIndex = 0;
        this.timer = null;
        this.isPaused = false;
        this.touchStartX = 0;
        this.touchEndX = 0;

        this.init();
    }

    init() {
        if (this.slides.length === 0) return;

        // 1. 초기 화면 표시
        this.show(0);

        // 2. 버튼 이벤트 바인딩
        if (this.prevBtn) this.prevBtn.addEventListener('click', (e) => { e.preventDefault(); this.prev(); this.resetTimer(); });
        if (this.nextBtn) this.nextBtn.addEventListener('click', (e) => { e.preventDefault(); this.next(); this.resetTimer(); });
        
        // 3. 일시정지/재생 버튼
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAutoPlay();
            });
        }

        // 4. 터치 스와이프 이벤트 (모바일)
        if (this.enableTouch) {
            this.container.addEventListener('touchstart', (e) => {
                this.touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            this.container.addEventListener('touchend', (e) => {
                this.touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe();
            }, { passive: true });
        }

        // 5. 썸네일 초기화
        if (this.thumbnailContainer) {
            this.initThumbnails();
        }

        // 6. 자동 재생 시작
        if (this.autoplay) {
            this.startAuto();
        }
    }

    initThumbnails() {
        // 기존 썸네일 비우기
        this.thumbnailContainer.innerHTML = '';
        this.slides.forEach((slide, index) => {
            // 슬라이드 내부 이미지 소스 가져오기 (img 태그 혹은 bg-image)
            let imgSrc = '';
            const imgTag = slide.querySelector('img');
            if (imgTag) {
                imgSrc = imgTag.src;
            } else {
                // background-image에서 url 추출
                const bgImage = window.getComputedStyle(slide).backgroundImage;
                if (bgImage && bgImage !== 'none') {
                    imgSrc = bgImage.replace(/url\((['"])?(.*?)\1\)/gi, '$2');
                }
            }

            const thumb = document.createElement('div');
            thumb.className = 'slider-thumbnail';
            if (index === 0) thumb.classList.add('active');
            
            // 썸네일 이미지 요소
            const thumbImg = document.createElement('img');
            thumbImg.src = imgSrc;
            thumb.appendChild(thumbImg);

            thumb.addEventListener('click', () => {
                this.show(index);
                this.resetTimer();
            });

            this.thumbnailContainer.appendChild(thumb);
            this.thumbnails.push(thumb);
        });
    }

    show(index) {
        // 인덱스 보정
        if (index < 0) index = this.slides.length - 1;
        if (index >= this.slides.length) index = 0;
        
        this.currentIndex = index;

        // 슬라이드 효과 처리
        if (this.effect === 'slide' && this.track) {
            // 가로 슬라이드 이동 (translateX)
            this.track.style.transform = `translateX(-${index * 100}%)`;
            
            // 활성 상태 클래스 관리 (스타일링용)
            this.slides.forEach((slide, i) => {
                slide.classList.toggle(this.activeClass, i === index);
            });
        } else {
            // 기본 페이드/클래스 토글 효과
            this.slides.forEach((slide, i) => {
                if (i === index) {
                    slide.classList.add(this.activeClass);
                    // 메인 배너가 아닌 일반 슬라이더(부동산 등)를 위해 display 처리 유지
                    if (!slide.classList.contains('slide-item')) { 
                        slide.style.display = 'flex'; 
                    } else {
                        slide.style.display = ''; // 메인 배너는 flex 유지
                    }
                } else {
                    slide.classList.remove(this.activeClass);
                    if (!slide.classList.contains('slide-item')) {
                        slide.style.display = 'none';
                    } else {
                        slide.style.display = ''; 
                    }
                }
            });
        }

        // 카운터 업데이트
        if (this.counter) {
            this.counter.textContent = `${index + 1} / ${this.slides.length}`;
        }

        // 썸네일 활성화 업데이트
        if (this.thumbnails.length > 0) {
            this.thumbnails.forEach((t, i) => {
                t.classList.toggle('active', i === index);
                if (i === index) {
                    // 활성 썸네일이 보이도록 스크롤 조정
                    t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            });
        }

        // 콜백 실행
        if (this.onSlideChange) this.onSlideChange(index);
    }

    next() {
        this.show(this.currentIndex + 1);
    }

    prev() {
        this.show(this.currentIndex - 1);
    }

    startAuto() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.next(), this.intervalTime);
        if (this.pauseBtn) this.pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        this.isPaused = false;
    }

    stopAuto() {
        clearInterval(this.timer);
        this.timer = null;
        if (this.pauseBtn) this.pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        this.isPaused = true;
    }

    toggleAutoPlay() {
        if (this.isPaused) this.startAuto();
        else this.stopAuto();
    }

    resetTimer() {
        if (this.autoplay && !this.isPaused) {
            this.stopAuto();
            this.startAuto();
        }
    }

    handleSwipe() {
        const threshold = 50; // 스와이프 인식 최소 거리
        if (this.touchEndX < this.touchStartX - threshold) {
            this.next(); // 왼쪽으로 밀면 다음 슬라이드
            this.resetTimer();
        }
        if (this.touchEndX > this.touchStartX + threshold) {
            this.prev(); // 오른쪽으로 밀면 이전 슬라이드
            this.resetTimer();
        }
    }
}

// --- [기존] 유틸리티 함수들 ---

function showToast(message, type = 'info') {
    const bgColor = type === 'success' ? '#00A886' : (type === 'error' ? '#e74c3c' : '#1A447A');
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "center",
            stopOnFocus: true,
            style: { background: bgColor, borderRadius: "8px" }
        }).showToast();
    } else {
        console.log(`[Toast] ${type}: ${message}`);
    }
}

function renderPagination(totalPages, currentPage, container, pageClickCallback) {
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const pageGroupSize = 5;
    const currentGroup = Math.ceil(currentPage / pageGroupSize);

    let startPage = (currentGroup - 1) * pageGroupSize + 1;
    let endPage = Math.min(startPage + pageGroupSize - 1, totalPages);

    // '처음' 버튼
    const firstButton = document.createElement('button');
    firstButton.innerHTML = '<i class="fa-solid fa-angles-left"></i>';
    firstButton.className = 'page-link';
    if (currentPage === 1) firstButton.disabled = true;
    firstButton.addEventListener('click', () => pageClickCallback(1));
    container.appendChild(firstButton);
    
    // '이전' 버튼
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
    prevButton.className = 'page-link';
    if (currentPage === 1) prevButton.disabled = true;
    prevButton.addEventListener('click', () => pageClickCallback(currentPage - 1));
    container.appendChild(prevButton);

    // 페이지 번호 버튼
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = 'page-link';
        if (i === currentPage) {
            pageButton.classList.add('active');
            pageButton.disabled = true;
        }
        pageButton.addEventListener('click', () => pageClickCallback(i));
        container.appendChild(pageButton);
    }

    // '다음' 버튼
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
    nextButton.className = 'page-link';
    if (currentPage === totalPages) nextButton.disabled = true;
    nextButton.addEventListener('click', () => pageClickCallback(currentPage + 1));
    container.appendChild(nextButton);
    
    // '마지막' 버튼
    const lastButton = document.createElement('button');
    lastButton.innerHTML = '<i class="fa-solid fa-angles-right"></i>';
    lastButton.className = 'page-link';
    if (currentPage === totalPages) lastButton.disabled = true;
    lastButton.addEventListener('click', () => pageClickCallback(totalPages));
    container.appendChild(lastButton);
}

function autocomplete(inp, arr) {
    let currentFocus;
    inp.addEventListener("input", function(e) {
        let a, b, i, val = this.value;
        closeAllLists();
        if (!val) { return false; }
        currentFocus = -1;
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        this.parentNode.appendChild(a);
        for (i = 0; i < arr.length; i++) {
            const matchPos = arr[i].toUpperCase().indexOf(val.toUpperCase());
            if (matchPos > -1) {
                b = document.createElement("DIV");
                const part1 = arr[i].substring(0, matchPos);
                const matchedPart = arr[i].substring(matchPos, matchPos + val.length);
                const part2 = arr[i].substring(matchPos + val.length);
                b.innerHTML = part1 + "<strong>" + matchedPart + "</strong>" + part2;
                
                b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
                b.addEventListener("click", function(e) {
                    inp.value = this.getElementsByTagName("input")[0].value;
                    closeAllLists();
                    const form = inp.closest('form');
                    if (form) {
                        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                });
                a.appendChild(b);
            }
        }
    });
    inp.addEventListener("keydown", function(e) {
        let x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) { // 아래쪽 화살표
            currentFocus++;
            addActive(x);
        } else if (e.keyCode == 38) { // 위쪽 화살표
            currentFocus--;
            addActive(x);
        } else if (e.keyCode == 13) { // 엔터
            e.preventDefault();
            if (currentFocus > -1) {
                if (x) x[currentFocus].click();
            }
            const form = inp.closest('form');
            if (form) {
                form.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        }
    });
    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("autocomplete-active");
    }
    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }
    function closeAllLists(elmnt) {
        const x = document.getElementsByClassName("autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('안현민국 홈페이지 스크립트 로드 완료.');

    // --- [수정] 공통 변수 (사용자 역할 정보 추가) ---
    const loggedInUser = localStorage.getItem('loggedInUser');
    const loggedInRealName = localStorage.getItem('loggedInRealName');
    const userRole = localStorage.getItem('userRole') || 'user'; // 기본값 'user'

    // --- 공통: 페이지 상단 환영 메시지 표시 ---
    const welcomeSection = document.getElementById('user-welcome-section');
    if (loggedInUser && loggedInRealName && welcomeSection) {
        document.getElementById('welcome-message').innerHTML = `<i class="fa-solid fa-quote-left fa-fade" style="--fa-animation-duration: 1.5s; --fa-fade-opacity: 0.5;"></i>⠀${loggedInRealName} 님, 좋은 하루 보내고 계신가요?⠀<i class="fa-solid fa-quote-right fa-fade" style="--fa-animation-duration: 1.5s; --fa-fade-opacity: 0.5;"></i>`;
        
        // [수정] 접속 중인 계정의 역할 표시 추가
        let roleBadge = '';
        if (userRole === 'admin') roleBadge = '<span style="color:red; font-weight:bold;">[관리자]</span> ';
        else if (userRole === 'realtor') roleBadge = '<span style="color:green; font-weight:bold;">[중개사]</span> ';
        else if (userRole === 'reporter') roleBadge = '<span style="color:blue; font-weight:bold;">[기자]</span> ';

        document.getElementById('login-status-info').innerHTML = `<i class="fa-solid fa-circle-user fa-flip" style="--fa-animation-duration: 3s;"></i>⠀${roleBadge}${loggedInUser} 아이디로 접속 중입니다`;
        welcomeSection.style.display = 'block';
    }

    // --- 공통: 로그인 상태 UI 처리 ---
    function checkLoginStatus() {
        const headerAuthStatus = document.getElementById('header-auth-status');
        if (!headerAuthStatus) return;
        
        const path = window.location.pathname;

        if (loggedInUser) {
            headerAuthStatus.innerHTML = `<a href="/mypage">마이페이지</a><span style="color: #ccc; margin: 0 5px;">|<a href="#" id="logout-button">로그아웃</a>`;
            
            document.getElementById('logout-button').addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('loggedInUser');
                localStorage.removeItem('loggedInRealName');
                localStorage.removeItem('userRole'); // [추가] 역할 정보 삭제
                showToast('로그아웃 되었습니다.');
                setTimeout(() => {
                    if (['/mypage', '/complaints', '/write-news', '/edit-news', '/write-post', '/image-hosting', '/write-realty'].some(p => path.includes(p))) {
                        window.location.href = '/';
                    } else {
                        window.location.reload();
                    }
                }, 500);
            });
        } else {
            if (path.includes('/login')) {
                 headerAuthStatus.innerHTML = `<a href="/signup">회원가입</a>`;
            } else if (path.includes('/signup')) {
                 headerAuthStatus.innerHTML = `<a href="/login">로그인</a>`;
            } else {
                 headerAuthStatus.innerHTML = `<a href="/login">로그인</a><span style="color: #ccc; margin: 0 5px;">|<a href="/signup">회원가입</a>`;
            }
        }
    }
    checkLoginStatus();

    // --- 알림 센터 기능 ---
    const notificationCenter = document.getElementById('notification-center');
    if (notificationCenter && loggedInUser) {
        notificationCenter.classList.remove('hidden');

        const badge = document.getElementById('notification-badge');
        const dropdown = document.getElementById('notification-dropdown');
        const list = document.getElementById('notification-list');
        
        const notificationHeader = dropdown.querySelector('.notification-header');
        if (notificationHeader) {
            notificationHeader.innerHTML = `
                <h5>알림</h5>
                <div class="notification-actions">
                    <button class="read-all-btn" id="read-all-btn">모두 읽음</button>
                    <button class="delete-all-btn" id="delete-all-btn">모두 삭제</button>
                </div>
            `;
        }

        const readAllBtn = document.getElementById('read-all-btn');
        const deleteAllBtn = document.getElementById('delete-all-btn');

        async function loadNotifications() {
            try {
                const response = await fetch(`/api/notifications/my?username=${loggedInUser}`);
                if (!response.ok) throw new Error('Failed to fetch');
                const { data, unreadCount } = await response.json();

                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }

                list.innerHTML = '';
                if (data.length === 0) {
                    list.innerHTML = '<li class="notification-empty">새로운 알림이 없습니다.</li>';
                } else {
                    data.forEach(n => {
                        const li = document.createElement('li');
                        const itemClass = n.isRead ? 'notification-item' : 'notification-item unread';
                        
                        li.innerHTML = `
                            <a href="${n.link}" class="${itemClass}" data-id="${n.id}">
                                <div class="notification-text">${n.message}</div>
                                <span class="notification-time">${new Date(n.createdAt).toLocaleString()}</span>
                            </a>
                        `;
                        list.appendChild(li);
                    });
                }
            } catch (error) {
                console.error('알림 로딩 실패:', error);
            }
        }

        loadNotifications();
        setInterval(loadNotifications, 60000);

        notificationCenter.addEventListener('click', (e) => {
            if(e.target.closest('.notification-dropdown')) return;
            dropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!notificationCenter.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        list.addEventListener('click', async (e) => {
            const itemLink = e.target.closest('a.notification-item');
            if (!itemLink) return;
            
            e.preventDefault();
            const linkUrl = itemLink.getAttribute('href');
            const notiId = itemLink.dataset.id;

            if (!itemLink.classList.contains('unread')) {
                window.location.href = linkUrl;
                return;
            }

            try {
                await fetch(`/api/notifications/${notiId}/read`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loggedInUser })
                });
                window.location.href = linkUrl;
            } catch (error) {
                console.error('알림 읽음 처리 실패:', error);
                window.location.href = linkUrl;
            }
        });

        if (readAllBtn) {
            readAllBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); 
                try {
                    const response = await fetch('/api/notifications/read-all', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUser })
                    });
                    if (response.ok) {
                        loadNotifications();
                    }
                } catch (error) {
                    console.error('모두 읽음 처리 실패:', error);
                }
            });
        }

        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('모든 알림을 삭제하시겠습니까?')) return;
                try {
                    const response = await fetch('/api/notifications/delete-all', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUser })
                    });
                    if (response.ok) {
                        loadNotifications();
                        showToast('모든 알림이 삭제되었습니다.', 'success');
                    }
                } catch (error) {
                    console.error('모두 삭제 처리 실패:', error);
                    showToast('알림 삭제 중 오류가 발생했습니다.', 'error');
                }
            });
        }
    }


    // --- 메인 페이지 통합 검색창 기능 ---
    const integratedSearchForm = document.getElementById('integrated-search-form');
    if (integratedSearchForm) {
        integratedSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = document.getElementById('integrated-search-input');
            const query = searchInput.value.trim();
            
            if (!query) {
                showToast('검색어를 입력해주세요.', 'error');
                return;
            }
            
            window.location.href = `/search-result.html?q=${encodeURIComponent(query)}`;
        });
    }

    // --- introduction.html 주소 복사 기능 ---
    const copyAddressBtn = document.getElementById('copy-address-btn');
    if (copyAddressBtn) {
        copyAddressBtn.addEventListener('click', () => {
            const addressInput = document.getElementById('server-address-input');
            addressInput.select();
            addressInput.setSelectionRange(0, 99999); 
            
            try {
                navigator.clipboard.writeText(addressInput.value).then(() => {
                    showToast('서버 주소가 복사되었습니다.', 'success');
                }, () => {
                    document.execCommand('copy');
                    showToast('서버 주소가 복사되었습니다.', 'success');
                });
            } catch (err) {
                try {
                    document.execCommand('copy');
                    showToast('서버 주소가 복사되었습니다.', 'success');
                } catch (copyErr) {
                    showToast('주소 복사에 실패했습니다.', 'error');
                    console.error('Fallback: Oops, unable to copy', copyErr);
                }
            }
        });
    }

        // --- index.html 전용 기능들 (TouchSlider 적용됨) ---
        const mainBanner = document.querySelector('.main-banner');

        // ✅ 메인 전용 JS(home.js)를 쓰는 경우, 공용 script.js의 메인 로직은 실행하지 않음
        if (mainBanner && !window.__HOME_JS_ACTIVE__) {
            try {
                // 1) 메인 배너 슬라이더
                new TouchSlider(mainBanner, {
                    itemSelector: '.slide-item',
                    prevBtnSelector: '#prev-slide',
                    nextBtnSelector: '#next-slide',
                    pauseBtnSelector: '#pause-btn',
                    counterSelector: '#slide-counter',
                    activeClass: 'active',
                    intervalTime: 2750,
                    autoplay: true,
                    enableTouch: true,
                    effect: 'slide'
                });

                // 2) 탭 전환 (전역 document 조작 금지: 탭 섹션 내부만)
                const tabSection = document.querySelector('.tab-section');
                const tabNav = tabSection ? tabSection.querySelector('.tab-nav') : null;

                if (tabNav) {
                    tabNav.addEventListener('click', (e) => {
                        const btn = e.target.closest('.tab-button');
                        if (!btn) return;

                        const tabId = btn.dataset.tab;
                        tabNav.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        tabSection.querySelectorAll('.tab-pane').forEach(pane => {
                            pane.classList.toggle('active', pane.id === tabId);
                        });
                    });
                }

                // 3) 뉴스(최신/인기) 로딩
                const latestNewsList = document.getElementById('latest-news-list');
                const popularNewsList = document.getElementById('popular-news-list');

                if (latestNewsList && popularNewsList) {
                    fetch('/api/news?page=1&limit=9')
                        .then(res => res.json())
                        .then(response => {
                            const news = response.data || [];
                            latestNewsList.innerHTML = '';

                            news.slice(0, 9).forEach(article => {
                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <a href="/news/${article.id}" class="list-item-link">
                                        <span class="item-title">${article.title}</span>
                                        <span class="item-meta">${new Date(article.createdAt).toLocaleDateString()}</span>
                                    </a>
                                `;
                                latestNewsList.appendChild(li);
                            });

                            return fetch('/api/news');
                        })
                        .then(res => res.json())
                        .then(fullResponse => {
                            const allNews = fullResponse.data || [];
                            popularNewsList.innerHTML = '';

                            allNews
                                .slice()
                                .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
                                .slice(0, 9)
                                .forEach(article => {
                                    const li = document.createElement('li');
                                    li.innerHTML = `
                                        <a href="/news/${article.id}" class="list-item-link">
                                            <span class="item-title">
                                                <i class="fa-solid fa-fire item-icon-fire"></i> ${article.title}
                                            </span>
                                            <span class="item-meta">
                                                <i class="fa-regular fa-thumbs-up item-icon-thumb"></i> ${article.likes ?? 0}
                                            </span>
                                        </a>
                                    `;
                                    popularNewsList.appendChild(li);
                                });
                        })
                        .catch(err => {
                            console.error('뉴스를 불러오는 데 실패했습니다:', err);
                            latestNewsList.innerHTML = '<li>뉴스를 불러오는 데 실패했습니다.</li>';
                            popularNewsList.innerHTML = '<li>뉴스를 불러오는 데 실패했습니다.</li>';
                        });
                }

                // 4) 커뮤니티 글(최신/인기) 로딩
                const latestPostList = document.getElementById('latest-post-list');
                const popularPostList = document.getElementById('popular-post-list');

                if (latestPostList && popularPostList) {
                    fetch('/api/posts')
                        .then(res => res.json())
                        .then(response => {
                            const allPosts = response.data || [];

                            // 최신
                            latestPostList.innerHTML = '';
                            const latestPosts = allPosts
                                .slice()
                                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                                .slice(0, 9);

                            latestPosts.forEach(post => {
                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <a href="/post/${post.id}" class="list-item-link">
                                        <span class="item-title">${post.title}</span>
                                        <span class="item-meta">${post.author || '익명'}</span>
                                    </a>
                                `;
                                latestPostList.appendChild(li);
                            });

                            // 인기
                            popularPostList.innerHTML = '';
                            const popularPosts = allPosts
                                .slice()
                                .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
                                .slice(0, 9);

                            popularPosts.forEach(post => {
                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <a href="/post/${post.id}" class="list-item-link">
                                        <span class="item-title">
                                            <i class="fa-solid fa-fire item-icon-fire"></i> ${post.title}
                                        </span>
                                        <span class="item-meta">
                                            <i class="fa-regular fa-thumbs-up item-icon-thumb"></i> ${post.likes ?? 0}
                                        </span>
                                    </a>
                                `;
                                popularPostList.appendChild(li);
                            });
                        })
                        .catch(err => {
                            console.error('게시글을 불러오는 데 실패했습니다:', err);
                            if (latestPostList) latestPostList.innerHTML = '<li>게시글을 불러오는 데 실패했습니다.</li>';
                            if (popularPostList) popularPostList.innerHTML = '<li>게시글을 불러오는 데 실패했습니다.</li>';
                        });
                }
            } catch (err) {
                // ✅ 여기서 잡아주면, 메인에서 에러가 나도 다른 페이지 기능까지 죽지 않음
                console.error('메인 페이지 초기화 실패:', err);
            }
        }


    // --- 의견 페이지 (complaints.html) ---
    const complaintFormPage = document.getElementById('civil-complaints-page');
    if(complaintFormPage) {
        const authorInput = document.getElementById('author');
        if (authorInput && loggedInRealName) {
            authorInput.value = loggedInRealName;
        } else if (authorInput) {
            authorInput.placeholder = '로그인 후 이용 가능합니다.';
            authorInput.disabled = true;
        }

        const complaintForm = document.getElementById('complaint-form');
        const complaintsList = document.getElementById('complaints-list');
        const complaintsPagination = document.getElementById('complaints-pagination');
        let currentPage = 1;
        
        async function displayComplaints(page = 1) {
            currentPage = page;
            try {
                const response = await fetch(`/api/complaints?page=${page}`);
                const result = await response.json();
                const { data, totalPages, currentPage } = result;

                complaintsList.innerHTML = '';
                if (data.length === 0) {
                    complaintsList.innerHTML = '<p class="empty-message">제출된 의견이 없습니다.</p>';
                    renderPagination(0, 0, complaintsPagination, displayComplaints);
                    return;
                }
                
                data.forEach(c => {
                    const complaintDiv = document.createElement('div');
                    complaintDiv.className = 'complaint-item';
                    complaintDiv.setAttribute('data-id', c.id);
                    
                    let statusClass = '';
                    let statusText = c.status || '접수 완료';
                    switch (statusText) {
                        case '접수 완료': statusClass = 'status-received'; break;
                        case '검토 중': statusClass = 'status-pending'; break;
                        case '답변 완료': statusClass = 'status-answered'; break;
                        default: statusClass = 'status-received';
                    }

                    const answerHTML = c.answer ? `
                        <div class="complaint-answer">
                            <h5><i class="fa-solid fa-square-check"></i>⠀안현민국 민원실</h5>
                            <p>${c.answer.replace(/\n/g, '<br>')}</p>
                            <small>답변일: ${new Date(c.answeredAt).toLocaleString()}</small>
                        </div>
                    ` : '';
                    
                    // [수정] 작성자 본인 또는 관리자만 수정/삭제 버튼 노출
                    const userControlsHTML = (loggedInUser && (loggedInUser === c.username || userRole === 'admin')) ? `
                        <div class="user-controls">
                            <button class="button-link edit-complaint-btn">수정</button>
                            <button class="button-link delete-complaint-btn">삭제</button>
                        </div>
                    ` : '';

                    // [수정] 관리자 전용 기능 (답변, 상태 변경)
                    const adminControlsHTML = userRole === 'admin' ? `
                        <div class="admin-controls">
                            <div class="admin-controls-header" data-complaint-id="${c.id}">
                                <h5><i class="fa-solid fa-gear"></i>⠀민원 관리</h5>
                                <button class="admin-toggle-btn"><i class="fa-solid fa-chevron-down"></i></button>
                            </div>
                            <div class="admin-controls-content">
                                <div class="status-control">
                                    <label for="status-select-${c.id}">상태 변경:</label>
                                    <select id="status-select-${c.id}" class="status-select" data-complaint-id="${c.id}">
                                        <option value="접수 완료" ${statusText === '접수 완료' ? 'selected' : ''}>접수 완료</option>
                                        <option value="검토 중" ${statusText === '검토 중' ? 'selected' : ''}>검토 중</option>
                                        <option value="답변 완료" ${statusText === '답변 완료' ? 'selected' : ''}>답변 완료</option>
                                    </select>
                                </div>
                                <form class="answer-form" data-complaint-id="${c.id}">
                                    <div class="form-group" style="width: 100%;">
                                        <textarea class="answer-textarea" rows="4" placeholder="답변을 입력하거나 수정하세요...">${c.answer || ''}</textarea>
                                    </div>
                                    <button type="submit" class="button-primary button-small">답변 등록/수정</button>
                                </form>
                            </div>
                        </div>
                    ` : '';

                    complaintDiv.innerHTML = `
                        <div class="complaint-content-wrapper">
                            <div class="complaint-header">
                                <h4>${c.title}</h4>
                                <div class="header-right">
                                     <span class="status-badge ${statusClass}">${statusText}</span>
                                     ${userControlsHTML}
                                </div>
                            </div>
                            <p class="complaint-main-content">${c.content.replace(/\n/g, '<br>')}</p>
                            <small>작성자: ${c.author} | 작성일: ${new Date(c.createdAt).toLocaleString()}</small>
                        </div>
                        ${answerHTML}
                        ${adminControlsHTML}
                    `;
                    complaintsList.appendChild(complaintDiv);
                });

                renderPagination(totalPages, currentPage, complaintsPagination, displayComplaints);

            } catch (error) { console.error('의견 목록 로딩 실패:', error); }
        }

        complaintsList.addEventListener('click', async (e) => {
            const complaintItem = e.target.closest('.complaint-item');
            if (!complaintItem) return;
            const complaintId = complaintItem.dataset.id;

            // 삭제 버튼 클릭 시
            if (e.target.closest('.delete-complaint-btn')) {
                if (!confirm('정말로 이 민원을 삭제하시겠습니까?')) return;

                try {
                    const response = await fetch(`/api/complaints/${complaintId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUser })
                    });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) displayComplaints(currentPage);
                } catch (error) {
                    console.error('민원 삭제 오류:', error);
                    showToast('민원 삭제 중 오류가 발생했습니다.', 'error');
                }
            }

            // 수정 버튼 클릭 시
            if (e.target.closest('.edit-complaint-btn')) {
                const contentWrapper = complaintItem.querySelector('.complaint-content-wrapper');
                const originalTitle = contentWrapper.querySelector('h4').textContent;
                const originalContent = contentWrapper.querySelector('.complaint-main-content').innerHTML.replace(/<br\s*\/?>/gi, "\n");
                
                contentWrapper.innerHTML = `
                    <div class="complaint-edit-form">
                        <div class="form-group">
                            <input type="text" class="edit-title-input" value="${originalTitle}">
                        </div>
                        <div class="form-group">
                            <textarea class="edit-content-textarea" rows="5">${originalContent}</textarea>
                        </div>
                        <div class="button-group">
                            <button class="button-secondary button-small cancel-edit-btn">취소</button>
                            <button class="button-primary button-small save-edit-btn">저장</button>
                        </div>
                    </div>
                `;
            }

            // 저장 버튼 클릭 시
            if (e.target.closest('.save-edit-btn')) {
                const title = complaintItem.querySelector('.edit-title-input').value;
                const content = complaintItem.querySelector('.edit-content-textarea').value;
                
                if (!title.trim() || !content.trim()) {
                    showToast('제목과 내용을 모두 입력해주세요.', 'error');
                    return;
                }

                try {
                    const response = await fetch(`/api/complaints/${complaintId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUser, title, content })
                    });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) displayComplaints(currentPage);
                } catch (error) {
                    console.error('민원 수정 오류:', error);
                    showToast('민원 수정 중 오류가 발생했습니다.', 'error');
                }
            }

            // 취소 버튼 클릭 시
            if (e.target.closest('.cancel-edit-btn')) {
                displayComplaints(currentPage);
            }
        });

        complaintsList.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('answer-form')) {
                e.preventDefault();
                const complaintId = e.target.dataset.complaintId;
                const answer = e.target.querySelector('.answer-textarea').value;

                try {
                    const response = await fetch(`/api/complaints/${complaintId}/answer`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ answer, username: loggedInUser })
                    });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) displayComplaints(currentPage);
                } catch (error) {
                    console.error('답변 등록 오류:', error);
                    showToast('답변 등록 중 오류가 발생했습니다.', 'error');
                }
            }
        });

        complaintsList.addEventListener('change', async (e) => {
            if (e.target.classList.contains('status-select')) {
                const complaintId = e.target.dataset.complaintId;
                const status = e.target.value;
                try {
                    const response = await fetch(`/api/complaints/${complaintId}/status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status, username: loggedInUser })
                    });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) {
                       displayComplaints(currentPage);
                    }
                } catch (error) {
                    console.error('상태 변경 오류:', error);
                    showToast('상태 변경 중 오류가 발생했습니다.', 'error');
                }
            }
        });

        complaintsList.addEventListener('click', (e) => {
            const header = e.target.closest('.admin-controls-header');
            if (header) {
                const content = header.nextElementSibling;
                const icon = header.querySelector('.admin-toggle-btn i');
                content.classList.toggle('open');
                icon.style.transform = content.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });

        complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!loggedInUser) return showToast('로그인 후 의견을 제출할 수 있습니다.', 'error');
            try {
                const response = await fetch('/api/complaints', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ author: loggedInRealName, username: loggedInUser, title: e.target.title.value, content: e.target.content.value })
                });
                if (response.ok) {
                    e.target.title.value = '';
                    e.target.content.value = '';
                    showToast('의견이 정상적으로 제출되었습니다.', 'success');
                    displayComplaints();
                } else { showToast('의견 제출 실패', 'error'); }
            } catch (error) { console.error('의견 제출 오류:', error); }
        });
        displayComplaints(1);
    }

    // --- 회원가입 페이지 (signup.html) ---
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const verifySection = document.getElementById('verify-section');
        const signupSubmitBtn = document.getElementById('signup-submit-btn');

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            signupSubmitBtn.disabled = true;
            signupSubmitBtn.classList.add('in-progress');

            const { realName, dob, email, username, password } = e.target.elements;
            
            if (!/^[a-z]{1,10}$/.test(username.value)) {
                showToast('아이디는 10자 이하의 영어 소문자만 사용 가능합니다.', 'error');
                signupSubmitBtn.disabled = false;
                signupSubmitBtn.classList.remove('in-progress');
                return;
            }
            if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(password.value)) {
                showToast('비밀번호는 15자 이하, 영문 대/소문자, 숫자, 기호를 모두 포함해야 합니다.', 'error');
                signupSubmitBtn.disabled = false;
                signupSubmitBtn.classList.remove('in-progress');
                return;
            }

            try {
                const response = await fetch('/api/users/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ realName: realName.value, dob: dob.value, email: email.value, username: username.value, password: password.value })
                });
                const result = await response.json();
                showToast(result.message, response.ok ? 'success' : 'error');
                if (response.ok) {
                    signupForm.style.display = 'none';
                    verifySection.classList.remove('hidden');
                }
            } catch (error) {
                console.error('회원가입 요청 실패:', error);
                showToast('회원가입 요청 중 오류가 발생했습니다.', 'error');
            } finally {
                signupSubmitBtn.disabled = false; 
                signupSubmitBtn.classList.remove('in-progress');
            }
        });

        const verifyForm = document.getElementById('verify-section');
        if (verifyForm) {
            verifyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const code = document.getElementById('verification-code').value;
                const verifyBtn = verifyForm.querySelector('button[type="submit"]');

                verifyBtn.disabled = true;
                verifyBtn.textContent = '인증 중...';

                try {
                    const response = await fetch('/api/users/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, code })
                    });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) {
                        setTimeout(() => window.location.href = '/login', 1500);
                    }
                } catch (error) { 
                    console.error('인증 요청 실패:', error); 
                    showToast('인증 처리 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.', 'error');
                } finally {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = '가입 완료';
                }
            });
        }
    }

    // --- 로그인 페이지 (login.html) ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            try {
                const response = await fetch('/api/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await response.json();
                if (!response.ok) return showToast(result.message, 'error');
                
                showToast(result.message, 'success');
                localStorage.setItem('loggedInUser', result.username);
                localStorage.setItem('loggedInRealName', result.realName);
                localStorage.setItem('userRole', result.role || 'user'); // [추가] 역할 정보 저장
                setTimeout(() => window.location.href = '/', 1000);
            } catch (error) { console.error('로그인 요청 실패:', error); }
        });
    }

    // --- 비밀번호 찾기 페이지 (find-password.html) ---
    const requestResetForm = document.getElementById('request-reset-form');
    if (requestResetForm) {
        const resetPasswordForm = document.getElementById('reset-password-form');
        const findEmailInput = document.getElementById('find-email');

        requestResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = findEmailInput.value;
            const username = document.getElementById('find-username').value;
            const submitBtn = requestResetForm.querySelector('button');
            submitBtn.disabled = true;
            try {
                const response = await fetch('/api/users/request-password-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username })
                });
                const result = await response.json();
                showToast(result.message, response.ok ? 'success' : 'error');
                if (response.ok) {
                    requestResetForm.classList.add('hidden');
                    resetPasswordForm.classList.remove('hidden');
                }
            } catch (error) {
                console.error('인증 요청 실패:', error);
                showToast('요청 처리 중 오류가 발생했습니다.', 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });

        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = findEmailInput.value;
            const code = document.getElementById('verification-code').value;
            const newPassword = document.getElementById('new-password').value;
            const submitBtn = resetPasswordForm.querySelector('button');
            if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(newPassword)) {
                showToast('비밀번호는 15자 이하의 영문 대/소문자, 숫자, 기호를 모두 포함해야 합니다.', 'error');
                return;
            }
            submitBtn.disabled = true;
            try {
                const response = await fetch('/api/users/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code, newPassword })
                });
                const result = await response.json();
                showToast(result.message, response.ok ? 'success' : 'error');
                if (response.ok) {
                    setTimeout(() => window.location.href = '/login', 1500);
                }
            } catch (error) {
                console.error('비밀번호 변경 실패:', error);
                showToast('변경 처리 중 오류가 발생했습니다.', 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    // --- 마이페이지 (mypage.html) ---
    const myPageMain = document.getElementById('my-page-main');
    if (myPageMain) {
        if (!loggedInUser) {
            showToast('로그인이 필요합니다.', 'error');
            setTimeout(() => window.location.href = '/login', 1000);
            return;
        }

        const accordionHeaders = document.querySelectorAll('.accordion-header');
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.dataset.target;
                const content = document.getElementById(targetId);
                const icon = header.querySelector('.accordion-icon');

                document.querySelectorAll('.accordion-content.open').forEach(openContent => {
                    if(openContent.id !== targetId) {
                        openContent.classList.remove('open');
                        const otherHeader = document.querySelector(`[data-target="${openContent.id}"]`);
                        otherHeader.querySelector('.accordion-icon').classList.remove('open');
                    }
                });
                
                content.classList.toggle('open');
                icon.classList.toggle('open');
            });
        });

        const portfolioList = document.getElementById('portfolio-list');
        const formatCurrency = (number) => number ? number.toLocaleString('ko-KR') : '0';
        const getPriceChangeClass = (change) => {
            if (change > 0) return 'price-up';
            if (change < 0) return 'price-down';
            return 'price-even';
        };

        if(portfolioList) {
            Promise.all([
                fetch(`/api/users/portfolio?username=${loggedInUser}`).then(res => res.ok ? res.json() : Promise.reject('Portfolio API error')),
                fetch('/api/stocks/all').then(res => res.ok ? res.json() : Promise.reject('Stocks API error'))
            ]).then(([portfolioData, stockData]) => {
                
                if (!portfolioData || !stockData || !Array.isArray(stockData)) {
                     throw new Error("API로부터 유효한 데이터를 받지 못했습니다.");
                }
                
                const balance = portfolioData.balance || 0;
                const portfolio = portfolioData.portfolio || [];
                
                let totalStockValue = 0;
                let totalPurchaseValue = 0;
    
                portfolioList.innerHTML = '';
                if(portfolio.length > 0){
                    portfolio.forEach(myStock => {
                        const currentStock = stockData.find(s => s.tickerCode === myStock.tickerCode);
                        if(!currentStock) return;
    
                        const currentValue = currentStock.currentPrice * myStock.quantity;
                        const purchaseValue = myStock.purchasePrice * myStock.quantity;
                        const profit = currentValue - purchaseValue;
                        const profitRate = purchaseValue === 0 ? 0 : (profit / purchaseValue) * 100;
    
                        totalStockValue += currentValue;
                        totalPurchaseValue += purchaseValue;
    
                        const tr = document.createElement('tr');
                        tr.className = getPriceChangeClass(profit);
                        tr.innerHTML = `
                            <td><a href="/stock-detail.html?code=${myStock.tickerCode}">${myStock.companyName}</a></td>
                            <td>${formatCurrency(myStock.quantity)}</td>
                            <td>${formatCurrency(myStock.purchasePrice)}</td>
                            <td>${formatCurrency(currentStock.currentPrice)}</td>
                            <td>${formatCurrency(profit)}</td>
                            <td>${profitRate.toFixed(2)}%</td>
                        `;
                        portfolioList.appendChild(tr);
                    });
                } else {
                     portfolioList.innerHTML = '<tr><td colspan="6">보유 중인 주식이 없습니다.</td></tr>';
                }
                
                const totalAssets = balance + totalStockValue;
                const totalPL = totalStockValue - totalPurchaseValue;
    
                document.getElementById('asset-balance').textContent = `${formatCurrency(balance)}원`;
                document.getElementById('asset-total-value').textContent = `${formatCurrency(totalAssets)}원`;
                const totalPlElement = document.getElementById('asset-total-pl');
                totalPlElement.textContent = `${formatCurrency(totalPL)}원`;
                totalPlElement.className = getPriceChangeClass(totalPL);
    
            }).catch(err => {
                console.error('포트폴리오 로딩 실패:', err);
                 portfolioList.innerHTML = '<tr><td colspan="6">자산 정보를 불러오는 데 실패했습니다.</td></tr>';
            });
        }
        
        const myComplaintsList = document.getElementById('my-complaints-list');
        if (myComplaintsList) {
            async function displayMyComplaints() {
                try {
                    const response = await fetch(`/api/complaints/my-complaints?username=${loggedInUser}`);
                    if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}`);
                    }
                    const complaints = await response.json();
                    myComplaintsList.innerHTML = '';
                    if(complaints.length === 0) {
                        myComplaintsList.innerHTML = '<p>작성한 의견이 없습니다.</p>';
                        return;
                    }
                    complaints.forEach(c => {
                        const complaintDiv = document.createElement('div');
                        complaintDiv.className = 'my-complaint-item';
                        complaintDiv.innerHTML = `<div><h4>${c.title}</h4><p>${c.content.substring(0, 100)}...</p><small><i class="fa-solid fa-calendar-days"></i>⠀${new Date(c.createdAt).toLocaleString()}</small></div><button class="delete-complaint-btn" data-id="${c.id}"><i class="fa-solid fa-trash-can"></i>⠀삭제</i></button>`;
                        myComplaintsList.appendChild(complaintDiv);
                    });
                } catch (error) { 
                    console.error('내 의견 목록 로딩 실패:', error); 
                    myComplaintsList.innerHTML = '<p>내 의견 목록을 불러오는 데 실패했습니다.</p>';
                }
            }
            myComplaintsList.addEventListener('click', async (e) => {
                const deleteBtn = e.target.closest('.delete-complaint-btn');
                if (deleteBtn) {
                    if (!confirm('정말로 이 의견을 삭제하시겠습니까?')) return;
                    const complaintId = deleteBtn.dataset.id;
                    try {
                        const response = await fetch(`/api/complaints/${complaintId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUser }) });
                        const result = await response.json();
                        showToast(result.message, response.ok ? 'success' : 'error');
                        if (response.ok) displayMyComplaints();
                    } catch (error) { console.error('의견 삭제 실패:', error); }
                }
            });
            displayMyComplaints();
        }

        const myNewsSection = document.getElementById('my-news-section');
        // [수정] 관리자 또는 기자인 경우 '내가 쓴 소식' 보이기
        if ((userRole === 'admin' || userRole === 'reporter') && myNewsSection) {
            myNewsSection.classList.remove('hidden');
            const myNewsList = document.getElementById('my-news-list');
            async function displayMyNews() {
                try {
                    const response = await fetch(`/api/news/my-news?username=${loggedInUser}`);
                    const news = await response.json();
                    myNewsList.innerHTML = '';
                    if (news.length === 0) { myNewsList.innerHTML = '<p>작성한 소식이 없습니다.</p>'; return; }
                    news.reverse().forEach(article => {
                        const newsDiv = document.createElement('div');
                        newsDiv.className = 'my-news-item';
                        newsDiv.innerHTML = `
                            <div>
                                <h4>${article.title}</h4>
                                <small><i class="fa-solid fa-calendar-days"></i>⠀${new Date(article.createdAt).toLocaleDateString()}</small>
                            </div>
                            <div class="my-item-actions">
                                <a href="/edit-news/${article.id}" class="button-secondary button-small">수정</a>
                                <button class="delete-news-btn" data-id="${article.id}"><i class="fa-solid fa-trash-can"></i>⠀삭제</button>
                            </div>
                        `;
                        myNewsList.appendChild(newsDiv);
                    });
                } catch (error) { console.error('내 소식 목록 로딩 실패:', error); }
            }
            myNewsList.addEventListener('click', async (e) => {
                const deleteBtn = e.target.closest('.delete-news-btn');
                if (deleteBtn) {
                    if (!confirm('정말로 이 소식을 삭제하시겠습니까?')) return;
                    const articleId = deleteBtn.dataset.id;
                    try {
                        const response = await fetch(`/api/news/${articleId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUser }) });
                        const result = await response.json();
                        showToast(result.message, response.ok ? 'success' : 'error');
                        if (response.ok) displayMyNews();
                    } catch (error) { console.error('소식 삭제 실패:', error); }
                }
            });
            displayMyNews();
        }

        const myPostsList = document.getElementById('my-posts-list');
        if (myPostsList) {
            async function displayMyPosts() {
                try {
                    const response = await fetch(`/api/posts/my-posts?username=${loggedInUser}`);
                    if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}`);
                    }
                    const posts = await response.json();
                    myPostsList.innerHTML = '';
                    if (posts.length === 0) {
                        myPostsList.innerHTML = '<p>작성한 커뮤니티 글이 없습니다.</p>';
                        return;
                    }
                    posts.forEach(post => {
                        const postDiv = document.createElement('div');
                        postDiv.className = 'my-complaint-item'; 
                        postDiv.innerHTML = `
                            <div>
                                <h4>${post.title}</h4>
                                <small><i class="fa-solid fa-calendar-days"></i>⠀${new Date(post.createdAt).toLocaleDateString()}</small>
                            </div>
                            <button class="delete-post-btn" data-id="${post.id}"><i class="fa-solid fa-trash-can"></i>⠀삭제</i></button>
                        `;
                        myPostsList.appendChild(postDiv);
                    });
                } catch (error) {
                    console.error('내 커뮤니티 글 목록 로딩 실패:', error);
                    myPostsList.innerHTML = '<p>내 게시글 목록을 불러오는 데 실패했습니다.</p>';
                }
            }

            myPostsList.addEventListener('click', async (e) => {
                const deleteBtn = e.target.closest('.delete-post-btn');
                if (deleteBtn) {
                    if (!confirm('정말로 이 게시물을 삭제하시겠습니까?')) return;
                    const postId = deleteBtn.dataset.id;
                    try {
                        const response = await fetch(`/api/posts/${postId}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: loggedInUser })
                        });
                        const result = await response.json();
                        showToast(result.message, response.ok ? 'success' : 'error');
                        if (response.ok) {
                            displayMyPosts();
                        }
                    } catch (error) {
                        console.error('커뮤니티 글 삭제 실패:', error);
                    }
                }
            });
            displayMyPosts();
        }

        const changePasswordForm = document.getElementById('change-password-form');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const currentPassword = document.getElementById('current-password').value;
                const newPassword = document.getElementById('new-password').value;
                if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(newPassword)) {
                    showToast('비밀번호는 15자 이하의 영문 대/소문자, 숫자, 기호를 모두 포함해야 합니다.', 'error');
                    return;
                }
                try {
                    const response = await fetch('/api/users/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUser, currentPassword, newPassword }) });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) changePasswordForm.reset();
                } catch (error) { console.error('비밀번호 변경 실패:', error); }
            });
        }
        
        const deleteAccountForm = document.getElementById('delete-account-form');
        if (deleteAccountForm) {
            deleteAccountForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!confirm('정말로 회원 탈퇴를 진행하시겠습니까? 탈퇴해도 게시한 글은 남아있으며, 다시 가입해야 복구할 수 있습니다.')) return;
                const password = document.getElementById('delete-password').value;
                try {
                    const response = await fetch('/api/users/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUser, password }) });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) {
                        localStorage.removeItem('loggedInUser');
                        localStorage.removeItem('loggedInRealName');
                        localStorage.removeItem('userRole');
                        setTimeout(() => window.location.href = '/', 1000);
                    }
                } catch (error) { console.error('회원 탈퇴 실패:', error); }
            });
        }
    }
    
    // --- 주요일정 페이지 (schedule.html) ---
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        const adminSection = document.getElementById('admin-only-section');
        const scheduleForm = document.getElementById('schedule-form');
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'listWeek,timeGridWeek,dayGridMonth'
            },
            locale: 'ko',
            events: '/api/schedules',
            editable: false,
        });
        calendar.render();

        // [수정] 관리자만 일정 등록 폼 보이기
        if (userRole === 'admin') adminSection.classList.remove('hidden');
        
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const date = document.getElementById('schedule-date').value;
                const content = document.getElementById('schedule-content').value;
                try {
                    const response = await fetch('/api/schedules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date, content, username: loggedInUser })
                    });
                    if (response.ok) {
                        scheduleForm.reset();
                        calendar.refetchEvents();
                        showToast('일정이 등록되었습니다.', 'success');
                    } else {
                        const result = await response.json();
                        showToast(result.message, 'error');
                    }
                } catch (error) {
                    console.error('일정 등록 오류:', error);
                }
            });
        }
    }

    // --- 시정소식 목록 페이지(news.html) ---
    const newsListContainer = document.getElementById('news-list-container');
    if (newsListContainer) {
        const categoryFilter = document.getElementById('category-filter');
        const subcategoryFilter = document.getElementById('subcategory-filter');
        const searchForm = document.getElementById('search-form');
        const searchInput = document.getElementById('search-input');
        const newsPagination = document.getElementById('news-pagination');

        // [수정] 관리자 또는 기자만 뉴스 작성 버튼 노출
        if (userRole === 'admin' || userRole === 'reporter') {
            document.getElementById('write-news-button').classList.remove('hidden');
        }
        
        fetch('/api/autocomplete?type=news')
            .then(res => res.json())
            .then(titles => {
                autocomplete(document.getElementById("search-input"), titles);
            }).catch(err => console.error("Autocomplete fetch error:", err));

        const subcategories = {
            '정치': ['대통령실', '국회', '정당', '행정', '외교', '선거'],
            '사회': ['사건·사고', '교육', '환경', '법', '개발'],
            '경제': ['금융', '주식', '산업·기업', '부동산'],
            '문화': ['방송·연예', '영화', '음악', '공연', '도서', '미술', '음식', '문화재', '공간'],
            '생활': ['건강', '날씨', '여행', '종교'],
            '국제': ['세화연방공화국', '가람인민공화국', '세븐왕국'],
            '스포츠': ['야구', '축구', '농구', 'E스포츠', '기타'],
            '교통': ['도로', '철도', '항공', '해운', '대중교통']
        };
        
        function updateSubcategoryFilter() {
            const selectedCategory = categoryFilter.value;
            const subs = subcategories[selectedCategory];
            
            subcategoryFilter.innerHTML = '<option value="전체">2차 분류 전체</option>';
            if (subs) {
                subs.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub;
                    option.textContent = sub;
                    subcategoryFilter.appendChild(option);
                });
                subcategoryFilter.style.display = 'inline-block';
            } else {
                subcategoryFilter.style.display = 'none';
            }
        }

        const extractFirstImage = (markdown) => {
            if (!markdown) return null;
            const imageRegex = /!\[.*?\]\((.*?)\)/;
            const match = markdown.match(imageRegex);
            return match ? match[1] : null;
        };

        const extractSummary = (markdown) => {
            if (!markdown) return '';
            let text = markdown.replace(/!\[.*?\]\(.*?\)/g, '');
            text = text.replace(/<[^>]*>/g, '');
            text = text.replace(/\s+/g, ' ').trim();
            return text;
        };

        async function fetchAndRenderNews(page = 1) {
            const category = categoryFilter.value;
            const subcategory = subcategoryFilter.style.display === 'none' ? '전체' : subcategoryFilter.value;
            const searchTerm = searchInput.value;
            try {
                const params = new URLSearchParams({
                    page,
                    category: category === '전체' ? '' : category,
                    subcategory: subcategory === '전체' ? '' : subcategory,
                    search: searchTerm
                });
                
                const res = await fetch(`/api/news?${params.toString()}`);
                const result = await res.json();
                const { data, totalPages, currentPage } = result;

                if (!Array.isArray(data)) {
                    newsListContainer.innerHTML = `<p class="empty-message">${result.error || '소식을 불러오는 중 알 수 없는 오류'}</p>`;
                    return;
                }

                newsListContainer.innerHTML = '';
                if (data.length === 0) {
                    newsListContainer.innerHTML = '<p class="empty-message"><i class="fa-solid fa-bell"></i>⠀해당 조건에 맞는 소식이 없습니다.</p>';
                    renderPagination(0, 0, newsPagination, fetchAndRenderNews);
                    return;
                }

                data.forEach(article => {
                    const articleLink = document.createElement('a');
                    articleLink.href = `/news/${article.id}`;
                    articleLink.className = 'news-item';
                    
                    let categoriesHTML = '';
                    if (Array.isArray(article.categories) && article.categories.length > 0 && typeof article.categories[0] === 'object') {
                        categoriesHTML = article.categories.map(catInfo => {
                            return `<span class="news-category-badge primary">${catInfo.category}</span>`;
                        }).join('');
                    } else if (Array.isArray(article.categories)) { 
                         categoriesHTML = article.categories.map(c => `<span class="news-category-badge primary">${c}</span>`).join('');
                    } else if (article.category) {
                        categoriesHTML = `<span class="news-category-badge primary">${article.category}</span>`;
                    }

                    const firstImage = extractFirstImage(article.rawContent || article.content);
                    const thumbnailHTML = firstImage 
                        ? `<div class="news-thumbnail-wrapper"><img src="${firstImage}" alt="${article.title}" loading="lazy"></div>`
                        : `<div class="news-thumbnail-wrapper"><div class="news-thumbnail-placeholder"><i class="fa-regular fa-newspaper"></i></div></div>`;

                    const summaryText = extractSummary(article.rawContent || article.content);

                    articleLink.innerHTML = `
                        ${thumbnailHTML}
                        <div class="news-content-wrapper">
                            <div class="news-header">
                                <div class="news-badges">${categoriesHTML}</div>
                                <h3 class="news-title">${article.title}</h3>
                                <p class="news-summary">${summaryText}</p>
                            </div>
                            <div class="news-meta-info">
                                <span><i class="fa-solid fa-user"></i> ${article.author}</span>
                                <span class="news-meta-divider"></span>
                                <span><i class="fa-regular fa-calendar"></i> ${new Date(article.createdAt).toLocaleDateString()}</span>
                                <span class="news-meta-divider"></span>
                                <span><i class="fa-regular fa-thumbs-up"></i> ${article.likes}</span>
                            </div>
                        </div>
                    `;
                    newsListContainer.appendChild(articleLink);
                });

                renderPagination(totalPages, currentPage, newsPagination, fetchAndRenderNews);

            } catch (error) {
                console.error('소식 로딩 실패:', error);
                newsListContainer.innerHTML = '<p class="empty-message">소식을 불러오는 중 오류가 발생했습니다.</p>';
            }
        }
        
        categoryFilter.addEventListener('change', () => {
            updateSubcategoryFilter();
            fetchAndRenderNews(1);
        });
        subcategoryFilter.addEventListener('change', () => fetchAndRenderNews(1));

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            fetchAndRenderNews(1);
        });

        updateSubcategoryFilter();
        fetchAndRenderNews(1);
    }

    // --- 새 소식 작성/수정 페이지 (write_news.html, edit_news.html) ---
    const newsForm = document.getElementById('news-form');
    if (newsForm) {
        // [수정] 관리자 또는 기자 권한 체크
        if (userRole !== 'admin' && userRole !== 'reporter') {
            showToast('권한이 없습니다.', 'error');
            setTimeout(() => window.location.href = '/news', 1000);
            return;
        }

        const editor = new toastui.Editor({
            el: document.querySelector('#editor'),
            height: '500px',
            initialEditType: 'markdown',
            previewStyle: 'vertical'
        });
        
        const stockSelect = document.getElementById('news-stock-select');
        const addStockBtn = document.getElementById('add-stock-btn');
        const selectedStocksContainer = document.getElementById('selected-stocks-container');
        const primaryCategorySelect = document.getElementById('primary-category-select');
        const addCategoryBtn = document.getElementById('add-category-btn');
        const selectedCategoriesContainer = document.getElementById('selected-categories-container');
        const pageTitle = document.querySelector('.form-container h2');
        const submitButton = newsForm.querySelector('button[type="submit"]');

        const subcategories = {
            '정치': ['대통령실', '국회', '정당', '행정', '외교', '선거'],
            '사회': ['사건·사고', '교육', '환경', '법', '개발'],
            '경제': ['금융', '주식', '산업·기업', '부동산'],
            '문화': ['방송·연예', '영화', '음악', '공연', '도서', '미술', '음식', '문화재', '공간'],
            '생활': ['건강', '날씨', '여행', '종교'],
            '국제': ['세화연방공화국', '가람인민공화국', '세븐왕국'],
            '스포츠': ['야구', '축구', '농구', 'E스포츠', '기타'],
            '교통': ['도로', '철도', '항공', '해운', '대중교통']
        };

        let currentEditId = null;
        const path = window.location.pathname;
        if (path.startsWith('/edit-news/')) {
            currentEditId = path.split('/')[2];
        }
        
        function addCategoryUI(categoryName, checkedSubcategories = []) {
            if (!categoryName) return;

            if (document.querySelector(`.selected-category-item[data-category="${categoryName}"]`)) {
                showToast('이미 추가된 1차 분류입니다.', 'error');
                return;
            }

            const item = document.createElement('div');
            item.className = 'selected-category-item';
            item.dataset.category = categoryName;

            const subcategoryList = subcategories[categoryName] || [];
            const subcategoryCheckboxesHTML = subcategoryList.map(sub => `
                <div class="checkbox-item">
                    <input type="checkbox" id="sub-${categoryName}-${sub}" value="${sub}" ${checkedSubcategories.includes(sub) ? 'checked' : ''}>
                    <label for="sub-${categoryName}-${sub}">${sub}</label>
                </div>
            `).join('');

            item.innerHTML = `
                <div class="selected-category-header">
                    <h5>${categoryName}</h5>
                    <button type="button" class="remove-category-btn" title="삭제">&times;</button>
                </div>
                <div class="subcategory-checkbox-list">
                    ${subcategoryCheckboxesHTML || '<p>2차 분류가 없습니다.</p>'}
                </div>
            `;
            selectedCategoriesContainer.appendChild(item);

            const optionToDisable = primaryCategorySelect.querySelector(`option[value="${categoryName}"]`);
            if (optionToDisable) optionToDisable.disabled = true;
            primaryCategorySelect.value = '';
        }

        addCategoryBtn.addEventListener('click', () => {
            const selectedCategory = primaryCategorySelect.value;
            addCategoryUI(selectedCategory);
        });

        selectedCategoriesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-category-btn')) {
                const itemToRemove = e.target.closest('.selected-category-item');
                const categoryName = itemToRemove.dataset.category;

                const optionToEnable = primaryCategorySelect.querySelector(`option[value="${categoryName}"]`);
                if (optionToEnable) optionToEnable.disabled = false;

                itemToRemove.remove();
            }
        });

        const populateStockOptions = async () => {
            try {
                const response = await fetch('/api/stock-targets');
                if (!response.ok) throw new Error('주식 정보를 불러오는 데 실패했습니다.');
                const { companies } = await response.json();

                if (stockSelect) {
                    stockSelect.innerHTML = '<option value="">연동할 주식 선택</option>'; // 초기화
                    companies.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')); // 가나다순 정렬
                    companies.forEach(company => {
                        const option = document.createElement('option');
                        option.value = company.code;
                        option.textContent = `${company.name} (${company.code})`;
                        option.dataset.companyName = company.name;
                        stockSelect.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Error populating stock options:', error);
                showToast(error.message, 'error');
            }
        };
        
        const addStockToList = (tickerCode, companyName, sentiment = 'neutral') => {
             if (!tickerCode || !companyName) return;
             if (document.querySelector(`.selected-stock-item[data-ticker-code="${tickerCode}"]`)) return;

             const stockItem = document.createElement('div');
             stockItem.className = 'selected-stock-item';
             stockItem.dataset.tickerCode = tickerCode;
             const uniqueId = `sentiment-${tickerCode}-${Date.now()}`;

             stockItem.innerHTML = `
                 <span>${companyName} (${tickerCode})</span>
                 <div class="sentiment-options">
                     <input type="radio" name="sentiment-${tickerCode}" value="positive" id="${uniqueId}-positive" ${sentiment === 'positive' ? 'checked' : ''}>
                     <label for="${uniqueId}-positive">긍정</label>
                     <input type="radio" name="sentiment-${tickerCode}" value="neutral" id="${uniqueId}-neutral" ${sentiment === 'neutral' ? 'checked' : ''}>
                     <label for="${uniqueId}-neutral">중립</label>
                     <input type="radio" name="sentiment-${tickerCode}" value="negative" id="${uniqueId}-negative" ${sentiment === 'negative' ? 'checked' : ''}>
                     <label for="${uniqueId}-negative">부정</label>
                 </div>
                 <button type="button" class="remove-stock-btn" title="삭제">&times;</button>
             `;
             selectedStocksContainer.appendChild(stockItem);
         };

        addStockBtn.addEventListener('click', () => {
             const selectedOption = stockSelect.options[stockSelect.selectedIndex];
             if (!selectedOption || !selectedOption.value) return showToast('추가할 주식을 선택해주세요.', 'error');
             addStockToList(selectedOption.value, selectedOption.dataset.companyName);
             stockSelect.value = '';
        });

        selectedStocksContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-stock-btn')) {
                e.target.closest('.selected-stock-item').remove();
            }
        });

        async function initializeForm() {
            await populateStockOptions();
            if (currentEditId) {
                pageTitle.textContent = '뉴스 수정';
                submitButton.innerHTML = '<i class="fa-solid fa-check"></i>⠀수정 완료';
                try {
                    const res = await fetch(`/api/news/${currentEditId}`);
                    if (!res.ok) throw new Error('수정할 뉴스 정보를 불러오지 못했습니다.');
                    const article = await res.json();
                    
                    document.getElementById('news-author').value = article.author || '';
                    document.getElementById('news-title').value = article.title || '';
                    editor.setMarkdown(article.rawContent || article.content || '');
                    
                    if (Array.isArray(article.categories) && article.categories.length > 0 && typeof article.categories[0] === 'object') {
                        article.categories.forEach(catInfo => {
                            addCategoryUI(catInfo.category, catInfo.subcategories);
                        });
                    } else if (article.categories) { 
                        article.categories.forEach(cat => {
                            const subs = article.subcategory === cat ? [article.subcategory] : [];
                             addCategoryUI(cat, subs);
                        });
                    } else if(article.category) { 
                        addCategoryUI(article.category, article.subcategory ? [article.subcategory] : []);
                    }

                    (article.targetStocks || []).forEach(stock => {
                        const option = stockSelect.querySelector(`option[value="${stock.tickerCode}"]`);
                        if(option) addStockToList(stock.tickerCode, option.dataset.companyName, stock.sentiment);
                    });

                } catch (error) {
                    showToast(error.message, 'error');
                    setTimeout(() => window.location.href = '/news', 1500);
                }
            } else {
                pageTitle.textContent = '새 뉴스 작성';
                submitButton.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i>⠀게시물 등록';
            }
        }
        
        newsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('news-title').value;
            const content = editor.getMarkdown();
            const author = document.getElementById('news-author').value;

            if (!author) return showToast('작성자를 선택해주세요.', 'error');
            
            const categoriesPayload = [];
            const selectedItems = selectedCategoriesContainer.querySelectorAll('.selected-category-item');
            
            if (selectedItems.length === 0) {
                return showToast('하나 이상의 1차 분류를 추가해주세요.', 'error');
            }

            selectedItems.forEach(item => {
                const category = item.dataset.category;
                const subcategories = Array.from(item.querySelectorAll('.subcategory-checkbox-list input:checked')).map(cb => cb.value);
                categoriesPayload.push({ category, subcategories });
            });

            const targetStocks = Array.from(selectedStocksContainer.querySelectorAll('.selected-stock-item')).map(item => ({
                tickerCode: item.dataset.tickerCode,
                sentiment: item.querySelector(`input:checked`).value
            }));

            const payload = {
                title, content, author,
                categories: categoriesPayload, 
                username: loggedInUser,
                targetStocks
            };
            
            const url = currentEditId ? `/api/news/${currentEditId}` : '/api/news';
            const method = currentEditId ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || '뉴스 처리에 실패했습니다.');
                }
                const resultArticle = await response.json();
                showToast(`뉴스가 성공적으로 ${currentEditId ? '수정' : '등록'}되었습니다.`, 'success');
                setTimeout(() => { window.location.href = `/news/${resultArticle.id}`; }, 1000);
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
        
        initializeForm();
    }


    // --- 게시물 상세 페이지(article.html) ---
    const articleContainer = document.getElementById('article-container');
    if (articleContainer) {
        const articleId = window.location.pathname.split('/')[2];
        async function fetchAndRenderArticle() {
            try {
                const res = await fetch(`/api/news/${articleId}`);
                if (!res.ok) throw new Error('게시물을 불러오지 못했습니다.');
                const article = await res.json();
                
                document.title = `안현민국 │ ${article.title}`;
                
                 let categoriesHTML = '';
                 if (Array.isArray(article.categories) && article.categories.length > 0 && typeof article.categories[0] === 'object') {
                     categoriesHTML = article.categories.map(catInfo => {
                         const subHtml = (catInfo.subcategories && catInfo.subcategories.length > 0)
                             ? catInfo.subcategories.map(s => `<span class="article-subcategory-badge">${s}</span>`).join('')
                             : '';
                         return `<div class="article-category-group">
                                     <span class="article-category-badge">${catInfo.category}</span>
                                     ${subHtml}
                                 </div>`;
                     }).join('');
                 } else if (article.categories) { 
                    categoriesHTML = `<span class="article-category-badge">${article.categories.join(', ')}</span>`;
                    if(article.subcategory) categoriesHTML += `<span class="article-subcategory-badge">${article.subcategory}</span>`;
                 } else if (article.category) { 
                    categoriesHTML = `<span class="article-category-badge">${article.category}</span>`;
                    if(article.subcategory) categoriesHTML += `<span class="article-subcategory-badge">${article.subcategory}</span>`;
                 }

                // [수정] 관리자이거나 작성자 본인(기자)인 경우만 수정 버튼 노출
                const adminControls = (userRole === 'admin' || (userRole === 'reporter' && article.username === loggedInUser)) 
                    ? `<a href="/edit-news/${article.id}" class="button-secondary button-small">수정하기</a>` : '';

                articleContainer.innerHTML = `
                    <h2>${article.title}</h2>
                    <div class="article-meta">
                        <div class="badges-container">
                            ${categoriesHTML}
                        </div>
                        <div class="info-container">
                            <span><i class="fa-solid fa-at"></i>⠀${article.author}</span>
                            <span><i class="fa-solid fa-calendar-days"></i>⠀${new Date(article.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div id="viewer"></div>
                    <div class="article-actions">
                        <div class="vote-section">
                            <button class="vote-button" id="like-button"><i class="fa-solid fa-thumbs-up"></i>⠀<span id="like-count">${article.likes}</span></button>
                            <button class="vote-button" id="dislike-button"><i class="fa-solid fa-thumbs-down"></i>⠀<span id="dislike-count">${article.dislikes}</span></button>
                        </div>
                        <div class="admin-controls">${adminControls}</div>
                    </div>
                `;
                
                new toastui.Editor({
                    el: document.querySelector('#viewer'),
                    initialValue: article.content,
                    viewer: true
                });

                document.getElementById('like-button').addEventListener('click', () => vote('like'));
                document.getElementById('dislike-button').addEventListener('click', () => vote('dislike'));
            } catch(error) {
                articleContainer.innerHTML = `<p style="text-align:center;">${error.message}</p>`;
            }
        }
        async function vote(voteType) {
            if (!loggedInUser) return showToast('로그인이 필요한 기능입니다.', 'error');
            try {
                const response = await fetch(`/api/news/${articleId}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voteType, username: loggedInUser })
                });
                const result = await response.json();
                if (response.ok) {
                    document.getElementById('like-count').textContent = result.likes;
                    document.getElementById('dislike-count').textContent = result.dislikes;
                    showToast('투표가 반영되었습니다.', 'success');
                } else {
                    showToast(result.message, 'error');
                }
            } catch(error) {
                console.error('투표 처리 중 오류:', error);
                showToast('투표 처리 중 오류가 발생했습니다.', 'error');
            }
        }
        fetchAndRenderArticle();
    }

    // --- 커뮤니티 목록 페이지 (community.html) ---
    const communityGrid = document.getElementById('community-grid');
    if (communityGrid) {
        if (loggedInUser) {
            document.getElementById('write-post-button').classList.remove('hidden');
        }
        const communityPagination = document.getElementById('community-pagination');
        const searchForm = document.getElementById('community-search-form');
        const searchInput = document.getElementById('community-search-input');

        fetch('/api/autocomplete?type=community')
            .then(res => res.json())
            .then(titles => {
                autocomplete(document.getElementById("community-search-input"), titles);
            }).catch(err => console.error("Autocomplete fetch error:", err));

        const extractFirstImage = (markdown) => {
            if (!markdown) return null;
            const imageRegex = /!\[.*?\]\((.*?)\)/;
            const match = markdown.match(imageRegex);
            return match ? match[1] : null;
        };

        const extractSummary = (markdown) => {
            if (!markdown) return '';
            let text = markdown.replace(/!\[.*?\]\(.*?\)/g, '');
            text = text.replace(/<[^>]*>/g, '');
            text = text.replace(/\s+/g, ' ').trim();
            return text;
        };

        async function fetchAndRenderPosts(page = 1) {
            try {
                const searchTerm = searchInput.value;
                const params = new URLSearchParams({
                    page,
                    search: searchTerm
                });
                const res = await fetch(`/api/posts?${params.toString()}`);
                const result = await res.json();
                const { data, totalPages, currentPage } = result;

                communityGrid.innerHTML = '';
                if (data.length === 0) {
                    communityGrid.innerHTML = '<p class="empty-message">아직 등록된 게시물이 없습니다.</p>';
                    renderPagination(0, 0, communityPagination, fetchAndRenderPosts);
                    return;
                }

                data.forEach(post => {
                    const postCard = document.createElement('a');
                    postCard.href = `/post/${post.id}`;
                    postCard.className = 'post-card';
                    
                    let thumbnailSrc = post.image;
                    let placeholderClass = '';

                    if (!thumbnailSrc) {
                        thumbnailSrc = extractFirstImage(post.content);
                    }
                    
                    let thumbnailHTML;
                    if (thumbnailSrc) {
                        thumbnailHTML = `<img src="${thumbnailSrc}" alt="${post.title}" loading="lazy">`;
                    } else {
                        thumbnailHTML = `<img src="/images/noimage.png" alt="No Image">`;
                        placeholderClass = 'no-image'; 
                    }

                    const summaryText = extractSummary(post.content);
                    
                    postCard.innerHTML = `
                        <div class="post-thumbnail-wrapper ${placeholderClass}">
                            ${thumbnailHTML}
                        </div>
                        <div class="post-card-content">
                            <h4 class="post-card-title">${post.title}</h4>
                            <p class="post-card-preview">${summaryText}</p>
                            <div class="post-card-meta">
                                <div class="post-author">
                                    <i class="fa-solid fa-circle-user"></i> ${post.realName}
                                </div>
                                <div class="post-stats">
                                    <span><i class="fa-regular fa-calendar"></i> ${new Date(post.createdAt).toLocaleDateString()}</span>
                                    <span class="${post.likes > 0 ? 'highlight-likes' : ''}">
                                        <i class="fa-solid fa-heart"></i> ${post.likes}
                                    </span>
                                </div>
                            </div>
                        </div>`;
                    communityGrid.appendChild(postCard);
                });
                 renderPagination(totalPages, currentPage, communityPagination, fetchAndRenderPosts);
            } catch (error) {
                console.error('커뮤니티 글 목록 로딩 실패:', error);
                communityGrid.innerHTML = '<p class="empty-message">게시물을 불러오는 중 오류가 발생했습니다.</p>';
            }
        }
        
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            fetchAndRenderPosts(1);
        });

        fetchAndRenderPosts(1);
    }

    // --- 새 커뮤니티 게시물 작성 페이지 (write-post.html) ---
    const postForm = document.getElementById('post-form');
    if (postForm) {
        if (!loggedInUser) {
            showToast('로그인이 필요합니다.', 'error');
            setTimeout(() => window.location.href = '/login', 1000);
        }
        const editor = new toastui.Editor({
            el: document.querySelector('#editor'),
            height: '400px',
            initialEditType: 'markdown',
            previewStyle: 'vertical'
        });
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('title', document.getElementById('post-title').value);
            formData.append('content', editor.getMarkdown());
            formData.append('username', loggedInUser);
            formData.append('realName', loggedInRealName);
            const imageFile = document.getElementById('post-image').files[0];
            if (imageFile) {
                formData.append('image', imageFile);
            }
            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    body: formData
                });
                if (response.ok) {
                    showToast('게시물이 성공적으로 등록되었습니다.', 'success');
                    setTimeout(() => window.location.href = '/community', 1000);
                } else {
                    const result = await response.json();
                    showToast(result.message, 'error');
                }
            } catch (error) {
                console.error('게시물 등록 실패:', error);
                showToast('게시물 등록 중 오류가 발생했습니다.', 'error');
            }
        });
    }

    // --- 커뮤니티 게시물 상세 페이지 (post-detail.html) ---
    const postDetailContainer = document.getElementById('post-detail-container');
    if (postDetailContainer) {
        const postId = window.location.pathname.split('/')[2];
        const postContentArea = document.getElementById('post-content-area');
        const commentList = document.getElementById('comment-list');

        function renderCommentsRecursive(comments, container, level = 0) {
            comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(comment => {
                const commentWrapper = document.createElement('div');
                commentWrapper.className = `comment-wrapper level-${level}`;
                commentWrapper.id = `comment-wrapper-${comment.id}`;

                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment-item';
                commentDiv.id = `comment-${comment.id}`;
                
                const formattedContent = comment.content.replace(/\n/g, '<br>');
                const isEdited = comment.updatedAt ? ` <span class="edited-badge">(수정됨)</span>` : '';
                const displayTimestamp = comment.updatedAt ? new Date(comment.updatedAt).toLocaleString() : new Date(comment.createdAt).toLocaleString();
                
                let actionButtons = `<button class="button-link reply-comment-btn" data-comment-id="${comment.id}">답글</button>`;
                if (loggedInUser && (loggedInUser === comment.author || userRole === 'admin')) {
                     actionButtons += `
                         <button class="button-link edit-comment-btn" data-comment-id="${comment.id}">수정</button>
                         <button class="button-link delete-comment-btn" data-comment-id="${comment.id}">삭제</button>
                       `;
                }

                commentDiv.innerHTML = `
                    <p class="comment-author">${comment.realName}</p>
                    <div class="comment-content-wrapper">
                        <div class="comment-text-content">${formattedContent}</div>
                        <p class="comment-date">${displayTimestamp}${isEdited}</p>
                    </div>
                    <div class="comment-actions">${actionButtons}</div>
                `;

                const repliesContainer = document.createElement('div');
                repliesContainer.className = 'replies-container';
                repliesContainer.id = `replies-for-${comment.id}`;

                commentWrapper.appendChild(commentDiv);
                commentWrapper.appendChild(repliesContainer);
                container.appendChild(commentWrapper);

                if (comment.replies && comment.replies.length > 0) {
                    renderCommentsRecursive(comment.replies, repliesContainer, level + 1);
                }
            });
        }
        
        function renderCommentTree(comments) {
            commentList.innerHTML = '';
            if (!comments || comments.length === 0) {
                commentList.innerHTML = '<p>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>';
                return;
            }
            renderCommentsRecursive(comments, commentList);
        }
        
        async function fetchAndRenderPost() {
            try {
                const res = await fetch(`/api/posts/${postId}`);
                if (!res.ok) throw new Error('게시물을 불러오지 못했습니다.');
                
                const post = await res.json();
                document.title = `안현민국 │ ${post.title}`;
                const imageHTML = post.image ? `<img src="${post.image}" alt="${post.title}" class="post-detail-image">` : '';
                
                postContentArea.innerHTML = `
                    <div class="post-detail-header">
                        <h2>${post.title}</h2>
                        <div class="post-detail-meta">
                            <span><i class="fa-solid fa-at"></i>⠀${post.realName}</span>
                            <span><i class="fa-solid fa-calendar-days"></i>⠀${new Date(post.createdAt).toLocaleString()}</span>
                        </div>
                    </div>
                    ${imageHTML}
                    <div id="viewer"></div>
                    <div class="vote-section">
                        <button class="vote-button" id="like-button"><i class="fa-solid fa-thumbs-up"></i>⠀<span id="like-count">${post.likes}</span></button>
                        <button class="vote-button" id="dislike-button"><i class="fa-solid fa-thumbs-down"></i>⠀<span id="dislike-count">${post.dislikes}</span></button>
                    </div>`;

                new toastui.Editor({ el: postContentArea.querySelector('#viewer'), initialValue: post.content, viewer: true });
                
                document.getElementById('like-button').addEventListener('click', () => votePost('like'));
                document.getElementById('dislike-button').addEventListener('click', () => votePost('dislike'));

                const commentSection = document.getElementById('comment-section');
                const commentForm = document.getElementById('comment-form');

                commentSection.classList.remove('hidden');
                renderCommentTree(post.comments);

                if (loggedInUser) {
                    commentForm.classList.remove('hidden');
                }

                if (!commentForm.dataset.listenerAttached) {
                    commentForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const commentContentInput = document.getElementById('comment-content');
                        const content = commentContentInput.value.trim();
                        if (!content) return showToast('댓글 내용을 입력해주세요.', 'error');
                        
                        try {
                            const response = await fetch(`/api/posts/${postId}/comments`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    username: loggedInUser,
                                    realName: loggedInRealName,
                                    content: content
                                })
                            });
                            if (response.ok) {
                                commentContentInput.value = '';
                                showToast('댓글이 성공적으로 등록되었습니다.', 'success');
                                fetchAndRenderPost();
                            } else {
                                const result = await response.json();
                                showToast(result.message || '댓글 등록에 실패했습니다.', 'error');
                            }
                        } catch (error) { console.error('댓글 등록 오류:', error); }
                    });
                    commentForm.dataset.listenerAttached = 'true';
                }
            } catch(error) {
                postDetailContainer.innerHTML = `<p class="empty-message">${error.message}</p>`;
            }
        }

        commentList.addEventListener('click', async (e) => {
            const target = e.target;
            
            if (target.classList.contains('reply-comment-btn')) {
                if (!loggedInUser) return showToast('로그인이 필요합니다.', 'error');

                const parentId = target.dataset.commentId;
                const repliesContainer = document.getElementById(`replies-for-${parentId}`);
                
                const existingReplyForm = document.querySelector('.comment-reply-form');
                if (existingReplyForm) existingReplyForm.remove();

                const replyForm = document.createElement('form');
                replyForm.className = 'comment-reply-form';
                replyForm.dataset.parentId = parentId;
                replyForm.innerHTML = `
                    <div class="form-group">
                        <textarea placeholder="대댓글을 입력하세요..." rows="3"></textarea>
                    </div>
                    <div class="button-group">
                        <button type="button" class="button-secondary button-small cancel-reply-btn">취소</button>
                        <button type="submit" class="button-primary button-small">등록</button>
                    </div>
                `;
                repliesContainer.appendChild(replyForm);
                replyForm.querySelector('textarea').focus();
            }

            if (target.classList.contains('cancel-reply-btn')) {
                target.closest('.comment-reply-form').remove();
            }

            if (target.classList.contains('delete-comment-btn')) {
                if (!confirm('정말로 댓글을 삭제하시겠습니까?')) return;
                
                const commentId = target.dataset.commentId;
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUser })
                    });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) fetchAndRenderPost();
                } catch (error) {
                    console.error('댓글 삭제 오류:', error);
                    showToast('댓글 삭제 중 오류가 발생했습니다.', 'error');
                }
            }

            if (target.classList.contains('edit-comment-btn')) {
                const commentId = target.dataset.commentId;
                const commentItem = document.getElementById(`comment-${commentId}`);
                const contentDiv = commentItem.querySelector('.comment-text-content');
                const actionsDiv = commentItem.querySelector('.comment-actions');
                
                if (commentItem.querySelector('.comment-edit-form')) return;

                const originalContent = contentDiv.innerHTML.replace(/<br\s*\/?>/gi, "\n");
                
                const editFormHTML = `
                    <div class="comment-edit-form">
                        <div class="form-group">
                            <textarea>${originalContent}</textarea>
                        </div>
                        <div class="button-group">
                            <button type="button" class="button-secondary button-small cancel-edit-btn">취소</button>
                            <button type="button" class="button-primary button-small save-comment-btn" data-comment-id="${commentId}">저장</button>
                        </div>
                    </div>
                `;
                contentDiv.style.display = 'none';
                if (actionsDiv) actionsDiv.style.display = 'none'; 
                
                commentItem.querySelector('.comment-content-wrapper').insertAdjacentHTML('beforeend', editFormHTML);
            }

            if (target.classList.contains('save-comment-btn')) {
                const commentId = target.dataset.commentId;
                const commentItem = document.getElementById(`comment-${commentId}`);
                const textarea = commentItem.querySelector('.comment-edit-form textarea');
                const newContent = textarea.value.trim();

                if (!newContent) return showToast('댓글 내용을 입력해주세요.', 'error');

                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: loggedInUser, content: newContent })
                    });
                    
                    if (response.ok) {
                        showToast('댓글이 수정되었습니다.', 'success');
                        fetchAndRenderPost();
                    } else {
                        const result = await response.json();
                        showToast(result.message, 'error');
                    }
                } catch (error) {
                    console.error('댓글 수정 오류:', error);
                    showToast('댓글 수정 중 오류가 발생했습니다.', 'error');
                }
            }
            
            if (target.classList.contains('cancel-edit-btn')) {
                fetchAndRenderPost(); 
            }
        });

        commentList.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('comment-reply-form')) {
                e.preventDefault();
                const form = e.target;
                const parentId = form.dataset.parentId;
                const content = form.querySelector('textarea').value.trim();

                if (!content) return showToast('대댓글 내용을 입력해주세요.', 'error');

                try {
                    const response = await fetch(`/api/posts/${postId}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: loggedInUser,
                            realName: loggedInRealName,
                            content: content,
                            parentId: parseInt(parentId)
                        })
                    });
                    if (response.ok) {
                        showToast('대댓글이 성공적으로 등록되었습니다.', 'success');
                        fetchAndRenderPost();
                    } else {
                        const result = await response.json();
                        showToast(result.message || '대댓글 등록에 실패했습니다.', 'error');
                    }
                } catch (error) {
                    console.error('대댓글 등록 오류:', error);
                    showToast('대댓글 등록 중 오류가 발생했습니다.', 'error');
                }
            }
        });

        async function votePost(voteType) {
            if (!loggedInUser) return showToast('로그인이 필요한 기능입니다.', 'error');
            try {
                const response = await fetch(`/api/posts/${postId}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voteType, username: loggedInUser })
                });
                const result = await response.json();
                if (response.ok) {
                    document.getElementById('like-count').textContent = result.likes;
                    document.getElementById('dislike-count').textContent = result.dislikes;
                    showToast('투표가 반영되었습니다.', 'success');
                } else {
                    showToast(result.message, 'error');
                }
            } catch (error) { console.error('투표 처리 중 오류:', error); }
        }
        
        fetchAndRenderPost();
    }
    
    // --- 팝업 공통 로직 ---
    const popupContainers = document.querySelectorAll('[id^="popup-container-"]');
    if (popupContainers.length > 0) {
        const now = new Date();
        popupContainers.forEach(popupContainer => {
            const popupId = popupContainer.id.split('-').pop();
            const hidePopupUntil = localStorage.getItem(`hidePopupUntil-${popupId}`);
            if (hidePopupUntil && now < new Date(hidePopupUntil)) {
                popupContainer.style.display = 'none';
            }
        });

        document.querySelectorAll('.close-button').forEach(button => {
            button.addEventListener('click', function() {
                const popupId = this.dataset.popupId;
                document.getElementById(`popup-container-${popupId}`).style.display = 'none';
            });
        });

        document.querySelectorAll('.hide-for-day-button').forEach(button => {
            button.addEventListener('click', function() {
                const popupId = this.dataset.popupId;
                const tomorrow = new Date();
                tomorrow.setDate(now.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                localStorage.setItem(`hidePopupUntil-${popupId}`, tomorrow.toISOString());
                document.getElementById(`popup-container-${popupId}`).style.display = 'none';
            });
        });
    }

    // --- 미디어 호스팅 페이지 (image-hosting.html) ---
    const imageHostingPage = document.getElementById('image-hosting-page');
    if (imageHostingPage) {
        const mediaModal = document.getElementById('media-modal');
        const modalImage = document.getElementById('modal-image');
        const modalVideo = document.getElementById('modal-video');
        const modalCaption = document.getElementById('modal-caption');
        const uploadForm = document.getElementById('upload-form');
        const mediaFileInput = document.getElementById('media-file-input');
        const mediaListGallery = document.getElementById('media-list-gallery');
        const mediaPagination = document.getElementById('media-pagination');
        const loginPrompt = document.getElementById('login-prompt');
        const uploadButton = document.getElementById('upload-button');
        
        const mediaTitleInput = document.getElementById('media-title-input');
        const mediaCategoryInput = document.getElementById('media-category-input');
        const categoryList = document.getElementById('category-list');
        const mediaWidthInput = document.getElementById('media-width-input');
        const mediaHeightInput = document.getElementById('media-height-input');
        const mediaSearchForm = document.getElementById('media-search-form');
        const mediaCategoryFilter = document.getElementById('media-category-filter');
        const mediaWidthFilter = document.getElementById('media-width-filter');
        const mediaHeightFilter = document.getElementById('media-height-filter');
        const mediaSearchInput = document.getElementById('media-search-input');
        
        const uploadArea = document.getElementById('upload-area');
        const previewArea = document.getElementById('preview-area');
        const imagePreview = document.getElementById('image-preview');
        const videoPreview = document.getElementById('video-preview');
        const cancelPreviewBtn = document.getElementById('cancel-preview-btn');
        const uploadControls = document.getElementById('upload-controls');

        if (!loggedInUser) {
            uploadForm.classList.add('hidden');
            loginPrompt.classList.remove('hidden');
        } else {
            uploadForm.classList.remove('hidden');
            loginPrompt.classList.add('hidden');
        }

        fetch('/api/autocomplete?type=media')
            .then(res => res.json())
            .then(titles => {
                autocomplete(document.getElementById("media-search-input"), titles);
            }).catch(err => console.error("Autocomplete fetch error:", err));
        
        const handleFileSelect = (file) => {
            if (!file) return;
            const fileType = file.type.split('/')[0];
            if (fileType === 'image') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.classList.remove('hidden');
                    videoPreview.classList.add('hidden');
                };
                reader.readAsDataURL(file);
            } else if (fileType === 'video') {
                videoPreview.src = URL.createObjectURL(file);
                videoPreview.classList.remove('hidden');
                imagePreview.classList.add('hidden');
            } else {
                showToast('지원하지 않는 파일 형식입니다.', 'error');
                return;
            }
            uploadArea.classList.add('hidden');
            previewArea.classList.remove('hidden');
            uploadControls.classList.remove('hidden');
            mediaTitleInput.value = file.name;
        };
        
        mediaFileInput.addEventListener('change', () => handleFileSelect(mediaFileInput.files[0]));
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('drag-over'); });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            mediaFileInput.files = e.dataTransfer.files;
            handleFileSelect(file);
        });

        const resetUploadForm = () => {
            uploadForm.reset();
            previewArea.classList.add('hidden');
            uploadControls.classList.add('hidden');
            uploadArea.classList.remove('hidden');
            imagePreview.src = '#';
            videoPreview.src = '#';
            if (videoPreview.src) URL.revokeObjectURL(videoPreview.src);
        };
        
        cancelPreviewBtn.addEventListener('click', resetUploadForm);

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = mediaFileInput.files[0];
            if (!file) {
                showToast('업로드할 파일을 선택해주세요.', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('title', mediaTitleInput.value);
            formData.append('category', mediaCategoryInput.value);
            formData.append('width', mediaWidthInput.value);
            formData.append('height', mediaHeightInput.value);
            formData.append('mediaFile', file); 
            formData.append('username', loggedInUser);
            formData.append('realName', loggedInRealName);

            uploadButton.disabled = true;
            uploadButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>⠀업로드 중...';

            try {
                const response = await fetch('/api/media/upload', { method: 'POST', body: formData });
                const result = await response.json();
                if (response.ok) {
                    showToast('미디어가 성공적으로 업로드되었습니다.', 'success');
                    resetUploadForm();
                    loadHostedMedia(1);
                } else {
                    showToast(result.message || '업로드에 실패했습니다.', 'error');
                }
            } catch (error) {
                console.error('업로드 오류:', error);
                showToast('업로드 중 오류가 발생했습니다. (파일 크기를 체크해 보세요.)', 'error');
            } finally {
                uploadButton.disabled = false;
                uploadButton.innerHTML = '<i class="fa-solid fa-upload"></i>⠀업로드';
            }
        });

        function createMediaCard(media) {
            const item = document.createElement('div');
            item.className = 'image-card';
            item.setAttribute('data-media-id', media.id);
            item.dataset.mediaUrl = media.url;
            item.dataset.mediaType = media.type;
            item.dataset.mediaTitle = media.title;

            const fullUrl = new URL(media.url, window.location.origin).href;
            const deleteButtonHTML = (userRole === 'admin' || loggedInUser === media.uploader)
                ? `<button class="button-small delete-btn" title="삭제"><i class="fa-solid fa-trash-can"></i>⠀삭제</button>`
                : '';

            const thumbnailHTML = media.type === 'video'
                ? `<div class="card-image-wrapper"><i class="fa-solid fa-circle-play play-icon"></i><video src="${media.url}#t=0.5" preload="metadata" muted></video></div>`
                : `<div class="card-image-wrapper"><img src="${media.url}" alt="${media.title}" loading="lazy"></div>`;

            const metaInfoHTML = `
                <p class="card-meta">
                    ${media.category ? `<span><i class="fa-solid fa-tags"></i>⠀${media.category}</span>` : ''}
                    ${media.size ? `<span>⠀<i class="fa-solid fa-expand"></i>⠀${media.size}</span>` : ''}
                </p>`;

            item.innerHTML = `
                ${thumbnailHTML}
                <div class="card-info">
                    <h4 class="card-title" title="${media.title}">${media.title}</h4>
                    ${metaInfoHTML}
                </div>
                <div class="card-actions">
                    <button class="button-small copy-url-btn" data-url="${fullUrl}"><i class="fa-solid fa-copy"></i>⠀URL 복사</button>
                    ${deleteButtonHTML}
                </div>
            `;
            mediaListGallery.appendChild(item);
        }

        async function loadHostedMedia(page = 1) {
            try {
                const params = new URLSearchParams({ page });
                const searchTerm = mediaSearchInput.value.trim();
                const category = mediaCategoryFilter.value;
                const width = mediaWidthFilter.value.trim();
                const height = mediaHeightFilter.value.trim();

                if (searchTerm) params.append('search', searchTerm);
                if (category && category !== '전체') params.append('category', category);
                if (width) params.append('width', width);
                if (height) params.append('height', height);
                
                const response = await fetch(`/api/media/list?${params.toString()}`);
                const result = await response.json();

                if (!response.ok || !result.data || !result.allCategories) {
                    console.error('Failed to load media list or received invalid data:', result);
                    mediaListGallery.innerHTML = '<p class="empty-message">목록을 불러오는 중 오류가 발생했습니다.</p>';
                    renderPagination(0, 0, mediaPagination, loadHostedMedia);
                    return;
                }
                
                const { data, totalPages, currentPage, allCategories } = result;
                
                const currentCategory = mediaCategoryFilter.value;
                mediaCategoryFilter.innerHTML = '<option value="전체">전체</option>';
                categoryList.innerHTML = '';
                allCategories.forEach(cat => {
                    mediaCategoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
                    categoryList.innerHTML += `<option value="${cat}">`;
                });
                mediaCategoryFilter.value = currentCategory;

                mediaListGallery.innerHTML = '';
                if (data.length === 0) {
                    mediaListGallery.innerHTML = '<p class="empty-message">업로드된 미디어가 없습니다.</p>';
                } else {
                    data.forEach(createMediaCard);
                }
                renderPagination(totalPages, currentPage, mediaPagination, loadHostedMedia);

            } catch (error) {
                console.error('미디어 목록 로딩 실패:', error);
                mediaListGallery.innerHTML = '<p class="empty-message">목록을 불러오는 중 오류가 발생했습니다.</p>';
            }
        }

        mediaSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loadHostedMedia(1);
        });

        mediaCategoryFilter.addEventListener('change', () => {
            loadHostedMedia(1);
        });

        mediaListGallery.addEventListener('click', async (e) => {
            const card = e.target.closest('.image-card');
            if (!card) return;

            const copyBtn = e.target.closest('.copy-url-btn');
            const deleteBtn = e.target.closest('.delete-btn');

            if (copyBtn) {
                e.stopPropagation();
                navigator.clipboard.writeText(copyBtn.dataset.url).then(() => showToast('URL이 복사되었습니다.', 'success'));
            } else if (deleteBtn) {
                e.stopPropagation();
                const mediaId = card.dataset.mediaId;
                if (!confirm('정말로 이 미디어를 삭제하시겠습니까?')) return;
                try {
                    const response = await fetch(`/api/media/${mediaId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loggedInUser }) });
                    const result = await response.json();
                    if (response.ok) {
                        showToast(result.message, 'success');
                        loadHostedMedia(1);
                    } else {
                        showToast(result.message, 'error');
                    }
                } catch (error) { 
                    console.error('미디어 삭제 오류:', error);
                    showToast('삭제 중 오류가 발생했습니다.', 'error');
                }
            } else {
                openMediaModal(card.dataset.mediaUrl, card.dataset.mediaType, card.dataset.mediaTitle);
            }
        });
        
        function openMediaModal(url, type, caption) {
            if (type === 'video') {
                modalImage.classList.add('hidden');
                modalVideo.classList.remove('hidden');
                modalVideo.src = url;
                modalVideo.play();
            } else {
                modalImage.classList.remove('hidden');
                modalVideo.classList.add('hidden');
                modalImage.src = url;
            }
            modalCaption.textContent = caption;
            mediaModal.classList.remove('hidden');
            window.addEventListener('keydown', handleEscKey);
        }

        function closeModal() {
            mediaModal.classList.add('hidden');
            modalVideo.pause();
            modalVideo.src = "";
            modalImage.src = "";
            window.removeEventListener('keydown', handleEscKey);
        }

        function handleEscKey(e) { if (e.key === 'Escape') closeModal(); }
        mediaModal.addEventListener('click', (e) => { if (e.target === mediaModal) closeModal(); });
        
        if (loggedInUser) {
            loadHostedMedia(1);
        }
    }

    // --- 부동산 목록 (realty.html) ---
    const realtyGrid = document.getElementById('realty-grid');
    if (realtyGrid) {
        // [수정] 관리자 또는 공인중개사만 매물 등록 버튼 노출
        if (userRole === 'admin' || userRole === 'realtor') {
            const writeButton = document.getElementById('write-realty-button');
            if(writeButton) writeButton.classList.remove('hidden');
        }

        const searchForm = document.getElementById('realty-search-form');
        const searchInput = document.getElementById('realty-search-input');
        const categorySelect = document.getElementById('realty-category-select');
        const realtyPagination = document.getElementById('realty-pagination');
        
        fetch('/api/autocomplete?type=realty')
            .then(res => res.json())
            .then(titles => {
                autocomplete(document.getElementById("realty-search-input"), titles);
            }).catch(err => console.error("Autocomplete fetch error:", err));

        async function fetchAndRenderRealty(page = 1) {
            try {
                const category = categorySelect.value;
                const searchTerm = searchInput.value;
                const params = new URLSearchParams({
                    page,
                    category: category === '전체' ? '' : category,
                    search: searchTerm
                });
                
                const res = await fetch(`/api/realty?${params.toString()}`);
                const result = await res.json();
                const { data, totalPages, currentPage } = result;

                realtyGrid.innerHTML = '';
                if (data.length === 0) {
                    realtyGrid.innerHTML = '<p class="empty-message">검색된 매물이 없습니다.</p>';
                    renderPagination(0, 0, realtyPagination, fetchAndRenderRealty);
                    return;
                }

            data.forEach(item => {
                const realtyCard = document.createElement('a');
                realtyCard.href = `/realty/${item.id}`;
                realtyCard.className = 'realty-card';
                
                const thumbnailSrc = item.thumbnail || '/images/noimage.png';
                
                realtyCard.innerHTML = `
                <div class="realty-card-thumbnail">
                    <img src="${thumbnailSrc}" alt="${item.name}">
                    <div class="card-badge">
                        <div class="realty-card-price-badge">${item.price.type} ${item.price.value}</div>
                        <div class="realty-card-category-badge">${item.category}</div>
                    </div>
                </div>
                <div class="realty-card-info">
                    <h4 class="realty-card-title">${item.name}</h4>
                        <p class="realty-card-region"><i class="fa-solid fa-location-dot"></i>⠀${item.region}⠀│⠀<i class="fa-solid fa-truck-fast"></i>⠀${item.ipju}⠀│⠀<i class="fa-solid fa-screwdriver-wrench"></i>⠀${item.completedAt}</p>
                        <p class="realty-card-description">${item.description.substring(0, 60)}...</p>
                        <div class="realty-card-meta">
                            <span>${item.size.area_m2}블록</span>
                            <span>${item.floor}</span>
                            <span>${item.realtor.name}</span>
                        </div>
                    </div>
                `;
                realtyGrid.appendChild(realtyCard);
            });
             renderPagination(totalPages, currentPage, realtyPagination, fetchAndRenderRealty);
            } catch (error) {
                console.error('부동산 매물 로딩 실패:', error);
                realtyGrid.innerHTML = '<p class="empty-message">매물을 불러오는 중 오류가 발생했습니다.</p>';
            }
        }
        
        if (categorySelect) {
            categorySelect.addEventListener('change', () => fetchAndRenderRealty(1));
        }
        
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                fetchAndRenderRealty(1);
            });
        }
        
        fetchAndRenderRealty(1);
    }

    // --- 부동산 상세 페이지 (realty-detail.html) ---
    const realtyDetailContainer = document.getElementById('realty-detail-container');
    if (realtyDetailContainer) {
        const realtyId = window.location.pathname.split('/')[2];
        
        fetch(`/api/realty/${realtyId}`)
            .then(res => {
                if (!res.ok) throw new Error('매물을 불러오지 못했습니다.');
                return res.json();
            })
            .then(item => {
                document.title = `안현민국 │ ${item.name}`;

                // [수정] 슬라이드쇼 & 썸네일 HTML 생성 로직 개선 (전체화면 기능 추가)
                let imagesHTML = '';
                const images = item.images && item.images.length > 0 ? item.images : [item.thumbnail];
                
                if (images.length > 0) {
                    const slides = images.map((img, index) => `
                        <div class="realty-slide ${index === 0 ? 'active' : ''}" style="display: ${index === 0 ? 'flex' : 'none'};">
                            <img src="${img}" alt="${item.name} 이미지 ${index + 1}">
                        </div>
                    `).join('');

                    const controls = images.length > 1 ? `
                        <div class="realty-slide-controls">
                            <button class="realty-control-btn prev-btn"><i class="fa-solid fa-chevron-left"></i></button>
                            <button class="realty-control-btn next-btn"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                    ` : '';

                    const thumbnailsHTML = images.length > 1 ? `<div class="realty-thumbnails-container"></div>` : '';

                    const expandBtn = `<button class="realty-expand-btn" title="전체화면 보기"><i class="fa-solid fa-expand"></i></button>`;
                    const closeBtn = `<button class="realty-close-btn" title="닫기"><i class="fa-solid fa-xmark"></i></button>`;
                    const counterHTML = images.length > 1 ? `<span class="realty-slide-counter">1 / ${images.length}</span>` : '';

                    imagesHTML = `
                        <div class="realty-slideshow-wrapper" id="realty-slideshow-wrapper">
                            ${closeBtn}
                            <div class="realty-slideshow-container">
                                ${slides}
                                ${controls}
                                ${counterHTML}
                                ${expandBtn}
                            </div>
                            ${thumbnailsHTML}
                        </div>
                    `;
                }
                
                realtyDetailContainer.innerHTML = `
                    <div class="realty-detail-header">
                        <span class="realty-detail-category-badge">${item.category}</span>
                        <span class="realty-detail-region-badge">${item.region}</span>
                        <h1>${item.name}</h1>
                        <p class="realty-detail-address"><i class="fa-solid fa-location-dot"></i>⠀${item.address}</p>
                        <p class="realty-detail-address"><i class="fa-solid fa-screwdriver-wrench"></i>⠀${item.completedAt}⠀│⠀<i class="fa-solid fa-truck-fast"></i>⠀${item.ipju}</p>
                    </div>

                    ${imagesHTML}

                    <div class="realty-detail-content">
                        <div class="realty-detail-main-info">
                            <div class="info-item price">
                                <small>${item.price.type}</small>
                                <strong>${item.price.value}</strong>
                            </div>
                            <div class="info-item">
                                <small>면적</small>
                                <strong>${item.size.area_m2}블록</strong>
                            </div>
                             <div class="info-item">
                                <small>층수</small>
                                <strong>${item.floor}</strong>
                            </div>
                        </div>

                        <hr class="divider">

                        <h3>매물 설명</h3>
                        <p class="realty-detail-description">${item.description.replace(/\n/g, '<br>')}</p>
                        
                        <hr class="divider">

                        <h3>면적 정보</h3>
                        <p>가로 ${item.size.blocks_w}블록, 세로 ${item.size.blocks_h}블록 크기로 <strong>총 면적은 ${item.size.area_m2}블록입니다.</strong></p>

                        <hr class="divider">
                        
                        <h3>중개사 정보</h3>
                        <p>중개수수료는 상호 간의 합의 하에 결정됩니다.</p>
                        <div class="realtor-info">
                            <p><strong><i class="fa-solid fa-store"></i>⠀중개사:</strong> ${item.realtor.name}</p>
                            <p><strong><i class="fa-solid fa-phone"></i>⠀연락처:</strong> ${item.realtor.contact}</p>
                        </div>
                    </div>
                `;

                if (images.length > 0) { 
                    const wrapper = document.getElementById('realty-slideshow-wrapper');
                    const sliderContainer = wrapper.querySelector('.realty-slideshow-container');
                    const thumbContainer = wrapper.querySelector('.realty-thumbnails-container');
                    
                    if (images.length > 1) {
                        new TouchSlider(sliderContainer, {
                            itemSelector: '.realty-slide',
                            prevBtnSelector: '.prev-btn',
                            nextBtnSelector: '.next-btn',
                            counterSelector: '.realty-slide-counter',
                            activeClass: 'active',
                            autoplay: false, 
                            enableTouch: true,
                            thumbnailContainer: thumbContainer
                        });
                    }

                    const expandButton = wrapper.querySelector('.realty-expand-btn');
                    const closeButton = wrapper.querySelector('.realty-close-btn');

                    if (expandButton) {
                        expandButton.addEventListener('click', (e) => {
                            e.stopPropagation(); 
                            wrapper.classList.add('fullscreen');
                            document.body.style.overflow = 'hidden'; 
                        });
                    }

                    if (closeButton) {
                        closeButton.addEventListener('click', (e) => {
                            e.stopPropagation();
                            wrapper.classList.remove('fullscreen');
                            document.body.style.overflow = '';
                        });
                    }

                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape' && wrapper.classList.contains('fullscreen')) {
                            wrapper.classList.remove('fullscreen');
                            document.body.style.overflow = '';
                        }
                    });
                }

                // [수정] 관리자 또는 본인이 등록한 매물인 경우 삭제 버튼 표시
                if (userRole === 'admin' || (userRole === 'realtor' && item.uploader === loggedInUser)) {
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'button-danger realty-delete-button';
                    deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>⠀매물 삭제';
                    deleteButton.style.marginTop = '20px';
                    
                    deleteButton.addEventListener('click', async () => {
                        if (!confirm('정말로 이 매물을 삭제하시겠습니까?\n삭제된 데이터와 이미지 파일은 복구할 수 없습니다.')) {
                            return;
                        }
                        try {
                            const response = await fetch(`/api/realty/${realtyId}`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username: localStorage.getItem('loggedInUser') })
                            });
                            const result = await response.json();
                            if (response.ok) {
                                showToast(result.message, 'success');
                                setTimeout(() => window.location.href = '/realty', 1000);
                            } else {
                                showToast(result.message, 'error');
                            }
                        } catch (error) {
                            console.error('매물 삭제 실패:', error);
                            showToast('매물 삭제 중 오류가 발생했습니다.', 'error');
                        }
                    });
                    realtyDetailContainer.appendChild(deleteButton);
                }
            })
            .catch(error => {
                console.error('부동산 상세 정보 로딩 실패:', error);
                realtyDetailContainer.innerHTML = `<p class="empty-message">${error.message}</p>`;
            });
    }

    // --- 새 매물 등록 페이지 (write-realty.html) ---
    const realtyFormPage = document.getElementById('realty-form-page');
    if (realtyFormPage) {
        const username = localStorage.getItem('loggedInUser');
        // [수정] 관리자 또는 공인중개사만 접근 가능
        if (userRole !== 'admin' && userRole !== 'realtor') {
            showToast('권한이 없습니다.', 'error');
            setTimeout(() => window.location.href = '/realty', 1000);
            return;
        }

        const realtyForm = document.getElementById('realty-form');
        realtyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = realtyForm.querySelector('button[type="submit"]');
            
            const formData = new FormData(realtyForm);
            formData.append('username', username);

            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>⠀등록 중...';

            try {
                const response = await fetch('/api/realty', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    showToast(result.message, 'success');
                    setTimeout(() => window.location.href = '/realty', 1000);
                } else {
                    showToast(result.message || '매물 등록에 실패했습니다.', 'error');
                }
            } catch (error) {
                console.error('매물 등록 오류:', error);
                showToast('매물 등록 중 오류가 발생했습니다.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fa-solid fa-plus"></i>⠀매물 등록';
            }
        });
    }
});