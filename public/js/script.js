document.addEventListener('DOMContentLoaded', () => {
    console.log('안현특별시청 홈페이지 스크립트 로드 완료.');

    // --- 공통: Toastify 알림 함수 ---
    function showToast(message, type = 'info') {
        const colors = {
            info: 'linear-gradient(to right, #007bff, #0056b3)',
            success: 'linear-gradient(to right, #28a745, #218838)',
            error: 'linear-gradient(to right, #dc3545, #c82333)'
        };
        Toastify({
            text: message,
            duration: 4000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: colors[type] || colors['info'],
                borderRadius: "5px"
            }
        }).showToast();
    }

// --- 페이지 상단 환영 메시지 표시 ---
const loggedInUser = localStorage.getItem('loggedInUser');
const loggedInRealName = localStorage.getItem('loggedInRealName');
const welcomeSection = document.getElementById('user-welcome-section');

if (loggedInUser && loggedInRealName && welcomeSection) {
    // 환영 메시지 내용 설정 (textContent 대신 innerHTML 사용)
    document.getElementById('welcome-message').innerHTML = `<i class="fa-solid fa-quote-left"></i>⠀${loggedInRealName} 님, 좋은 하루 보내고 계신가요?⠀<i class="fa-solid fa-quote-right"></i>`;
    document.getElementById('login-status-info').innerHTML = `<i class="fa-solid fa-user-check"></i>⠀${loggedInUser} 아이디로 접속 중입니다`;
    
    // 숨겨져 있던 환영 메시지 섹션을 보이게 함
    welcomeSection.style.display = 'block';
}

    // --- 공통 로그인 상태 UI 처리 (안정적으로 수정됨) ---
    function checkLoginStatus() {
        const headerAuthStatus = document.getElementById('header-auth-status');
        if (!headerAuthStatus) return;
        
        const loggedInUsername = localStorage.getItem('loggedInUser');
        const path = window.location.pathname;

        if (loggedInUsername) {
            const logoutHTML = `<a href="#" id="logout-button">로그아웃</a>`;
            const mypageHTML = `<a href="/mypage">마이페이지</a><span style="color: #ccc; margin: 0 5px;">|</span>`;
            
            headerAuthStatus.innerHTML = mypageHTML + logoutHTML;
            
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    localStorage.removeItem('loggedInUser');
                    localStorage.removeItem('loggedInRealName');
                    showToast('로그아웃 되었습니다.');
                    setTimeout(() => {
                        // 로그인 필수 페이지에 있었다면 메인으로 보냄
                        if (path.includes('/mypage') || path.includes('/complaints') || path.includes('/write-news') || path.includes('/write-post')) {
                            window.location.href = '/';
                        } else {
                            window.location.reload();
                        }
                    }, 500);
                });
            }
        } else {
            const signupLink = `<a href="/signup">회원가입</a>`;
            const loginLink = `<a href="/login">로그인</a>`;
            
            if (path.includes('/login')) {
                 headerAuthStatus.innerHTML = signupLink;
            } else if (path.includes('/signup')) {
                 headerAuthStatus.innerHTML = loginLink;
            } else {
                 headerAuthStatus.innerHTML = `${loginLink}<span style="color: #ccc; margin: 0 5px;">|</span>${signupLink}`;
            }
        }
    }
    checkLoginStatus();

// --- index.html 전용 기능들 ---
const mainBanner = document.querySelector('.main-banner');

