require('dotenv').config();

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { readJsonFile, writeJsonFile, stocksFilePath, newsFilePath } = require('./utils/fileHandler');

const app = express();

// ✅ 프록시 환경(Cloudflare/리버스프록시)에서도 host/https 판단 안정화
app.set('trust proxy', true);

const HTTPS_PORT = 443;
const HTTP_PORT = 80;

/* ==========================================================
   0. 도메인 리다이렉트
   - urichurch.bebcon.kr -> www.bebcon.kr/urichurch.html
   - bebcon.kr -> www.bebcon.kr
   ========================================================== */
app.use((req, res, next) => {
  const host = (req.headers.host || '')
    .toLowerCase()
    .replace(/:\d+$/, ''); // 포트 제거

  if (host === 'urichurch.bebcon.kr') {
    // 쿼리스트링 유지
    const qIndex = req.originalUrl.indexOf('?');
    const query = qIndex >= 0 ? req.originalUrl.slice(qIndex) : '';
    return res.redirect(301, `https://www.bebcon.kr/urichurch.html${query}`);
  }

  if (host === 'bebcon.kr') {
    return res.redirect(301, `https://www.bebcon.kr${req.originalUrl}`);
  }

  next();
});

/* ==========================================================
   1. 기본 설정 (용량 제한 및 정적 경로)
   ========================================================== */
app.use(express.json({ limit: '3gb' }));
app.use(express.urlencoded({ limit: '3gb', extended: true }));

// 정적 파일 제공 (public 폴더와 uploads 폴더)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ==========================================================
   2. Multer (파일 업로드) 설정
   ========================================================== */
const uploadDir = path.join(__dirname, 'uploads');
const hostingUploadDir = path.join(uploadDir, 'hosting');
const ebooksUploadDir = path.join(uploadDir, 'ebooks');

// 폴더가 없으면 생성
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(hostingUploadDir)) fs.mkdirSync(hostingUploadDir, { recursive: true });
if (!fs.existsSync(ebooksUploadDir)) fs.mkdirSync(ebooksUploadDir, { recursive: true });

