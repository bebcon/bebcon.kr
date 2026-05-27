/**
 * /js/pages/home.js
 * Main page only: banner slider + service tabs + per-service secondary tabs + list rendering.
 * - News/Community/Ebooks: latest/popular
 * - Stocks: volume/gainers/losers
 * - Realty: latest/price_asc
 *
 * Notes:
 * - This file assumes your index.html contains:
 *   - .main-banner markup (for TouchSlider)
 *   - .tab-section with:
 *       - primary buttons: .tab-button[data-group="service"][data-tab="{service}"]
 *       - secondary nav container: .tab-nav--secondary  (EMPTY; JS will populate)
 *       - panes: .tab-pane[data-service="{service}"] each containing <ul id="service-list-{service}">
 *
 * And that your shared /js/script.js will skip its own home init when window.__HOME_JS_ACTIVE__ is true.
 */
(() => {
  // Flag for shared script.js to disable its own home-only logic
  window.__HOME_JS_ACTIVE__ = true;

  // Home guard: only run if main banner exists
  const mainBanner = document.querySelector('.main-banner');
  if (!mainBanner) return;

  // ========== Slider (optional) ==========
  try {
    if (typeof TouchSlider === 'function') {
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
    }
  } catch (err) {
    console.error('[home] slider init failed:', err);
  }

  // ========== Tabs config ==========
  const SORTS_BY_SERVICE = {
    news: [
      { key: 'latest', label: '최신' },
      { key: 'popular', label: '인기' },
    ],
    community: [
      { key: 'latest', label: '최신' },
      { key: 'popular', label: '인기' },
    ],
    ebooks: [
      { key: 'latest', label: '최신' },
      { key: 'popular', label: '인기' },
    ],
    stocks: [
      { key: 'volume', label: '거래량' },
      { key: 'gainers', label: '급등' },
      { key: 'losers', label: '급락' },
    ],
    realty: [
      { key: 'latest', label: '최신' },
      { key: 'price_asc', label: '가격낮은순' },
    ],
  };

  const DEFAULT_SORT = {
    news: 'latest',
    community: 'latest',
    ebooks: 'latest',
    stocks: 'volume',
    realty: 'latest',
  };

  const state = {
    service: 'news',
    sort: DEFAULT_SORT.news,
  };

  const cache = new Map(); // key: `${service}:${sort}` -> items

  const tabSection = document.querySelector('.tab-section');
  if (!tabSection) return;

  const primaryNav = tabSection.querySelector('.tab-nav--primary');
  const secondaryNav = tabSection.querySelector('.tab-nav--secondary');

  function setActiveButtons(group, tabValue) {
    tabSection.querySelectorAll(`.tab-button[data-group="${group}"]`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabValue);
    });
  }

  function setActivePane(service) {
    tabSection.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.dataset.service === service);
    });
  }

  function getListEl(service) {
    return document.getElementById(`service-list-${service}`);
  }

  // ---------- Helpers ----------
  function stockChangeRate(s) {
    const base = Number(s?.startingPrice) || 0;
    const cur = Number(s?.currentPrice) || 0;
    if (!base) return 0;
    return ((cur - base) / base) * 100;
  }

  // 월세 "보증금/월세" => [월세, 보증금]
  // 전세/매매 "5000" => [0, 5000]
  function parseRealtyPrice(p) {
    const type = p?.type || '';
    const raw = String(p?.value ?? '').trim();
    if (!raw) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

    if (type.includes('월세')) {
      const [dep, rent] = raw.split('/').map(v => Number(String(v).trim().replace(/,/g, '')) || 0);
      return [rent, dep];
    }

    const v = Number(raw.replace(/,/g, '')) || 0;
    return [0, v];
  }

  function formatNumberKR(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n ?? '');
    return num.toLocaleString('ko-KR');
  }

  function safeText(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // ---------- Secondary tabs render ----------
  function renderSecondaryTabs(service) {
    if (!secondaryNav) return DEFAULT_SORT[service] || 'latest';

    const sorts = SORTS_BY_SERVICE[service] || [];
    secondaryNav.innerHTML = sorts.map(s => (
      `<button class="tab-button" data-group="sort" data-tab="${s.key}">${s.label}</button>`
    )).join('');

    const defaultKey = DEFAULT_SORT[service] || (sorts[0]?.key ?? 'latest');
    setActiveButtons('sort', defaultKey);
    return defaultKey;
  }

  // ---------- Data fetching ----------
  async function fetchItems(service, sort) {
    const key = `${service}:${sort}`;

    // stocks are volatile; always refetch (no in-memory cache)
    if (service !== 'stocks') {
      if (cache.has(key)) return cache.get(key);
    }

const ul = getListEl(service);
    if (ul) ul.innerHTML = `<li style="padding:18px 25px;">불러오는 중...</li>`;

    try {
      let items = [];

      if (service === 'news') {
        if (sort === 'latest') {
          const r = await fetch('/api/news?page=1&limit=9');
          const json = await r.json();
          items = json.data || json.items || (Array.isArray(json) ? json : []);
          items = items.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        } else {
          const r = await fetch('/api/news');
          const json = await r.json();
          items = json.data || json.items || (Array.isArray(json) ? json : []);
          items = items.slice().sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        }
      }

      if (service === 'community') {
        const r = await fetch('/api/posts');
        const json = await r.json();
        const all = json.data || json.items || (Array.isArray(json) ? json : []);

        if (sort === 'latest') {
          items = all.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else {
          items = all.slice().sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        }
      }

      if (service === 'ebooks') {
        const limit = (sort === 'popular') ? 200 : 9;
        const r = await fetch(`/api/ebooks?page=1&limit=${limit}`);
        const json = await r.json();
        // IMPORTANT: your sample response uses { ebooks: [...] }
        const all = json.ebooks || json.data || json.items || (Array.isArray(json) ? json : []);

        if (sort === 'latest') {
          items = all.slice().sort((a, b) => (b.createdAt ?? b.updatedAt ?? 0) - (a.createdAt ?? a.updatedAt ?? 0));
        } else {
          items = all.slice().sort((a, b) => {
            const av = a.views ?? 0;
            const bv = b.views ?? 0;
            return (bv - av) || ((b.createdAt ?? b.updatedAt ?? 0) - (a.createdAt ?? a.updatedAt ?? 0));
          });
        }
      }

      if (service === 'stocks') {
        const r = await fetch(`/api/stocks/all?_=${Date.now()}`);
        const json = await r.json();
        const all = json.data || json.items || (Array.isArray(json) ? json : []);

        if (sort === 'volume') {
          items = all.slice().sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
        } else if (sort === 'gainers') {
          items = all.slice().sort((a, b) => stockChangeRate(b) - stockChangeRate(a));
        } else if (sort === 'losers') {
          items = all.slice().sort((a, b) => stockChangeRate(a) - stockChangeRate(b));
        } else {
          items = all;
        }
      }

      if (service === 'realty') {
        const r = await fetch('/api/realty?page=1&limit=9');
        const json = await r.json();
        const all = json.data || json.items || (Array.isArray(json) ? json : []);

        if (sort === 'latest') {
          items = all.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        } else if (sort === 'price_asc') {
          items = all.slice().sort((a, b) => {
            const [ar, ad] = parseRealtyPrice(a.price);
            const [br, bd] = parseRealtyPrice(b.price);
            return (ar - br) || (ad - bd);
          });
        } else {
          items = all;
        }
      }

      if (service !== 'stocks') cache.set(key, items);
      return items;
    } catch (err) {
      console.error(`[home] fetch failed: ${service}/${sort}`, err);
      return [];
    }
  }

  // ---------- Rendering ----------
  function renderList(service, sort, items) {
    const ul = getListEl(service);
    if (!ul) return;

    ul.innerHTML = '';
    if (!items || items.length === 0) {
      ul.innerHTML = `<li style="padding:18px 25px;">표시할 내용이 없습니다.</li>`;
      return;
    }

    items.slice(0, 9).forEach(item => {
      const li = document.createElement('li');

      let title = item.title || item.name || item.companyName || '제목 없음';
      let href = '#';
      let meta = '';

      if (service === 'news') {
        const id = item.id ?? item._id;
        href = id ? `/news/${id}` : '/news';
        meta = sort === 'latest'
          ? new Date(item.createdAt || Date.now()).toLocaleDateString('ko-KR')
          : `<i class="fa-regular fa-thumbs-up item-icon-thumb"></i> ${formatNumberKR(item.likes ?? 0)}`;
      }

      if (service === 'community') {
        const id = item.id ?? item._id;
        href = id ? `/post/${id}` : '/community';
        meta = sort === 'latest'
          ? (item.author || '익명')
          : `<i class="fa-regular fa-thumbs-up item-icon-thumb"></i> ${formatNumberKR(item.likes ?? 0)}`;
      }

      if (service === 'ebooks') {
        const id = item.id ?? item._id;
        href = id ? `/ebook-reader/${id}` : '/ebook-list.html';
        const likes = item.likes?.length ?? item.likesCount ?? 0;
        meta = `${safeText(item.author || '')} · 조회 ${formatNumberKR(item.views ?? 0)}`.trim();
      }

      if (service === 'stocks') {
        href = '/stock-main.html';
        const rate = stockChangeRate(item);
        const sign = rate > 0 ? '+' : '';
        meta = `${safeText(item.tickerCode || '')} · ${formatNumberKR(item.currentPrice)}원 · ${sign}${rate.toFixed(2)}% · 거래량 ${formatNumberKR(item.volume ?? 0)}`.trim();
      }

      if (service === 'realty') {
        href = '/realty';
        meta = `${safeText(item.region || '')} · ${safeText(item.price?.type || '')} ${safeText(item.price?.value || '')}`.trim();
      }

      li.innerHTML = `
        <a href="${href}" class="list-item-link">
          <span class="item-title">${safeText(title)}</span>
          <span class="item-meta">${meta}</span>
        </a>
      `;
      ul.appendChild(li);
    });
  }

  // ---------- Orchestration ----------
  async function loadCurrent() {
    setActiveButtons('service', state.service);
    setActiveButtons('sort', state.sort);
    setActivePane(state.service);

    const items = await fetchItems(state.service, state.sort);
    renderList(state.service, state.sort, items);
  }

  function handleClick(e) {
    const btn = e.target.closest('.tab-button');
    if (!btn) return;

    const group = btn.dataset.group;
    const tab = btn.dataset.tab;

    if (group === 'service') {
      state.service = tab;

      // regenerate secondary tabs for this service
      state.sort = renderSecondaryTabs(state.service);

      // activate primary + pane
      setActiveButtons('service', state.service);
      setActivePane(state.service);

      loadCurrent();
      return;
    }

    if (group === 'sort') {
      state.sort = tab;
      loadCurrent();
      return;
    }
  }

  primaryNav?.addEventListener('click', handleClick);
  secondaryNav?.addEventListener('click', handleClick);

  // initial
  state.sort = renderSecondaryTabs(state.service);
  loadCurrent();
})();
