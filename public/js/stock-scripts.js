document.addEventListener('DOMContentLoaded', () => {
    // 로그인 사용자명 가져오기 (문자열/JSON 모두 대응)
    const rawLoggedInUser = localStorage.getItem('loggedInUser');
    let loggedInUser = rawLoggedInUser;

    // "username"만 저장한 경우가 가장 흔하지만,
    // 혹시 {"username":"..."} 형태로 저장된 경우도 대비
    try {
        const parsed = JSON.parse(rawLoggedInUser);
        if (parsed && typeof parsed === 'object' && parsed.username) {
            loggedInUser = parsed.username;
        }
    } catch (_) {
        // raw string 그대로 사용
    }

    // 혹시 따옴표가 포함된 문자열이면 제거
    if (typeof loggedInUser === 'string') {
        loggedInUser = loggedInUser.trim().replace(/^"(.*)"$/, '$1');
    }

    // 숫자를 통화 형식(,)으로 변환하는 헬퍼 함수 (안전형)
    const formatCurrency = (number) => {
        const n = Number(number);
        return Number.isFinite(n) ? n.toLocaleString('ko-KR') : '0';
    };

    // 등락률에 따라 색상 클래스를 반환하는 헬퍼 함수
    const getPriceChangeClass = (change) => {
        if (change > 0) return 'price-up';
        if (change < 0) return 'price-down';
        return 'price-even';
    };

    // ✅ NaN/Infinity 방지용 공통 등락 계산기
    const safeChangeInfo = (stock) => {
        const cp = Number(stock?.currentPrice ?? 0);
        const sp = Number(stock?.startingPrice ?? 0);

        const change = cp - sp;
        const changeRate = sp > 0 ? (change / sp) * 100 : 0;

        const changeClass = getPriceChangeClass(change);
        const icon = change > 0 ? '▲' : (change < 0 ? '▼' : '-');

        return {
            change,
            changeRate,                 // number
            changeRateText: changeRate.toFixed(2),
            changeClass,
            icon
        };
    };

    /**
     * 주식 대시보드 페이지 (stock-main.html)
     */
    if (document.getElementById('stock-dashboard')) {
        fetch('/api/stocks/dashboard')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (!data || !data.topVolume) {
                    console.error("Received invalid data from dashboard API:", data);
                    throw new Error("Invalid data format from server.");
                }

                const { topMarketCap, topVolume, topPrice, topGainers, topLosers } = data;

                // 시가총액을 조, 억 단위로 변환하는 함수
                const formatMarketCap = (marketCap) => {
                    if (!marketCap) return '0원';
                    const trillion = Math.floor(marketCap / 1000000000000);
                    const billion = Math.floor((marketCap % 1000000000000) / 100000000);
                    if (trillion > 0) {
                        return `${trillion.toLocaleString()}조 ${billion.toLocaleString()}억원`;
                    }
                    return `${(marketCap / 100000000).toLocaleString()}억원`;
                };

                // 1. 시가총액 상위 (메인: 시가총액 / 서브: 주가)
                const createMarketCapListItem = (stock) => {
                    const { changeClass } = safeChangeInfo(stock);

                    return `
                        <li class="${changeClass}">
                            <a href="/stock-detail.html?code=${stock.tickerCode}">
                                <span class="stock-name">${stock.companyName}</span>
                                <div style="text-align: right;">
                                    <span style="font-size: 1em;">${formatMarketCap(stock.marketCap)}</span>
                                    <small style="font-size: 0.85em;">${formatCurrency(stock.currentPrice)}원</small>
                                </div>
                            </a>
                        </li>
                    `;
                };

                // 2. 거래량 상위 (메인: 거래량 / 서브: 주가)
                const createVolumeListItem = (stock) => {
                    const { changeClass } = safeChangeInfo(stock);

                    return `
                        <li class="${changeClass}">
                            <a href="/stock-detail.html?code=${stock.tickerCode}">
                                <span class="stock-name">${stock.companyName}</span>
                                <div style="text-align: right;">
                                    <span style="font-size: 1em;">${formatCurrency(stock.volume)}주</span>
                                    <small style="font-size: 0.85em;">${formatCurrency(stock.currentPrice)}원</small>
                                </div>
                            </a>
                        </li>
                    `;
                };

                // 3, 4, 5. 기본형 (메인: 주가 / 서브: 등락률)
                const createDefaultListItem = (stock) => {
                    const { changeClass, icon, changeRateText } = safeChangeInfo(stock);

                    // 서버가 changeRate를 내려주면(Top Gainers/Losers) 그 값을 우선 사용
                    const finalRateText =
                        stock.changeRate !== undefined && Number.isFinite(Number(stock.changeRate))
                            ? Number(stock.changeRate).toFixed(2)
                            : changeRateText;

                    return `
                        <li class="${changeClass}">
                            <a href="/stock-detail.html?code=${stock.tickerCode}">
                                <span class="stock-name">${stock.companyName}</span>
                                <div>
                                    <span>${formatCurrency(stock.currentPrice)}원</span>
                                    <small>${icon} ${finalRateText}%</small>
                                </div>
                            </a>
                        </li>
                    `;
                };

                // 티커(Ticker) 텍스트 생성 함수
                const updateTicker = () => {
                    const tickerContent = document.getElementById('stock-ticker-content');
                    if (!tickerContent) return;

                    let tickerHTML = '';

                    // 1. 시가총액 1위
                    if (topMarketCap.length > 0) {
                        const s = topMarketCap[0];
                        tickerHTML += `<span class="ticker-item"><i class="fa-solid fa-crown"></i> 시가총액 1위: <span>${s.companyName}</span> (${formatMarketCap(s.marketCap)})</span>`;
                    }

                    // 2. 거래량 1위
                    if (topVolume.length > 0) {
                        const s = topVolume[0];
                        tickerHTML += `<span class="ticker-item"><i class="fa-solid fa-fire"></i> 거래량 1위: <span>${s.companyName}</span> (${formatCurrency(s.volume)}주)</span>`;
                    }

                    // 3. 주가 1위
                    if (topPrice.length > 0) {
                        const s = topPrice[0];
                        tickerHTML += `<span class="ticker-item"><i class="fa-solid fa-gem"></i> 주가 1위: <span>${s.companyName}</span> (${formatCurrency(s.currentPrice)}원)</span>`;
                    }

                    // 4. 상승률 1위
                    if (topGainers.length > 0) {
                        const s = topGainers[0];
                        const rate =
                            s.changeRate !== undefined && Number.isFinite(Number(s.changeRate))
                                ? Number(s.changeRate).toFixed(2)
                                : safeChangeInfo(s).changeRateText;

                        tickerHTML += `<span class="ticker-item"><i class="fa-solid fa-arrow-trend-up"></i> 상승률 1위: <span>${s.companyName}</span> (+${rate}%)</span>`;
                    }

                    // 5. 하락률 1위
                    if (topLosers.length > 0) {
                        const s = topLosers[0];
                        const rate =
                            s.changeRate !== undefined && Number.isFinite(Number(s.changeRate))
                                ? Number(s.changeRate).toFixed(2)
                                : safeChangeInfo(s).changeRateText;

                        tickerHTML += `<span class="ticker-item"><i class="fa-solid fa-arrow-trend-down"></i> 하락률 1위: <span>${s.companyName}</span> (${rate}%)</span>`;
                    }

                    // 텍스트 반복 (끊김 없는 애니메이션을 위해)
                    tickerContent.innerHTML = tickerHTML + tickerHTML;
                };

                // 리스트 렌더링
                const populateList = (elementId, stocks, itemCreator) => {
                    const listElement = document.getElementById(elementId);
                    if (stocks && stocks.length > 0) {
                        listElement.innerHTML = stocks.map(itemCreator).join('');
                    } else {
                        listElement.innerHTML = '<li>해당 종목이 없습니다.</li>';
                    }
                };

                populateList('top-market-cap-list', topMarketCap, createMarketCapListItem);
                populateList('top-volume-list', topVolume, createVolumeListItem);
                populateList('top-price-list', topPrice, createDefaultListItem);
                populateList('top-gainers-list', topGainers, createDefaultListItem);
                populateList('top-losers-list', topLosers, createDefaultListItem);

                updateTicker();

            })
            .catch(error => {
                console.error('대시보드 데이터 로딩 실패:', error);
                const errorMsg = '<li>데이터 로딩 실패</li>';
                ['top-market-cap-list', 'top-volume-list', 'top-price-list', 'top-gainers-list', 'top-losers-list'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = errorMsg;
                });
                const tickerEl = document.getElementById('stock-ticker-content');
                if (tickerEl) tickerEl.innerHTML = '<span class="ticker-item">데이터를 불러오는 데 실패했습니다.</span>';
            });
    }

    /**
     * 주식 목록 페이지 (stock-list.html)
     */
    if (document.getElementById('stock-list-container')) {
        const container = document.getElementById('stock-list-container');
        const filtersContainer = document.getElementById('industry-filters');
        const searchForm = document.getElementById('stock-search-form');
        const searchInput = document.getElementById('stock-search-input');
        const paginationContainer = document.getElementById('stock-pagination');

        let currentIndustry = '전체';
        let currentSearchTerm = '';

        // 자동 완성 기능 적용
        fetch('/api/autocomplete?type=stock')
            .then(res => res.json())
            .then(data => {
                if (typeof autocomplete === 'function') {
                    autocomplete(searchInput, data);
                }
            }).catch(err => console.error("Stock autocomplete fetch error:", err));

        // 서버에서 주식 목록을 가져와 화면에 렌더링하는 함수
        const fetchAndRenderStocks = async (page = 1) => {
            try {
                // 로딩 스켈레톤 UI 표시
                container.innerHTML = Array(8).fill('<div class="stock-card-skeleton"></div>').join('');

                const params = new URLSearchParams({
                    page,
                    industry: currentIndustry === '전체' ? '' : currentIndustry,
                    search: currentSearchTerm
                });

                const res = await fetch(`/api/stocks?${params.toString()}`);
                if (!res.ok) throw new Error('서버 응답 오류');
                const result = await res.json();

                const { data, totalPages, currentPage } = result;

                container.innerHTML = '';
                if (data.length === 0) {
                    container.innerHTML = '<p class="empty-message">해당 조건에 맞는 종목이 없습니다.</p>';
                } else {
                    data.forEach(stock => {
                        const { change, changeRateText, changeClass, icon } = safeChangeInfo(stock);

                        const card = document.createElement('a');
                        card.href = `/stock-detail.html?code=${stock.tickerCode}`;
                        card.className = 'stock-card';
                        card.innerHTML = `
                            <div class="stock-card-header">
                                <h4>${stock.companyName}</h4>
                                <span>${stock.tickerCode}</span>
                            </div>
                            <div class="stock-card-body ${changeClass}">
                                <p>${formatCurrency(stock.currentPrice)}원</p>
                                <small>${icon} ${formatCurrency(change)} (${changeRateText}%)</small>
                            </div>
                        `;
                        container.appendChild(card);
                    });
                }

                // 페이지네이션 렌더링
                renderPagination(totalPages, currentPage, paginationContainer, fetchAndRenderStocks);

            } catch (error) {
                container.innerHTML = '<p class="empty-message">종목을 불러오는 데 실패했습니다.</p>';
                console.error('종목 로딩 실패:', error);
            }
        };

        // 업종 필터 버튼 생성
        const setupFilters = async () => {
            try {
                const res = await fetch('/api/stock-targets');
                const data = await res.json();
                const industries = ['전체', ...(data?.industries || [])];

                filtersContainer.innerHTML = industries.map(industry =>
                    `<button class="filter-btn ${industry === '전체' ? 'active' : ''}" data-industry="${industry}">${industry}</button>`
                ).join('');
            } catch (error) {
                console.error('업종 목록 로딩 실패:', error);
            }
        };

        // 업종 필터 클릭 이벤트
        filtersContainer.addEventListener('click', e => {
            if (e.target.tagName === 'BUTTON') {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentIndustry = e.target.dataset.industry;
                fetchAndRenderStocks(1); // 1페이지부터 다시 검색
            }
        });

        // 검색 폼 제출 이벤트
        searchForm.addEventListener('submit', e => {
            e.preventDefault();
            currentSearchTerm = searchInput.value;
            fetchAndRenderStocks(1); // 1페이지부터 다시 검색
        });

        /* ==========================================================
           ✅ 관리자 전용: 종목 추가 (모달)
           ========================================================== */
        const adminTrigger = document.getElementById('admin-add-stock-trigger');
        const openAdminModalBtn = document.getElementById('open-admin-stock-modal');
        const adminModal = document.getElementById('admin-stock-modal');
        const adminForm = document.getElementById('admin-add-stock-form');

        const toast = (msg, type = 'info') => {
            if (typeof showToast === 'function') return showToast(msg, type);
            alert(msg);
        };

        let lastFocusedEl = null;

        const setModalOpen = (open) => {
            if (!adminModal) return;

            if (open) {
                lastFocusedEl = document.activeElement;
                adminModal.classList.add('is-open');
                adminModal.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';

                const firstInput = adminModal.querySelector('input, select, textarea, button');
                if (firstInput) firstInput.focus();
            } else {
                adminModal.classList.remove('is-open');
                adminModal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';

                if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
                    lastFocusedEl.focus();
                } else if (openAdminModalBtn) {
                    openAdminModalBtn.focus();
                }
            }
        };

        const showAdminTriggerIfAllowed = async () => {
            if (!adminTrigger) return;
            if (!loggedInUser) return;

            try {
                const res = await fetch(`/api/stocks/admin/can-add?username=${encodeURIComponent(loggedInUser)}`);
                adminTrigger.style.display = res.ok ? 'block' : 'none';
            } catch {
                adminTrigger.style.display = 'none';
            }
        };

        showAdminTriggerIfAllowed();

        if (openAdminModalBtn) {
            openAdminModalBtn.addEventListener('click', () => {
                if (!loggedInUser) return toast('로그인이 필요합니다.', 'error');
                setModalOpen(true);
            });
        }

        if (adminModal) {
            adminModal.addEventListener('click', (e) => {
                const closeTarget = e.target.closest('[data-close="true"]');
                if (closeTarget) setModalOpen(false);
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && adminModal.classList.contains('is-open')) {
                    setModalOpen(false);
                }
            });
        }

        if (adminForm) {
            adminForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!loggedInUser) return toast('로그인이 필요합니다.', 'error');

                const payload = {
                    username: loggedInUser,
                    tickerCode: document.getElementById('admin-tickerCode').value,
                    companyName: document.getElementById('admin-companyName').value,
                    industry: document.getElementById('admin-industry').value,
                    currentPrice: Number(document.getElementById('admin-currentPrice').value),
                    totalShares: document.getElementById('admin-totalShares').value,
                    volatilityClass: document.getElementById('admin-volatilityClass').value,
                    fluctuationScore: document.getElementById('admin-fluctuationScore').value
                };

                try {
                    const res = await fetch('/api/stocks/admin/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) return toast(data.message || '종목 추가 실패', 'error');

                    toast('종목이 추가되었습니다!', 'success');

                    adminForm.reset();
                    const scoreEl = document.getElementById('admin-fluctuationScore');
                    const vEl = document.getElementById('admin-volatilityClass');
                    if (scoreEl) scoreEl.value = 50;
                    if (vEl) vEl.value = 'SPEEDSTER';

                    setModalOpen(false);

                    fetchAndRenderStocks(1);
                } catch (err) {
                    console.error(err);
                    toast('네트워크 오류로 종목 추가에 실패했습니다.', 'error');
                }
            });
        }

        // 초기화
        const initializeList = async () => {
            await setupFilters();
            fetchAndRenderStocks(1);
        };

        initializeList();
    }

    /**
     * 주식 상세 페이지 (stock-detail.html)
     */
    const detailPage = document.getElementById('stock-detail-page');
    if (detailPage) {
        const params = new URLSearchParams(window.location.search);
        const tickerCode = params.get('code');
        const loadingIndicator = document.getElementById('loading-indicator');
        let myPortfolio = {};
        let currentStock = {};
        const chartInstances = {};

        if (!tickerCode) {
            loadingIndicator.innerHTML = '<p>종목 코드가 올바르지 않습니다.</p>';
            return;
        }

        const fetchAllData = () => {
            return Promise.all([
                fetch(`/api/stocks/${tickerCode}`).then(res => res.json()),
                loggedInUser ? fetch(`/api/users/portfolio?username=${loggedInUser}`).then(res => res.json()) : Promise.resolve(null),
                fetch('/api/market-status').then(res => res.json())
            ]);
        };

        // 주간 데이터 계산 함수 (12시간을 1일로 가정하여 일일 종가 데이터를 추출)
        const calculateWeeklyData = (history) => {
            if (!history || history.length === 0) return { labels: [], data: [] };

            const dailyPrices = [];
            const dayLength = 12 * 60 * 60 * 1000;

            const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

            let currentDayStart = sortedHistory[0].timestamp;
            let currentDayEnd = currentDayStart + dayLength;
            let currentDayPrices = [];

            sortedHistory.forEach(point => {
                if (point.timestamp < currentDayEnd) {
                    currentDayPrices.push(point.price);
                } else {
                    if (currentDayPrices.length > 0) {
                        const closingPrice = currentDayPrices[currentDayPrices.length - 1];
                        dailyPrices.push({
                            timestamp: currentDayStart,
                            price: closingPrice
                        });
                    }

                    currentDayStart = currentDayEnd;
                    currentDayEnd = currentDayStart + dayLength;

                    while (point.timestamp >= currentDayEnd) {
                        currentDayStart = currentDayEnd;
                        currentDayEnd = currentDayStart + dayLength;
                    }
                    currentDayPrices = [point.price];
                }
            });

            if (currentDayPrices.length > 0) {
                const closingPrice = currentDayPrices[currentDayPrices.length - 1];
                dailyPrices.push({
                    timestamp: currentDayStart,
                    price: closingPrice
                });
            }

            const weeklyData = dailyPrices.slice(-7);

            return {
                labels: weeklyData.map(d => new Date(d.timestamp).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })),
                data: weeklyData.map(d => d.price)
            };
        };

        // 관련 뉴스 로딩 함수
        const fetchAndRenderRelatedNews = async () => {
            const newsListContainer = document.getElementById('related-news-list');
            try {
                const response = await fetch(`/api/news/stock/${tickerCode}`);
                if (!response.ok) throw new Error('뉴스 로딩 실패');

                const newsList = await response.json();

                if (newsList.length === 0) {
                    newsListContainer.innerHTML = '<p class="empty-message">관련 뉴스가 없습니다.</p>';
                    return;
                }

                newsListContainer.innerHTML = newsList.map(news => {
                    const sentiment = news.relevantSentiment;
                    const sentimentClass = sentiment === 'positive' ? 'sentiment-positive' : (sentiment === 'negative' ? 'sentiment-negative' : '');
                    let sentimentHTML = '';

                    if (sentiment === 'positive') {
                        sentimentHTML = '<i class="fa-solid fa-arrow-up"></i>⠀긍정적 기사';
                    } else if (sentiment === 'negative') {
                        sentimentHTML = '<i class="fa-solid fa-arrow-down"></i>⠀부정적 기사';
                    }

                    return `
                        <a href="/news/${news.id}" class="related-news-item">
                            <h4>${news.title}</h4>
                            <div class="related-news-meta">
                                <span>${new Date(news.createdAt).toLocaleDateString()}</span>
                                ${sentimentHTML ? `<span class="sentiment-badge ${sentimentClass}">${sentimentHTML}</span>` : ''}
                            </div>
                        </a>
                    `;
                }).join('');

            } catch (error) {
                console.error('관련 뉴스 로딩 실패:', error);
                newsListContainer.innerHTML = '<p class="empty-message">관련 뉴스를 불러오는 중 오류가 발생했습니다.</p>';
            }
        };

        const initializePage = ([stockData, portfolioData, marketStatus]) => {
            currentStock = stockData;
            if (portfolioData) myPortfolio = portfolioData;

            document.title = `안현민국 │ ${currentStock.companyName}`;
            document.getElementById('company-name-title').textContent = currentStock.companyName;
            document.getElementById('ticker-code-badge').textContent = currentStock.tickerCode;

            updatePriceDisplay();
            updateMyHoldings();

            renderAllCharts(currentStock.priceHistory);
            setupChartSwitching();
            fetchAndRenderRelatedNews();

            updateMarketStatusUI(marketStatus);

            loadingIndicator.style.display = 'none';
            detailPage.style.display = 'block';
        };

        fetchAllData()
            .then(initializePage)
            .catch(error => {
                console.error("데이터 로딩 실패:", error);
                loadingIndicator.innerHTML = `<p>정보를 불러오는 데 실패했습니다. <a href="/stock-list.html">목록으로 돌아가기</a></p>`;
            });

        const updatePriceDisplay = () => {
            const { change, changeRateText, changeClass, icon } = safeChangeInfo(currentStock);

            document.getElementById('current-price-display').textContent = `${formatCurrency(currentStock.currentPrice)}원`;
            document.getElementById('price-change-display').innerHTML = `${icon} ${formatCurrency(change)} (${changeRateText}%)`;
            document.getElementById('current-price-display').className = `price-display ${changeClass}`;
            document.getElementById('price-change-display').className = `change-display ${changeClass}`;
        };

        const updateMarketStatusUI = (marketStatus) => {
            const buyBtn = document.getElementById('buy-btn');
            const sellBtn = document.getElementById('sell-btn');
            const marketStatusMsg = document.getElementById('market-status-message');

            if (marketStatus.isOpen) {
                buyBtn.disabled = false;
                sellBtn.disabled = false;
                marketStatusMsg.style.display = 'none';
            } else {
                buyBtn.disabled = true;
                sellBtn.disabled = true;
                marketStatusMsg.style.display = 'block';
            }
        };

        const updateMyHoldings = () => {
            const myStock = myPortfolio.portfolio?.find(s => s.tickerCode === tickerCode);
            if (myStock && myStock.quantity > 0) {
                const profit = (Number(currentStock.currentPrice || 0) - Number(myStock.purchasePrice || 0)) * Number(myStock.quantity || 0);
                const profitRate = Number(myStock.purchasePrice) > 0
                    ? ((Number(currentStock.currentPrice || 0) / Number(myStock.purchasePrice)) - 1) * 100
                    : 0;

                document.getElementById('my-quantity').textContent = formatCurrency(myStock.quantity);
                document.getElementById('my-avg-price').textContent = formatCurrency(myStock.purchasePrice);
                document.getElementById('my-profit-rate').textContent = `${profitRate.toFixed(2)}%`;
                document.getElementById('my-profit-rate').className = getPriceChangeClass(profit);
                document.getElementById('my-holdings-info').style.display = 'block';
            } else {
                document.getElementById('my-holdings-info').style.display = 'none';
            }
        };

        const renderAllCharts = (history) => {
            if (!history || history.length === 0) return;
            const dailyLabels = history.map(h => new Date(h.timestamp).toLocaleTimeString('ko-KR'));
            const dailyData = history.map(h => h.price);
            const { labels: weeklyLabels, data: weeklyData } = calculateWeeklyData(history);

            renderChart('stock-chart-daily', '일일 주가', dailyLabels, dailyData, '#1A447A');
            renderChart('stock-chart-weekly', '주간 종가', weeklyLabels, weeklyData, '#2ECC71');
        };

        const renderChart = (canvasId, label, labels, data, borderColor) => {
            const ctx = document.getElementById(canvasId).getContext('2d');
            if (chartInstances[canvasId]) {
                chartInstances[canvasId].destroy();
            }
            chartInstances[canvasId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: label,
                        data: data,
                        borderColor: borderColor,
                        backgroundColor: `${borderColor}33`,
                        fill: true,
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            ticks: { callback: value => `${formatCurrency(value)}원` },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        x: { grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}원`;
                                }
                            }
                        }
                    }
                }
            });
        };

        const setupChartSwitching = () => {
            const dailyBtn = document.getElementById('chart-daily-btn');
            const weeklyBtn = document.getElementById('chart-weekly-btn');
            const dailyChart = document.getElementById('stock-chart-daily');
            const weeklyChart = document.getElementById('stock-chart-weekly');

            const switchChart = (targetChart) => {
                if (targetChart === 'daily') {
                    dailyBtn.classList.add('active');
                    weeklyBtn.classList.remove('active');
                    dailyChart.classList.remove('chart-hidden');
                    dailyChart.classList.add('chart-active');
                    weeklyChart.classList.remove('chart-active');
                    weeklyChart.classList.add('chart-hidden');
                } else {
                    weeklyBtn.classList.add('active');
                    dailyBtn.classList.remove('active');
                    weeklyChart.classList.remove('chart-hidden');
                    weeklyChart.classList.add('chart-active');
                    dailyChart.classList.remove('chart-active');
                    dailyChart.classList.add('chart-hidden');
                }
            };

            dailyBtn.addEventListener('click', () => switchChart('daily'));
            weeklyBtn.addEventListener('click', () => switchChart('weekly'));
        };

        // Modal Logic
        const tradeModal = document.getElementById('trade-modal');
        const openModal = (type) => {
            if (!loggedInUser) {
                showToast('로그인이 필요한 기능입니다.', 'error');
                return;
            }

            if (document.getElementById('buy-btn').disabled) {
                showToast('장이 열려있지 않아 거래할 수 없습니다.', 'error');
                return;
            }

            document.getElementById('modal-title').textContent = type === 'buy' ? '매수 주문' : '매도 주문';
            document.getElementById('modal-balance').value = `${formatCurrency(myPortfolio.balance)}원`;
            document.getElementById('modal-price').value = `${formatCurrency(currentStock.currentPrice)}원`;
            document.getElementById('modal-type').value = type;
            document.getElementById('modal-ticker-code').value = tickerCode;
            document.getElementById('modal-quantity').value = '';
            document.getElementById('modal-total-amount').textContent = '0';
            tradeModal.classList.remove('hidden');
        };

        document.getElementById('buy-btn').addEventListener('click', () => openModal('buy'));
        document.getElementById('sell-btn').addEventListener('click', () => openModal('sell'));
        document.getElementById('modal-close-btn').addEventListener('click', () => tradeModal.classList.add('hidden'));

        document.getElementById('modal-quantity').addEventListener('input', (e) => {
            const quantity = parseInt(e.target.value, 10) || 0;
            const total = quantity * Number(currentStock.currentPrice || 0);
            document.getElementById('modal-total-amount').textContent = formatCurrency(total);
        });

        // ✅✅✅ 여기부터가 "수수료 표시" 포함된 완성 처리(핵심)
        document.getElementById('trade-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const type = document.getElementById('modal-type').value;
            const quantityRaw = document.getElementById('modal-quantity').value;
            const qty = parseInt(quantityRaw, 10);

            if (!Number.isFinite(qty) || qty <= 0) {
                showToast('올바른 수량을 입력해주세요.', 'error');
                return;
            }

            try {
                const res = await fetch('/api/stocks/trade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: loggedInUser,
                        tickerCode: tickerCode,
                        quantity: qty,
                        type: type
                    })
                });

                // 성공/실패 모두 JSON을 읽어야 fee/needed/balance가 안 날아감
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    const msg = data?.message || '주문 처리 중 오류 발생';

                    const neededNum = Number(data?.needed);
                    const balanceNum = Number(data?.balance);
                    const extraText = (Number.isFinite(neededNum) && Number.isFinite(balanceNum))
                        ? ` (필요: ${neededNum.toLocaleString('ko-KR')}원 / 잔액: ${balanceNum.toLocaleString('ko-KR')}원)`
                        : '';

                    const feeNum = Number(data?.fee);
                    const feeText = Number.isFinite(feeNum)
                        ? ` (수수료: ${feeNum.toLocaleString('ko-KR')}원)`
                        : '';

                    showToast(`${msg}${extraText}${feeText}`, 'error');
                    return;
                }

                // 성공 메시지 + 수수료
                const feeNum = Number(data?.fee);
                const feeText = Number.isFinite(feeNum)
                    ? ` (수수료: ${feeNum.toLocaleString('ko-KR')}원)`
                    : '';

                showToast(`${data.message || '거래가 성공적으로 체결되었습니다.'}${feeText}`, 'success');

                tradeModal.classList.add('hidden');

                const [stockData, portfolioData, marketStatus] = await fetchAllData();
                currentStock = stockData;
                if (portfolioData) myPortfolio = portfolioData;

                updatePriceDisplay();
                updateMyHoldings();
                renderAllCharts(currentStock.priceHistory);
                updateMarketStatusUI(marketStatus);

            } catch (err) {
                console.error('주문 처리 중 오류:', err);
                showToast(err?.message || '주문 처리 중 오류 발생', 'error');
            }
        });
    
    }
});