// 파일명 디코딩 처리를 포함한 공통 스토리지 엔진
const createStorage = (dest) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, dest),
  filename: (req, file, cb) => {
    // 한글 파일명 깨짐 방지 처리
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${Date.now()}-${decodedName}`);
  }
});

// 일반 업로드 및 미디어 호스팅 전용 업로드 인스턴스
const upload = multer({
  storage: createStorage(uploadDir),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }
});

const uploadHosting = multer({
  storage: createStorage(hostingUploadDir),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }
});

// 전자책 표지(cover) 전용 업로드 인스턴스
const uploadEbookCover = multer({
  storage: createStorage(ebooksUploadDir),
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }
});

/* ==========================================================
   3. 시장 개장 체크 (KST 12:00 ~ 익일 02:00)
   ========================================================== */
function checkMarketOpen() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  const h = kst.getHours();
  const m = kst.getMinutes();

  // 12:00 ~ 02:00 (익일) 개장 상태 반환
  // 02:00 정각까지만 개장으로 취급
  return h >= 12 || h < 2 || (h === 2 && m === 0);
}

/* ==========================================================
   4. 라우터 설정 및 바인딩
   ========================================================== */
const pageRouter = require('./routes/pages');
const userRouter = require('./routes/users');

const postsRouter = require('./routes/posts')(upload);
const stocksRouter = require('./routes/stocks');
const newsRouter = require('./routes/news');
const complaintsRouter = require('./routes/complaints');
const schedulesRouter = require('./routes/schedules');
const mediaRouter = require('./routes/media')(uploadHosting);
const realtyRouter = require('./routes/realty')(upload);
const searchRouter = require('./routes/search');
const notificationsRouter = require('./routes/notifications');
const todosRouter = require('./routes/todos');
const ebookApiRouter = require('./routes/ebooks')(uploadEbookCover);

/* ==========================================================
   5. 라우터 연결
   ========================================================== */

// 시장 상태 API
app.get('/api/market-status', (req, res) => {
  res.json({ isOpen: checkMarketOpen() });
});

// 주식 거래 미들웨어 (개장 시간 외 차단)
app.post('/api/stocks/trade', (req, res, next) => {
  if (!checkMarketOpen()) {
    return res.status(400).json({ message: '장이 열려있지 않아 거래할 수 없습니다.' });
  }
  next();
});

// API 엔드포인트 바인딩
app.use('/api/users', userRouter);
app.use('/api/posts', postsRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/news', newsRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/media', mediaRouter);
app.use('/api/realty', realtyRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/todos', todosRouter);
app.use('/api/ebooks', ebookApiRouter);

// 페이지 라우터 (안전하게 최하단)
app.use('/', pageRouter);

/* ==========================================================
   6. [주식 엔진] 평균회귀 + 세션캡 + 점프/노이즈 + 뉴스 드리프트
   + 쿨다운(연속추세 완화)
   + 과열/과매도 보강(되돌림 강화)
   ========================================================== */
const VOLATILITY_MAP = {
  TANKER: 0.03,    // 대형주 (저변동)
  SPEEDSTER: 0.10, // 성장주 (중변동)
  GAMBLER: 0.35    // 잡주 (고변동)
};

// 연속 같은 방향(streak)이 길수록 변동폭을 깎음
function cooldownMultiplier(streakAbs) {
  if (streakAbs < 6) return 1.0;
  if (streakAbs === 6) return 0.80;
  if (streakAbs === 7) return 0.65;
  if (streakAbs === 8) return 0.50;
  return 0.40;
}

// 히스토리로 “최근 방향” 추정 (streak 필드가 없을 때 초기값 보조)
function getLastDirectionFromHistory(history, fallbackPrice) {
  if (!Array.isArray(history) || history.length < 2) return 0;
  const prev = Number(history[history.length - 1]?.price ?? fallbackPrice);
  const prev2 = Number(history[history.length - 2]?.price ?? prev);
  if (!Number.isFinite(prev) || !Number.isFinite(prev2)) return 0;
  return Math.sign(prev - prev2);
}

/** 장 시작 시 시가 리셋 (12:00 KST) */
async function resetStartingPrices() {
  try {
    const stocks = await readJsonFile(stocksFilePath);
    const updated = stocks.map(s => ({
      ...s,
      startingPrice: s.currentPrice,
      volume: 0,
      trendStreak: 0
    }));
    await writeJsonFile(stocksFilePath, updated);
    console.log('[MARKET OPEN] 시가 및 거래량 초기화 완료');
  } catch (err) {
    console.error('시가 초기화 오류:', err);
  }
}

/** 주가 시뮬레이션 핵심 로직 */
async function updateStockPrices() {
  try {
    const stocks = await readJsonFile(stocksFilePath);
    const news = await readJsonFile(newsFilePath);

    // 최근 24시간 내 뉴스만
    const recentNews = news.filter(n =>
      n.targetStocks && Date.now() - n.createdAt < 1000 * 60 * 60 * 24
    );

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const updatedStocks = stocks.map(stock => {
      const basePrice = Number(stock.currentPrice ?? 0);
      const startPrice = Number(stock.startingPrice ?? basePrice ?? 0);

      // 안전장치(숫자/양수 보장)
      const safeBase = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 100;
      const safeStart = Number.isFinite(startPrice) && startPrice > 0 ? startPrice : safeBase;

      const score0 = Number(stock.fluctuationScore ?? 50);
      const score = Number.isFinite(score0) ? clamp(score0, 0, 100) : 50;

      const maxVolatility = VOLATILITY_MAP[stock.volatilityClass] || 0.05;

      /* 1) 평균회귀 */
      const deviation = (safeBase - safeStart) / safeStart;

      const reversionStrength =
        stock.volatilityClass === 'TANKER' ? 0.12 :
        stock.volatilityClass === 'SPEEDSTER' ? 0.08 :
        0.05;

      let meanReversionDrift = -deviation * reversionStrength;

      // 과열/과매도 보강
      const absDev = Math.abs(deviation);
      if (absDev > 0.12) {
        const boost = clamp((absDev - 0.12) * 0.8, 0, 0.06);
        meanReversionDrift += (deviation > 0 ? -boost : boost);
      }

      /* 2) 뉴스 이벤트(드리프트 + score 변화) */
      let newsDrift = 0;
      let scoreDelta = 0;

      recentNews.forEach(n => {
        const target = n.targetStocks.find(t => t.tickerCode === stock.tickerCode);
        if (!target) return;

        const hoursPassed = (Date.now() - n.createdAt) / (1000 * 60 * 60);
        const decay = Math.max(0, 1 - hoursPassed / 24);
        const impulse = 0.06 * decay;

        if (target.sentiment === 'positive') {
          newsDrift += impulse;
          scoreDelta += Math.round(3 * decay);
        } else if (target.sentiment === 'negative') {
          newsDrift -= impulse;
          scoreDelta -= Math.round(3 * decay);
        }
      });

      scoreDelta = clamp(scoreDelta, -5, 5);

      /* 3) 노이즈 + 드문 점프 */
      const microNoise = (Math.random() * 2 - 1) * (maxVolatility * 0.25);

      const baseJumpChance =
        stock.volatilityClass === 'TANKER' ? 0.03 :
        stock.volatilityClass === 'SPEEDSTER' ? 0.06 :
        stock.volatilityClass === 'GAMBLER' ? 0.10 :
        0.10;

      const jumpChance = Math.min(0.25, baseJumpChance * 1.10);

      let jump = 0;
      if (Math.random() < jumpChance) {
        const jumpSize = maxVolatility * (0.6 + Math.random() * 0.8);
        jump = (Math.random() < 0.5 ? -1 : 1) * jumpSize;
      }

      /* 4) score 기반 완만한 추세 */
      const scoreBias = (score - 50) / 50;
      const scoreDrift = scoreBias * (maxVolatility * 0.10);

      /* 5) 쿨다운: 연속 추세 완화 */
      const rawBeforeCooldown = microNoise + jump + scoreDrift + meanReversionDrift + newsDrift;
      const nowDirGuess = Math.sign(rawBeforeCooldown);

      let trendStreak = Number(stock.trendStreak ?? 0);
      if (!Number.isFinite(trendStreak)) trendStreak = 0;

      const lastDir = Math.sign(trendStreak) || getLastDirectionFromHistory(stock.priceHistory, safeBase);

      if (nowDirGuess === 0) {
        trendStreak = 0;
      } else if (lastDir === 0 || lastDir === nowDirGuess) {
        trendStreak += nowDirGuess;
      } else {
        trendStreak = nowDirGuess;
      }

      const cdMult = cooldownMultiplier(Math.abs(trendStreak));

      /* 6) 최종 변화율 + 캡 */
      let changePercent = rawBeforeCooldown * cdMult;

      const tickCap = maxVolatility * 0.9;
      changePercent = clamp(changePercent, -tickCap, tickCap);

      const sessionCap =
        stock.volatilityClass === 'TANKER' ? 0.12 :
        stock.volatilityClass === 'SPEEDSTER' ? 0.25 :
        0.45;

      const proposed = Math.max(100, Math.round(safeBase * (1 + changePercent)));
      const sessionHigh = Math.round(safeStart * (1 + sessionCap));
      const sessionLow = Math.round(safeStart * (1 - sessionCap));

      const newPrice = clamp(proposed, sessionLow, sessionHigh);

      /* 7) 히스토리 업데이트 */
      const history = Array.isArray(stock.priceHistory) ? stock.priceHistory : [];
      history.push({ timestamp: Date.now(), price: newPrice });
      if (history.length > 60) history.shift();

      return {
        ...stock,
        currentPrice: newPrice,
        fluctuationScore: clamp(score + scoreDelta, 0, 100),
        priceHistory: history,
        trendStreak
      };
    });

    await writeJsonFile(stocksFilePath, updatedStocks);
    console.log(`[STOCK] 시세 업데이트 완료 (${new Date().toLocaleTimeString()})`);
  } catch (err) {
    console.error('주가 시뮬레이터 오류:', err);
  }
}

/** 시뮬레이션 루프 매니저 */
let lastSimTickKey = null;

async function simulateMarket() {
  if (!checkMarketOpen()) {
    console.log('[CLOSED] 현재는 휴장 시간입니다. (오후 12시 개장)');
    return;
  }

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);

  // KST 12시 00분에 맞춰 시가 초기화
  if (kst.getHours() === 12 && kst.getMinutes() === 0) {
    await resetStartingPrices();
  }

  // 30분 단위(정각/30분)에만 시세 업데이트
  const minutes = kst.getMinutes();
  const shouldTick = minutes === 0 || minutes === 30;
  if (!shouldTick) return;

  // 같은 30분 구간에서 중복 실행 방지
  const tickKey =
    `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')} ` +
    `${String(kst.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  if (tickKey === lastSimTickKey) return;
  lastSimTickKey = tickKey;

  await updateStockPrices();
}

// 1분마다 시장 상황 체크 (시세는 정각/30분에만 갱신)
setInterval(simulateMarket, 60000);

/* ==========================================================
   7. 서버 기동 (HTTPS 우선 + HTTP -> HTTPS 리다이렉트)
   ========================================================== */
try {
  const httpsOptions = {
    key: fs.readFileSync('C:/Certbot/live/bebcon.kr/privkey.pem'),
    cert: fs.readFileSync('C:/Certbot/live/bebcon.kr/fullchain.pem')
  };

  // HTTPS 서버
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log(`'안현민국' HTTPS 서버가 포트 ${HTTPS_PORT}에서 안전하게 실행 중입니다.`);
  });

  // HTTP 서버 -> HTTPS 강제 리다이렉트
  http.createServer((req, res) => {
    const host = (req.headers.host || '')
      .toLowerCase()
      .replace(/:\d+$/, '');

    res.writeHead(301, {
      Location: `https://${host}${req.url}`
    });
    res.end();
  }).listen(HTTP_PORT, () => {
    console.log(`HTTP 서버가 포트 ${HTTP_PORT}에서 실행 중이며 HTTPS로 리다이렉트합니다.`);
  });

} catch (err) {
  console.warn('HTTPS 인증서 로드 실패 → HTTP 모드로 전환합니다. (에러내용: ' + err.message + ')');

  const fallbackPort = 3000;
  app.listen(fallbackPort, () => {
    console.log(`'안현민국' HTTP 서버가 포트 ${fallbackPort}에서 실행 중입니다.`);
  });
}