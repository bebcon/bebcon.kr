document.addEventListener('DOMContentLoaded', () => {
  const loggedInUser = localStorage.getItem('loggedInUser');
  let currentEbooks = [];
  let currentPage = 1;
  let currentSearch = '';

  // DOM
  const overlay = document.getElementById('ebook-overlay');

  const ebookGrid = document.getElementById('ebook-grid');
  const paginationContainer = document.getElementById('pagination-container');
  const infoPanel = document.getElementById('info-panel');
  const panelContent = document.getElementById('panel-content');

  const searchInput = document.getElementById('ebook-search-input');
  const searchBtn = document.getElementById('ebook-search-btn');

  // 있으면 쓰고 없으면 그냥 패스 (HTML에 form 없을 수 있어서 안전 처리)
  const searchForm = document.getElementById('ebook-search-form');

  const acList = document.getElementById('ebook-autocomplete-list');

  /* =========================
     공용: 패널 닫기 (⭐핵심 FIX)
  ========================= */
  function closeInfoPanel() {
    if (infoPanel) infoPanel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }
  // 혹시 패널 내부에 닫기 버튼(onclick="closeInfoPanel()") 쓰고 싶으면
  window.closeInfoPanel = closeInfoPanel;

  // overlay 클릭 시 닫기
  if (overlay) {
    overlay.addEventListener('click', closeInfoPanel);
  }

  /* =========================
     헬퍼
  ========================= */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  }

  // 하이라이트(HTML 엔티티 때문에 꼬이는 문제 방지: raw 기반으로 index 계산)
  function highlight(rawText, keyword) {
    const text = rawText ?? '';
    const kw = keyword ?? '';
    if (!kw) return escapeHtml(text);

    const lowerText = text.toLowerCase();
    const lowerKw = kw.toLowerCase();
    const idx = lowerText.indexOf(lowerKw);
    if (idx < 0) return escapeHtml(text);

    const before = text.slice(0, idx);
    const mid = text.slice(idx, idx + kw.length);
    const after = text.slice(idx + kw.length);

    return `${escapeHtml(before)}<strong>${escapeHtml(mid)}</strong>${escapeHtml(after)}`;
  }

  const debounce = (fn, delay = 180) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  function showToast(message, type) {
    Toastify({
      text: message,
      backgroundColor: type === 'success' ? 'green' : 'red'
    }).showToast();
  }

  /* =========================
     API: 목록
  ========================= */
  async function fetchEbooks(page = 1, search = '') {
    try {
      const q = encodeURIComponent(search || '');
      const response = await fetch(`/api/ebooks?page=${page}&limit=12&search=${q}`);
      const data = await response.json();

      currentEbooks = data.ebooks || [];
      renderEbookList(currentEbooks);
      renderPagination(data.pagination);
    } catch (err) {
      console.error('전자책 로드 실패:', err);
      ebookGrid.innerHTML = '<p class="error-text">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    }
  }

  function renderEbookList(ebooks) {
    if (!ebooks || ebooks.length === 0) {
      ebookGrid.innerHTML = '<p class="empty-text">검색 결과가 없습니다.</p>';
      return;
    }

    ebookGrid.innerHTML = ebooks.map(book => `
      <div class="ebook-card" onclick="showBookInfo(${book.id})">
        <img src="${book.coverImage}" alt="${escapeHtml(book.title)}" class="cover-img" onerror="this.src='/images/default-ebook-cover.png'">
        <div class="info">
          <div class="title">${escapeHtml(book.title)}</div>
          <div class="author">${escapeHtml(book.author)}</div>
        </div>
      </div>
    `).join('');
  }

  /* =========================
     우측 패널 (모바일 overlay 포함)
  ========================= */
  window.showBookInfo = (id) => {
    const book = currentEbooks.find(b => b.id === id);
    if (!book) return;

    infoPanel.classList.add('active');

    // 모바일이면 overlay 켜기
    if (window.matchMedia('(max-width: 768px)').matches && overlay) {
      overlay.classList.add('active');
    }

    const isLiked = Array.isArray(book.likes) && book.likes.includes(loggedInUser);
    const likeCount = Array.isArray(book.likes) ? book.likes.length : 0;
    const isAuthor = loggedInUser && loggedInUser === book.authorId;

    panelContent.innerHTML = `
      <!-- (선택) 모바일 닫기 버튼 넣고 싶으면 아래 버튼 CSS만 추가하면 됨 -->
      <button class="panel-close-btn" onclick="closeInfoPanel()">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <img src="${book.coverImage}" alt="${escapeHtml(book.title)}" class="panel-cover" onerror="this.src='/images/default-ebook-cover.png'">
      <h2 class="panel-title">${escapeHtml(book.title)}</h2>

      <div class="panel-meta">
        <p><strong>작가:</strong> ${escapeHtml(book.author)}</p>
        <p><strong>출판:</strong> ${escapeHtml(book.publisher || '')}</p>
        <p><strong>발행:</strong> ${new Date(book.createdAt).toLocaleDateString()}</p>
        <p><strong>조회:</strong> ${book.views || 0} | <strong>좋아요:</strong> <span id="like-count">${likeCount}</span></p>
      </div>

      <div class="panel-desc">${escapeHtml(book.description || '상세 설명이 없습니다.')}</div>

      <div class="panel-btns">
        <a href="/ebook-reader/${book.id}" class="btn-read"><i class="fa-solid fa-book-open-reader"></i>⠀읽기 시작</a>
        <button onclick="toggleLike(${book.id})" class="btn-like" id="like-btn">
          <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>⠀${isLiked ? '좋아요 취소' : '좋아요'}
        </button>
      </div>

      ${isAuthor ? `
        <div class="admin-btns">
          <button onclick="location.href='/ebook-edit/${book.id}'" class="btn-edit"><i class="fa-solid fa-pen"></i>⠀수정</button>
          <button onclick="deleteEbook(${book.id})" class="btn-delete"><i class="fa-solid fa-trash"></i>⠀삭제</button>
        </div>
      ` : ''}
    `;
  };

  window.toggleLike = async (id) => {
    if (!loggedInUser) return showToast('로그인이 필요한 서비스입니다.', 'error');

    try {
      const response = await fetch(`/api/ebooks/${id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loggedInUser })
      });
      const result = await response.json();

      if (response.ok) {
        const likeBtn = document.getElementById('like-btn');
        const likeCountSpan = document.getElementById('like-count');

        if (likeBtn) {
          likeBtn.innerHTML = `<i class="${result.liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>⠀${result.liked ? '좋아요 취소' : '좋아요'}`;
        }
        if (likeCountSpan) likeCountSpan.innerText = result.count;

        showToast(result.message, 'success');
      } else {
        showToast(result.message || '처리 실패', 'error');
      }
    } catch (err) {
      showToast('처리 중 오류가 발생했습니다.', 'error');
    }
  };

  window.deleteEbook = async (id) => {
    if (!confirm('정말로 이 전자책을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/ebooks/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loggedInUser })
      });

      if (response.ok) {
        showToast('삭제되었습니다.', 'success');
        closeInfoPanel();
        fetchEbooks(currentPage, currentSearch);
      } else {
        const result = await response.json();
        showToast(result.message || '삭제 실패', 'error');
      }
    } catch (err) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  /* =========================
     페이지네이션 (pagination.css 적용)
     - .page-link로 렌더링
  ========================= */
  function renderPagination(paging) {
    if (!paging || !paginationContainer) return;

    const cur = paging.currentPage || 1;
    const total = paging.totalPages || 1;

    let html = '';

    html += `
      <button class="page-link" ${cur <= 1 ? 'disabled' : ''} onclick="goToPage(${cur - 1})">
        <i class="fa-solid fa-angle-left"></i>
      </button>
    `;

    for (let i = 1; i <= total; i++) {
      html += `<button class="page-link ${i === cur ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    html += `
      <button class="page-link" ${cur >= total ? 'disabled' : ''} onclick="goToPage(${cur + 1})">
        <i class="fa-solid fa-angle-right"></i>
      </button>
    `;

    paginationContainer.innerHTML = html;
  }

  window.goToPage = (page) => {
    if (page < 1) return;

    currentPage = page;
    fetchEbooks(page, currentSearch);

    closeAutocomplete();

    // 원하면 페이지 이동 때 패널도 닫기(모바일 UX 좋음)
    closeInfoPanel();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* =========================
     검색
  ========================= */
  function doSearch() {
    currentSearch = (searchInput.value || '').trim();
    currentPage = 1;

    fetchEbooks(1, currentSearch);

    closeAutocomplete();
    closeInfoPanel();
  }

  if (searchBtn) searchBtn.addEventListener('click', doSearch);

  // form 있으면 submit으로 엔터 처리
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      doSearch();
    });
  } else {
    // form이 없으면 input에서 엔터 감지
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSearch();
        }
      });
    }
  }

  /* =========================
     자동완성 (/api/search/suggest)
  ========================= */
  async function fetchSuggestions(keyword) {
    const q = encodeURIComponent(keyword);
    const response = await fetch(`/api/search/suggest?type=ebooks&limit=8&q=${q}`);
    const data = await response.json();
    return data.items || [];
  }

  function openAutocomplete(items, keyword) {
    if (!acList) return;
    if (!items.length) return closeAutocomplete();

    acList.innerHTML = items.map(b => `
      <div data-title="${escapeHtml(b.title)}" data-id="${b.id}">
        ${highlight(b.title, keyword)}
        <span style="color:#888; font-weight:500;"> — ${escapeHtml(b.author || '')}</span>
      </div>
    `).join('');

    acList.style.display = 'block';

    Array.from(acList.querySelectorAll('div')).forEach(div => {
      div.addEventListener('click', () => {
        searchInput.value = div.getAttribute('data-title') || '';
        doSearch();
      });
    });
  }

  function closeAutocomplete() {
    if (!acList) return;
    acList.style.display = 'none';
    acList.innerHTML = '';
  }

  const onType = debounce(async () => {
    const kw = (searchInput.value || '').trim();
    if (!kw) return closeAutocomplete();

    try {
      const items = await fetchSuggestions(kw);
      openAutocomplete(items, kw);
    } catch (e) {
      closeAutocomplete();
    }
  }, 180);

  if (searchInput) searchInput.addEventListener('input', onType);

  // 바깥 클릭 시 자동완성 닫기
  document.addEventListener('click', (e) => {
    const within = e.target.closest('.autocomplete-container');
    if (!within) closeAutocomplete();
  });

  // 초기
  fetchEbooks();
});