if (mainBanner) {
    // 메인 배너 슬라이드쇼
    const slides = document.querySelectorAll('.main-banner .slide-item');
    if (slides.length > 1) { 
        const nextButton = document.getElementById('next-slide');
        const prevButton = document.getElementById('prev-slide');
        const pauseButton = document.getElementById('pause-btn');
        const counter = document.getElementById('slide-counter');
        
        let currentSlide = 0;
        let slideInterval;
        let isPaused = false;

        function showSlide(index) {
            // 모든 슬라이드의 active 클래스를 일단 제거하고, 현재 인덱스에만 추가
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });

            // 현재 슬라이드의 data-slide-number 값을 읽어와 번호 표시
            if (counter) {
                const currentSlideElement = slides[index];
                const slideNumber = currentSlideElement.dataset.slideNumber;
                counter.textContent = `${slideNumber} / ${slides.length}`;
            }
        }

        function next() {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }

        function prev() {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            showSlide(currentSlide);
        }

        function startSlideShow() {
            isPaused = false;
            clearInterval(slideInterval);
            slideInterval = setInterval(next, 2750);
            if(pauseButton) pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }

        function pauseSlideShow() {
            isPaused = true;
            clearInterval(slideInterval);
            if(pauseButton) pauseButton.innerHTML = '<i class="fa-solid fa-play"></i>';
        }

        nextButton.addEventListener('click', (e) => {
            e.preventDefault();
            next();
            if (!isPaused) {
                startSlideShow();
            }
        });

        prevButton.addEventListener('click', (e) => {
            e.preventDefault();
            prev();
            if (!isPaused) {
                startSlideShow();
            }
        });

        if (pauseButton) {
            pauseButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (isPaused) {
                    startSlideShow();
                } else {
                    pauseSlideShow();
                }
            });
        }
        
        // 초기 슬라이드 표시 및 자동 재생 시작
        showSlide(currentSlide);
        startSlideShow();
    }

        // 탭 메뉴 기능
        const tabNav = document.querySelector('.tab-nav');
        if (tabNav) {
            tabNav.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-button')) {
                    const tabId = e.target.dataset.tab;
                    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === tabId));
                }
            });
        }
        
