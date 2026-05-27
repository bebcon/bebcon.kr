/**
 * One-shot stock rebalancer
 * - Reads stocks JSON
 * - Creates a backup
 * - Detects "blown up" prices and rescales them to a reasonable band
 * - Rescales priceHistory accordingly
 * - Normalizes startingPrice and optionally fluctuationScore
 *
 * Usage:
 *   node tools/rebalance-stocks.js
 *
 * Optional env:
 *   STOCKS_PATH=./data/stocks.json
 */

const fs = require('fs');
const path = require('path');

const STOCKS_PATH = process.env.STOCKS_PATH || path.join(__dirname, '..', 'stocks.json');


/** ---------- Config (safe defaults) ---------- */
const CONFIG = {
  // "폭주" 판정: startingPrice 대비 몇 배 이상이면 폭주로 본다
  blowUpMultiple: 10, // 예: 시가의 20배 초과면 폭주

  // 가격 자체가 너무 커도 폭주로 본다 (절대값)
  absoluteMaxPrice: 300_000, // 200만원 초과면 폭주로 본다 (원하면 조절)

  // 리밸런싱 목표가를 절대 구간으로 강제(한국 감성)
  targetAbsoluteByClass: {
    TANKER:   { min: 5_000,  max: 70_000 },   // 대형주: 보통 1~7만 근처
    SPEEDSTER:{ min: 2_000,  max: 120_000 },  // 성장주: 2천~12만
    GAMBLER:  { min: 100,    max: 30_000 },   // 잡주: 100~3만
    DEFAULT:  { min: 1_000,  max: 100_000 }
  },

  // 가격 하한(너무 낮아지지 않게)
  minPriceFloor: 100,

  // startingPrice가 비정상이면 사용할 fallback 기준가:
  // 1) priceHistory의 중앙값  2) currentPrice  3) 1000
  fallbackBase: 10_000,

  // 리밸런싱 후 score를 중립(50)으로 리셋할지
  resetScoreToNeutral: true,

  // score 리셋 안 할 때라도 폭주 종목은 score 범위를 제한
  clampScore: true
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function isFinitePos(n) {
  return Number.isFinite(n) && n > 0;
}

function median(arr) {
  if (!arr || arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function readJson(fp) {
  const raw = fs.readFileSync(fp, 'utf8');
  return JSON.parse(raw);
}

function writeJson(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

function makeBackup(fp) {
  const dir = path.dirname(fp);
  const base = path.basename(fp, '.json');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dir, `${base}.backup.${stamp}.json`);
  fs.copyFileSync(fp, backupPath);
  return backupPath;
}

function pickBand(volatilityClass) {
  const map = CONFIG.targetBandMultipleByClass;
  return map[volatilityClass] || map.DEFAULT;
}

function detectBasePrice(stock) {
  const cp = Number(stock?.currentPrice);
  const sp = Number(stock?.startingPrice);

  // startingPrice가 정상이라면 그걸 우선 기준으로
  if (isFinitePos(sp)) return sp;

  // history 중앙값으로 기준가 추정
  const hist = Array.isArray(stock?.priceHistory) ? stock.priceHistory : [];
  const prices = hist.map(p => Number(p?.price)).filter(isFinitePos);
  const med = median(prices);
  if (isFinitePos(med)) return med;

  // currentPrice로 fallback
  if (isFinitePos(cp)) return cp;

  return CONFIG.fallbackBase;
}

function shouldRebalance(stock, base) {
  const cp = Number(stock?.currentPrice);
  if (!isFinitePos(cp)) return true;

  const multiple = base > 0 ? (cp / base) : Infinity;

  if (multiple >= CONFIG.blowUpMultiple) return true;
  if (cp >= CONFIG.absoluteMaxPrice) return true;

  // 너무 낮게 박살난 경우도 같이 구제하고 싶다면(선택)
  // if (multiple <= 0.02) return true;

  return false;
}

function computeTargetPrice(stock, base) {
    const vc = stock?.volatilityClass || 'DEFAULT';
    const band = CONFIG.targetAbsoluteByClass?.[vc] || CONFIG.targetAbsoluteByClass.DEFAULT;
  
    const r = Math.random();
    const target = Math.round(band.min + (band.max - band.min) * r);
    return clamp(target, CONFIG.minPriceFloor, Number.MAX_SAFE_INTEGER);
  }
  

function rescaleHistory(history, ratio) {
  if (!Array.isArray(history) || history.length === 0) return history;

  // 히스토리도 동일 비율로 재스케일(그래프 형태 유지)
  return history.map(p => {
    const price = Number(p?.price);
    const ts = p?.timestamp ?? Date.now();
    const newPrice = isFinitePos(price)
      ? clamp(Math.round(price * ratio), CONFIG.minPriceFloor, Number.MAX_SAFE_INTEGER)
      : null;

    // 가격이 이상하면 target에 근처 값으로 보정
    return {
      timestamp: ts,
      price: newPrice ?? CONFIG.minPriceFloor
    };
  });
}

function main() {
  if (!fs.existsSync(STOCKS_PATH)) {
    console.error(`[ERROR] stocks file not found: ${STOCKS_PATH}`);
    process.exit(1);
  }

  const backupPath = makeBackup(STOCKS_PATH);
  const stocks = readJson(STOCKS_PATH);

  if (!Array.isArray(stocks)) {
    console.error('[ERROR] stocks JSON is not an array.');
    process.exit(1);
  }

  let changed = 0;
  const logs = [];

  const updated = stocks.map(s => {
    const base = detectBasePrice(s);
    const cp = Number(s?.currentPrice);
    const sp = Number(s?.startingPrice);

    const need = shouldRebalance(s, base);
    if (!need) return s;

    const targetPrice = computeTargetPrice(s, base);

    // ratio: currentPrice -> targetPrice 비율 (히스토리도 동일 비율로)
    const safeCp = isFinitePos(cp) ? cp : base;
    const ratio = safeCp > 0 ? (targetPrice / safeCp) : 1;

    const newHistory = rescaleHistory(s.priceHistory, ratio);

    // startingPrice도 같이 현실 범위로: targetPrice 근처로 갱신
    // (세션 기준이 깨져있으면 다음 틱에서 회귀/캡이 이상해질 수 있음)
    const newStarting = isFinitePos(sp)
      ? clamp(Math.round(sp * ratio), CONFIG.minPriceFloor, Number.MAX_SAFE_INTEGER)
      : base; // 없었으면 base를 넣어줌

    let newScore = s.fluctuationScore;
    if (CONFIG.resetScoreToNeutral) {
      newScore = 50;
    } else if (CONFIG.clampScore) {
      const sc = Number(s.fluctuationScore ?? 50);
      newScore = Number.isFinite(sc) ? clamp(sc, 0, 100) : 50;
    }

    changed++;
    logs.push({
      tickerCode: s.tickerCode,
      companyName: s.companyName,
      volatilityClass: s.volatilityClass,
      base,
      before: safeCp,
      after: targetPrice,
      ratio: Number(ratio.toFixed(6))
    });

    return {
      ...s,
      currentPrice: targetPrice,
      startingPrice: newStarting,
      fluctuationScore: newScore,
      priceHistory: newHistory
    };
  });

  writeJson(STOCKS_PATH, updated);

  console.log('================ Rebalance Done ================');
  console.log(`Stocks path : ${STOCKS_PATH}`);
  console.log(`Backup path : ${backupPath}`);
  console.log(`Changed     : ${changed} / ${stocks.length}`);
  console.log('------------------------------------------------');

  // 상위 30개만 출력
  logs.slice(0, 30).forEach(l => {
    console.log(
      `${l.tickerCode || '(no code)'} | ${l.companyName || '(no name)'} | ${l.volatilityClass || 'DEFAULT'} | ` +
      `base=${l.base} | ${l.before} -> ${l.after} (x${l.ratio})`
    );
  });

  if (logs.length > 30) {
    console.log(`... and ${logs.length - 30} more`);
  }

  console.log('================================================');
}

main();