// 최신/인기 소식 목록 불러오기
        const latestNewsList = document.getElementById('latest-news-list');
        const popularNewsList = document.getElementById('popular-news-list');
        if (latestNewsList && popularNewsList) {
            fetch('/api/news').then(res => res.json()).then(news => {
                latestNewsList.innerHTML = '';
                news.slice(0, 7).forEach(article => {
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="/news/${article.id}">${article.title}</a><span>${new Date(article.createdAt).toLocaleDateString()}</span>`;
                    latestNewsList.appendChild(li);
                });
                popularNewsList.innerHTML = '';

                news.sort((a, b) => b.likes - a.likes).slice(0, 7).forEach(article => {
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="/news/${article.id}"><i class="fa-solid fa-fire"></i>⠀${article.title}</a><span><i class="fa-solid fa-thumbs-up"></i> ${article.likes}</span>`;
                    popularNewsList.appendChild(li);
                });
            });
        }}

    // --- 의견 페이지 전용 ---
    const complaintFormPage = document.getElementById('civil-complaints-page');
    if(complaintFormPage) {
        const authorInput = document.getElementById('author');
        const loggedInRealName = localStorage.getItem('loggedInRealName');
        if (authorInput && loggedInRealName) {
            authorInput.value = loggedInRealName;
        } else if (authorInput) {
            authorInput.placeholder = '로그인 후 이용 가능합니다.';
        }

        const complaintForm = document.getElementById('complaint-form');
        const complaintsList = document.getElementById('complaints-list');
        async function displayComplaints() {
            try {
                const response = await fetch('/api/complaints');
                const complaints = await response.json();
                complaintsList.innerHTML = '';
                if (complaints.length === 0) {
                    complaintsList.innerHTML = '<p>제출된 의견이 없습니다.</p>';
                    return;
                }
                complaints.reverse().forEach(c => {
                    const complaintDiv = document.createElement('div');
                    complaintDiv.className = 'complaint-item';
                    complaintDiv.innerHTML = `<h4>${c.title}</h4><p>${c.content}</p><small>작성자: ${c.author} | 작성일: ${c.date}</small>`;
                    complaintsList.appendChild(complaintDiv);
                });
            } catch (error) { console.error('의견 목록 로딩 실패:', error); }
        }
        complaintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = localStorage.getItem('loggedInUser');
            const realName = localStorage.getItem('loggedInRealName');
            if (!username) return showToast('로그인 후 의견을 제출할 수 있습니다.', 'error');
            try {
                const response = await fetch('/api/complaints', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ author: realName, username, title: e.target.title.value, content: e.target.content.value })
                });
                if (response.ok) {
                    e.target.title.value = '';
                    e.target.content.value = '';
                    showToast('의견이 정상적으로 제출되었습니다.', 'success');
                    displayComplaints();
                } else { showToast('의견 제출 실패', 'error'); }
            } catch (error) { console.error('의견 제출 오류:', error); }
        });
        displayComplaints();
    }

    // --- 회원가입 페이지 전용 ---
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const verifySection = document.getElementById('verify-section');
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('signup-submit-btn');
            
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');

            const { realName, dob, email, username, password } = e.target.elements;
            
            if (!/^[a-z]{1,10}$/.test(username.value)) {
                showToast('아이디는 10자 이하의 영어 소문자여야 합니다.', 'error');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                return;
            }
            if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(password.value)) {
                showToast('비밀번호는 15자 이하의 영문 대/소문자, 숫자, 기호를 모두 포함해야 합니다.', 'error');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                return;
            }

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ realName: realName.value, dob: dob.value, email: email.value, username: username.value, password: password.value })
                });
                const result = await response.json();
                showToast(result.message, response.ok ? 'success' : 'error');
                if (response.ok) {
                    signupForm.classList.add('hidden');
                    verifySection.classList.remove('hidden');
                }
            } catch (error) {
                console.error('회원가입 요청 실패:', error);
                showToast('회원가입 요청 중 오류가 발생했습니다.', 'error');
            } finally {
                submitBtn.disabled = false; 
                submitBtn.classList.remove('loading');
            }
        });
        verifySection.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const code = document.getElementById('verification-code').value;
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code })
                });
                const result = await response.json();
                showToast(result.message, response.ok ? 'success' : 'error');
                if (response.ok) setTimeout(() => window.location.href = '/login', 1000);
            } catch (error) { console.error('인증 요청 실패:', error); }
        });
    }

    // --- 로그인 페이지 전용 ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await response.json();
                if (!response.ok) return showToast(result.message, 'error');
                
                showToast(result.message, 'success');
                localStorage.setItem('loggedInUser', result.username);
                localStorage.setItem('loggedInRealName', result.realName);
                setTimeout(() => window.location.href = '/', 1000);
            } catch (error) { console.error('로그인 요청 실패:', error); }
        });
    }

    // --- 비밀번호 찾기 페이지 전용 ---
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
                const response = await fetch('/api/request-password-reset', {
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
                const response = await fetch('/api/reset-password', {
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

    // --- 마이페이지 전용 ---
    const myPageMain = document.getElementById('my-page-main');
    if (myPageMain) {
        const username = localStorage.getItem('loggedInUser');
        if (!username) {
            showToast('로그인이 필요합니다.', 'error');
            setTimeout(() => window.location.href = '/login', 1000);
            return;
        }
        
        const myComplaintsList = document.getElementById('my-complaints-list');
        if (myComplaintsList) {
            async function displayMyComplaints() {
                try {
                    const response = await fetch(`/api/my-complaints?username=${username}`);
                    const complaints = await response.json();
                    myComplaintsList.innerHTML = '';
                    if(complaints.length === 0) {
                        myComplaintsList.innerHTML = '<p>작성한 의견이 없습니다.</p>';
                        return;
                    }
                    complaints.reverse().forEach(c => {
                        const complaintDiv = document.createElement('div');
                        complaintDiv.className = 'my-complaint-item';
                        complaintDiv.innerHTML = `<div><h4>${c.title}</h4><p>${c.content}</p><small><i class="fa-solid fa-calendar-days"></i>⠀${c.date}</small></div><button class="delete-complaint-btn" data-id="${c.id}"><i class="fa-solid fa-trash-can"></i>⠀삭제</i></button>`;
                        myComplaintsList.appendChild(complaintDiv);
                    });
                } catch (error) { console.error('내 의견 목록 로딩 실패:', error); }
            }
            myComplaintsList.addEventListener('click', async (e) => {
                if (e.target.classList.contains('delete-complaint-btn')) {
                    if (!confirm('정말로 이 의견을 삭제하시겠습니까?')) return;
                    const complaintId = e.target.dataset.id;
                    try {
                        const response = await fetch(`/api/complaints/${complaintId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
                        const result = await response.json();
                        showToast(result.message, response.ok ? 'success' : 'error');
                        if (response.ok) displayMyComplaints();
                    } catch (error) { console.error('의견 삭제 실패:', error); }
                }
            });
            displayMyComplaints();
        }

        const myNewsSection = document.getElementById('my-news-section');
        if (username === 'admin' && myNewsSection) {
            myNewsSection.classList.remove('hidden');
            const myNewsList = document.getElementById('my-news-list');
            async function displayMyNews() {
                try {
                    const response = await fetch(`/api/my-news?username=${username}`);
                    const news = await response.json();
                    myNewsList.innerHTML = '';
                    if (news.length === 0) { myNewsList.innerHTML = '<p>작성한 소식이 없습니다.</p>'; return; }
                    news.reverse().forEach(article => {
                        const newsDiv = document.createElement('div');
                        newsDiv.className = 'my-news-item';
                        newsDiv.innerHTML = `<div><h4>${article.title}</h4><small><i class="fa-solid fa-calendar-days"></i>⠀${new Date(article.createdAt).toLocaleDateString()}</small></div><button class="delete-news-btn" data-id="${article.id}"><i class="fa-solid fa-trash-can"></i>⠀삭제</i></button>`;
                        myNewsList.appendChild(newsDiv);
                    });
                } catch (error) { console.error('내 소식 목록 로딩 실패:', error); }
            }
            myNewsList.addEventListener('click', async (e) => {
                if (e.target.classList.contains('delete-news-btn')) {
                    if (!confirm('정말로 이 소식을 삭제하시겠습니까?')) return;
                    const articleId = e.target.dataset.id;
                    try {
                        const response = await fetch(`/api/news/${articleId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
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
                    const response = await fetch(`/api/my-posts?username=${username}`);
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
                }
            }

            myPostsList.addEventListener('click', async (e) => {
                if (e.target.classList.contains('delete-post-btn')) {
                    if (!confirm('정말로 이 게시물을 삭제하시겠습니까?')) return;
                    const postId = e.target.dataset.id;
                    try {
                        const response = await fetch(`/api/posts/${postId}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username })
                        });
                        const result = await response.json();
                        showToast(result.message, response.ok ? 'success' : 'error');
                        if (response.ok) {
                            displayMyPosts(); // 목록 새로고침
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
                try {
                    const response = await fetch('/api/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, currentPassword, newPassword }) });
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
                    const response = await fetch('/api/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                    const result = await response.json();
                    showToast(result.message, response.ok ? 'success' : 'error');
                    if (response.ok) {
                        localStorage.removeItem('loggedInUser');
                        localStorage.removeItem('loggedInRealName');
                        setTimeout(() => window.location.href = '/', 1000);
                    }
                } catch (error) { console.error('회원 탈퇴 실패:', error); }
            });
        }
    }
    
    // --- 주요일정 페이지 전용 ---
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        const adminSection = document.getElementById('admin-only-section');
        const scheduleForm = document.getElementById('schedule-form');
        const loggedInUsername = localStorage.getItem('loggedInUser');
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

        if (loggedInUsername === 'admin') adminSection.classList.remove('hidden');
        
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const date = document.getElementById('schedule-date').value;
                const content = document.getElementById('schedule-content').value;
                try {
                    const response = await fetch('/api/schedules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date, content, username: loggedInUsername })
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

    // --- [수정] 시정소식 목록 페이지(news.html) 전용 ---
    const newsListContainer = document.getElementById('news-list-container');
    if (newsListContainer) {
        const categoryFilter = document.getElementById('category-filter');
        const searchForm = document.getElementById('search-form');
        const searchInput = document.getElementById('search-input');

        // 관리자일 경우 글쓰기 버튼 표시
        if (localStorage.getItem('loggedInUser') === 'admin') {
            document.getElementById('write-news-button').classList.remove('hidden');
        }

        // 뉴스 목록을 가져와서 렌더링하는 함수
        async function fetchAndRenderNews(category = '전체', searchTerm = '') {
            try {
                let url = `/api/news?category=${encodeURIComponent(category)}`;
                if (searchTerm) {
                    url += `&search=${encodeURIComponent(searchTerm)}`;
                }
                const res = await fetch(url);
                const news = await res.json();
                
                newsListContainer.innerHTML = '';
                if (news.length === 0) {
                    newsListContainer.innerHTML = '<p class="empty-message"><i class="fa-solid fa-bell"></i>⠀해당 조건에 맞는 소식이 없습니다.</p>';
                    return;
                }

                news.forEach(article => {
                    const articleLink = document.createElement('a');
                    articleLink.href = `/news/${article.id}`;
                    articleLink.className = 'news-item';
                    articleLink.innerHTML = `
                        <h3>${article.title}</h3>
                        <div class="news-item-meta">
                            <span class="news-item-category">${article.category}</span>
                            <span><i class="fa-solid fa-at"></i>⠀${article.author}</span>
                            <span><i class="fa-solid fa-calendar-days"></i>⠀${new Date(article.createdAt).toLocaleDateString()}</span>
                            <span><i class="fa-regular fa-thumbs-up"></i>⠀${article.likes}</span>
                        </div>
                    `;
                    newsListContainer.appendChild(articleLink);
                });
            } catch (error) {
                console.error('소식 로딩 실패:', error);
                newsListContainer.innerHTML = '<p class="empty-message">소식을 불러오는 중 오류가 발생했습니다.</p>';
            }
        }

        // 카테고리 필터 변경 시 이벤트
        categoryFilter.addEventListener('change', () => {
            const selectedCategory = categoryFilter.value;
            const searchTerm = searchInput.value;
            fetchAndRenderNews(selectedCategory, searchTerm);
        });

        // 검색 폼 제출 시 이벤트
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedCategory = categoryFilter.value;
            const searchTerm = searchInput.value;
            fetchAndRenderNews(selectedCategory, searchTerm);
        });

        // 초기 로드
        fetchAndRenderNews();
    }


    // --- 새 소식 작성 페이지(write_news.html) 전용 ---
    const newsForm = document.getElementById('news-form');
    if (newsForm) {
        const username = localStorage.getItem('loggedInUser');
        if (username !== 'admin') {
            showToast('권한이 없습니다.', 'error');
            setTimeout(() => window.location.href = '/news', 1000);
        }

        const editor = new toastui.Editor({
            el: document.querySelector('#editor'),
            height: '500px',
            initialEditType: 'markdown',
            previewStyle: 'vertical',
            placeholder: '내용을 입력하세요.\n이미지를 첨부하려면 마크다운 형식 `![이미지 설명](URL)` 또는 `![URL]`을 사용하세요.'
        });

        newsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('news-title').value;
            const category = document.getElementById('news-category').value; // [추가]
            const content = editor.getMarkdown();

            if (category === 'none') {
                showToast('카테고리를 선택해주세요.', 'error');
                return;
            }

            const response = await fetch('/api/news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, username, category }) // [수정]
            });

            if (response.ok) {
                showToast('게시물이 등록되었습니다.', 'success');
                setTimeout(() => window.location.href = '/news', 1000);
            } else {
                const result = await response.json();
                showToast(result.message || '게시물 등록에 실패했습니다.', 'error');
            }
        });
    }

    // --- 게시물 상세 페이지(article.html) 전용 ---
    const articleContainer = document.getElementById('article-container');
    if (articleContainer) {
        const articleId = window.location.pathname.split('/')[2];
        async function fetchAndRenderArticle() {
            try {
                const res = await fetch(`/api/news/${articleId}`);
                if (!res.ok) throw new Error('게시물을 불러오지 못했습니다.');
                const article = await res.json();
                
                document.title = `안현특별시 │ ${article.title}`;
                
                articleContainer.innerHTML = `
                    <h2>${article.title}</h2>
                    <div class="article-meta">
                        <span class="article-category-badge">${article.category}</span>
                        <span><i class="fa-solid fa-at"></i>⠀${article.author}</span>
                        <span><i class="fa-solid fa-calendar-days"></i>⠀${new Date(article.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div id="viewer"></div>
                    <div class="vote-section">
                        <button class="vote-button" id="like-button"><i class="fa-solid fa-thumbs-up"></i>⠀<span id="like-count">${article.likes}</span></button>
                        <button class="vote-button" id="dislike-button"><i class="fa-solid fa-thumbs-down"></i>⠀<span id="dislike-count">${article.dislikes}</span></button>
                    </div>
                `;
                
                // ❗ [수정된 부분] viewer 생성을 new toastui.Editor()로 변경하고 viewer: true 옵션 추가
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
            const loggedInUser = localStorage.getItem('loggedInUser');
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
        if (localStorage.getItem('loggedInUser')) {
            document.getElementById('write-post-button').classList.remove('hidden');
        }
        fetch('/api/posts').then(res => res.json()).then(posts => {
            communityGrid.innerHTML = '';
            if (posts.length === 0) {
                communityGrid.innerHTML = '<p class="empty-message">아직 등록된 게시물이 없습니다.</p>';
                return;
            }
            posts.forEach(post => {
                const postCard = document.createElement('a');
                postCard.href = `/post/${post.id}`;
                postCard.className = 'post-card';
                
                const thumbnailSrc = post.image || '/images/noimage.png';
                const thumbnail = `<img src="${thumbnailSrc}" alt="${post.title}" class="post-thumbnail">`;
                
                postCard.innerHTML = `${thumbnail}<div class="post-card-content"><h4 class="post-card-title">${post.title}</h4><p class="post-card-author"><i class="fa-solid fa-at"></i>⠀${post.realName}</p><p class="post-card-likes"><span><i class="fa-regular fa-thumbs-up"></i>⠀${post.likes}</span></p></div>`;
                communityGrid.appendChild(postCard);
            });
        });
    }

    // --- 새 커뮤니티 게시물 작성 페이지 (write-post.html) ---
    const postForm = document.getElementById('post-form');
    if (postForm) {
        const username = localStorage.getItem('loggedInUser');
        const realName = localStorage.getItem('loggedInRealName');
        if (!username) {
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
            formData.append('username', username);
            formData.append('realName', realName);
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

        function renderComments(comments, loggedInUser) {
            const commentList = document.getElementById('comment-list');
            commentList.innerHTML = '';
            if (!comments || comments.length === 0) {
                commentList.innerHTML = '<p>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>';
                return;
            }

            comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(comment => {
                const commentDiv = document.createElement('div');
                commentDiv.className = 'comment-item';
                commentDiv.id = `comment-${comment.id}`; 
                
                const formattedContent = comment.content.replace(/\n/g, '<br>');
                const isEdited = comment.updatedAt ? ` <span class="edited-badge">(수정됨)</span>` : '';
                const editedTimestamp = comment.updatedAt ? new Date(comment.updatedAt).toLocaleString() : new Date(comment.createdAt).toLocaleString();


                const actionButtons = (loggedInUser && loggedInUser === comment.author) 
                    ? `<div class="comment-actions">
                         <button class="button-link edit-comment-btn" data-comment-id="${comment.id}">수정</button>
                         <button class="button-link delete-comment-btn" data-comment-id="${comment.id}">삭제</button>
                       </div>` 
                    : '';

                commentDiv.innerHTML = `
                    <p class="comment-author">${comment.realName}</p>
                    <div class="comment-content-wrapper">
                        <div class="comment-text-content">${formattedContent}</div>
                        <p class="comment-date">${editedTimestamp}${isEdited}</p>
                    </div>
                    ${actionButtons}
                `;
                commentList.appendChild(commentDiv);
            });
        }
        
        async function fetchAndRenderPost() {
            try {
                const res = await fetch(`/api/posts/${postId}`);
                if (!res.ok) throw new Error('게시물을 불러오지 못했습니다.');
                
                const post = await res.json();
                document.title = `안현특별시 │ ${post.title}`;
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
                const loggedInUser = localStorage.getItem('loggedInUser');

                commentSection.classList.remove('hidden');
                renderComments(post.comments, loggedInUser);

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
                                    realName: localStorage.getItem('loggedInRealName'),
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

        const commentList = document.getElementById('comment-list');
        commentList.addEventListener('click', async (e) => {
            const loggedInUser = localStorage.getItem('loggedInUser');
            if (!loggedInUser) return;

            // 삭제 버튼
            if (e.target.classList.contains('delete-comment-btn')) {
                if (!confirm('정말로 댓글을 삭제하시겠습니까?')) return;
                
                const commentId = e.target.dataset.commentId;
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

            // 수정 버튼
            if (e.target.classList.contains('edit-comment-btn')) {
                const commentId = e.target.dataset.commentId;
                const commentItem = document.getElementById(`comment-${commentId}`);
                const contentDiv = commentItem.querySelector('.comment-text-content');
                const actionsDiv = commentItem.querySelector('.comment-actions');
                
                const existingEditForm = commentItem.querySelector('.comment-edit-form');
                if (existingEditForm) return;

                const originalContent = contentDiv.innerHTML.replace(/<br\s*\/?>/gi, "\n");
                
                // [수정] textarea를 .form-group div로 감싸서 스타일 일치시키기
                const editFormHTML = `
                    <div class="comment-edit-form">
                        <div class="form-group">
                            <textarea>${originalContent}</textarea>
                        </div>
                        <div class="button-group">
                            <button class="button-secondary button-small cancel-edit-btn">취소</button>
                            <button class="button-primary button-small save-comment-btn" data-comment-id="${commentId}">저장</button>
                        </div>
                    </div>
                `;
                contentDiv.style.display = 'none';
                if (actionsDiv) actionsDiv.style.display = 'none'; 
                
                const wrapper = commentItem.querySelector('.comment-content-wrapper');
                wrapper.appendChild(document.createRange().createContextualFragment(editFormHTML));
            }

            // 저장 버튼
            if (e.target.classList.contains('save-comment-btn')) {
                const commentId = e.target.dataset.commentId;
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
            
            // 취소 버튼
            if (e.target.classList.contains('cancel-edit-btn')) {
                fetchAndRenderPost(); 
            }
        });

        async function votePost(voteType) {
            const loggedInUser = localStorage.getItem('loggedInUser');
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
    }})