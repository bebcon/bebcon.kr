console.log('[stocks router loaded]', __filename);

const express = require('express');
const router = express.Router();
const { checkRole } = require('../utils/auth');
const { readJsonFile, writeJsonFile, usersFilePath, stocksFilePath } = require('../utils/fileHandler');

/* ==========================================================
   (5) 거래 수수료 설정
   ========================================================== */
const FEE_RATE = 0.001; // 0.1%
const calcFee = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const fee = Math.floor(n * FEE_RATE);
  return Math.max(1, fee); // 최소 1원
};

// 대시보드 데이터 조회 (GET /api/stocks/dashboard)
router.get('/dashboard', async (req, res) => {
  try {
    const stocks = await readJsonFile(stocksFilePath);

    // 1. 시가총액 상위
    const stocksWithMarketCap = stocks.map(stock => ({
      ...stock,
      marketCap: stock.currentPrice * (stock.totalShares || 1000000)
    }));
    const topMarketCap = [...stocksWithMarketCap]
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 5);

    // 2. 거래량 상위
    const topVolume = [...stocks]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 5);

    // 3. 주가 상위
    const topPrice = [...stocks]
      .sort((a, b) => b.currentPrice - a.currentPrice)
      .slice(0, 5);

    const calculateChangeRate = (s) => {
      return s.startingPrice
        ? ((s.currentPrice - s.startingPrice) / s.startingPrice) * 100
        : 0;
    };

    // 4. 상승률 상위
    const topGainers = [...stocks]
      .map(s => ({ ...s, changeRate: calculateChangeRate(s) }))
      .filter(s => s.changeRate > 0)
      .sort((a, b) => b.changeRate - a.changeRate)
      .slice(0, 5);

    // 5. 하락률 상위
    const topLosers = [...stocks]
      .map(s => ({ ...s, changeRate: calculateChangeRate(s) }))
      .filter(s => s.changeRate < 0)
      .sort((a, b) => a.changeRate - b.changeRate)
      .slice(0, 5);

    res.json({ topMarketCap, topVolume, topPrice, topGainers, topLosers });
  } catch (error) {
    console.error('주식 대시보드 정보 조회 오류:', error);
    res.status(500).json({ message: '주식 대시보드 정보를 불러오는 데 실패했습니다.' });
  }
});

// 모든 주식 목록 전체 조회 (페이지네이션 없음, 마이페이지 자산 계산용)
router.get('/all', async (req, res) => {
  try {
    const stocks = await readJsonFile(stocksFilePath);
    res.json(stocks);
  } catch (error) {
    res.status(500).json({ message: '주식 정보를 불러오는 데 실패했습니다.' });
  }
});

// ✅ 관리자 권한 확인 (프론트에서 UI 표시용)
router.get('/admin/can-add', checkRole(['admin']), (req, res) => {
  res.json({ isAdmin: true });
});

// ✅ 관리자 전용: 종목 추가
router.post('/admin/add', checkRole(['admin']), async (req, res) => {
  try {
    const {
      username,
      tickerCode,
      companyName,
      industry,
      currentPrice,
      totalShares,
      volatilityClass,
      fluctuationScore
    } = req.body;

    const code = String(tickerCode || '').trim().toUpperCase();
    const name = String(companyName || '').trim();
    const ind  = String(industry || '').trim();

    const priceNum = Math.round(Number(currentPrice));
    if (!code || code.length > 20) return res.status(400).json({ message: 'tickerCode(20자 이하)가 올바르지 않습니다.' });
    if (!name || name.length > 50) return res.status(400).json({ message: 'companyName(50자 이하)가 올바르지 않습니다.' });
    if (!ind || ind.length > 30)  return res.status(400).json({ message: 'industry(30자 이하)가 올바르지 않습니다.' });
    if (!Number.isFinite(priceNum) || priceNum <= 0) return res.status(400).json({ message: 'currentPrice(양수 숫자)가 올바르지 않습니다.' });

    const sharesNumRaw =
      (totalShares === '' || totalShares === undefined || totalShares === null)
        ? 0
        : Number(totalShares);
    const sharesNum = Number.isFinite(sharesNumRaw) ? Math.max(0, Math.round(sharesNumRaw)) : 0;

    const vRaw = String(volatilityClass || 'SPEEDSTER').trim().toUpperCase();
    const allowedV = ['TANKER', 'SPEEDSTER', 'GAMBLER'];
    const vClass = allowedV.includes(vRaw) ? vRaw : 'SPEEDSTER';

    const scoreRaw =
      (fluctuationScore === '' || fluctuationScore === undefined || fluctuationScore === null)
        ? 50
        : Number(fluctuationScore);
    const scoreNum = Number.isFinite(scoreRaw) ? Math.min(100, Math.max(0, Math.round(scoreRaw))) : 50;

    const stocks = await readJsonFile(stocksFilePath);
    const exists = stocks.some(s => String(s.tickerCode || '').toUpperCase() === code);
    if (exists) return res.status(409).json({ message: '이미 존재하는 tickerCode입니다.' });

    const now = Date.now();
    const safePrice = Math.max(100, priceNum);

    const newStock = {
      tickerCode: code,
      companyName: name,
      industry: ind,

      currentPrice: safePrice,
      startingPrice: safePrice,
      volume: 0,

      totalShares: sharesNum,
      volatilityClass: vClass,
      fluctuationScore: scoreNum,

      priceHistory: [{ timestamp: now, price: safePrice }],

      createdAt: now,
      updatedAt: now,
      createdBy: String(username || '').trim()
    };

    stocks.push(newStock);
    await writeJsonFile(stocksFilePath, stocks);

    res.status(201).json({ message: '종목이 추가되었습니다.', stock: newStock });
  } catch (error) {
    console.error('Admin add stock error:', error);
    res.status(500).json({ message: '종목 추가 중 서버 오류가 발생했습니다.' });
  }
});

// 특정 주식 상세 정보 조회
router.get('/:tickerCode', async (req, res) => {
  try {
    const { tickerCode } = req.params;
    const stocks = await readJsonFile(stocksFilePath);
    const stock = stocks.find(s => s.tickerCode === tickerCode);
    if (stock) res.json(stock);
    else res.status(404).json({ message: '해당 종목을 찾을 수 없습니다.' });
  } catch (error) {
    console.error(`Error fetching stock detail for ${req.params.tickerCode}:`, error);
    res.status(500).json({ message: '주식 상세 정보를 불러오는 데 실패했습니다.' });
  }
});

// 전체 주식 목록 조회 (검색/필터/페이지네이션)
router.get('/', async (req, res) => {
  try {
    const stocks = await readJsonFile(stocksFilePath);
    const { industry, search, page = 1 } = req.query;
    let filteredStocks = stocks;

    if (industry) filteredStocks = filteredStocks.filter(stock => stock.industry === industry);

    if (search) {
      const searchTerm = String(search).toLowerCase();
      filteredStocks = filteredStocks.filter(stock =>
        String(stock.companyName || '').toLowerCase().includes(searchTerm) ||
        String(stock.tickerCode || '').toLowerCase().includes(searchTerm)
      );
    }

    const limit = 12;
    const totalItems = filteredStocks.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedData = filteredStocks.slice((page - 1) * limit, page * limit);

    res.json({
      data: paginatedData,
      totalPages,
      currentPage: parseInt(page, 10)
    });
  } catch (error) {
    res.status(500).json({ message: '주식 목록 정보를 불러오는 데 실패했습니다.' });
  }
});

// 주식 거래 (매수/매도) + ✅ 수수료
router.post('/trade', async (req, res) => {
  const { username, tickerCode, quantity, type } = req.body;

  if (!username || !tickerCode || !quantity || !type) {
    return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
  }

  const tradeQuantity = parseInt(quantity, 10);
  if (isNaN(tradeQuantity) || tradeQuantity <= 0) {
    return res.status(400).json({ message: '올바른 수량을 입력해주세요.' });
  }

  try {
    const users = await readJsonFile(usersFilePath);
    const stocks = await readJsonFile(stocksFilePath);

    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const stockIndex = stocks.findIndex(s => s.tickerCode === tickerCode);
    if (stockIndex === -1) return res.status(404).json({ message: '존재하지 않는 종목입니다.' });

    const user = users[userIndex];
    const stock = stocks[stockIndex];

    user.balance = Number(user.balance) || 0;

    const tradePrice = Number(stock.currentPrice) || 0;
    const totalAmount = tradePrice * tradeQuantity;

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: '거래 금액이 올바르지 않습니다.' });
    }

    const fee = calcFee(totalAmount);

    if (type === 'buy') {
      const totalCost = totalAmount + fee;

      if (user.balance < totalCost) {
        return res.status(400).json({
          message: '예수금이 부족합니다.',
          needed: totalCost,
          balance: user.balance,
          fee,
          feeRate: FEE_RATE
        });
      }

      user.balance -= totalCost;

      const existingStock = user.portfolio.find(s => s.tickerCode === tickerCode);
      if (existingStock) {
        const totalPurchaseAmount =
          (existingStock.purchasePrice * existingStock.quantity) + totalAmount;

        existingStock.quantity += tradeQuantity;
        existingStock.purchasePrice = Math.round(totalPurchaseAmount / existingStock.quantity);
      } else {
        user.portfolio.push({
          tickerCode,
          companyName: stock.companyName,
          quantity: tradeQuantity,
          purchasePrice: tradePrice
        });
      }

      stock.volume = (stock.volume || 0) + tradeQuantity;

    } else if (type === 'sell') {
      const existingStock = user.portfolio.find(s => s.tickerCode === tickerCode);
      if (!existingStock || existingStock.quantity < tradeQuantity) {
        return res.status(400).json({ message: '보유 수량이 부족합니다.' });
      }

      const receive = Math.max(0, totalAmount - fee);
      user.balance += receive;

      existingStock.quantity -= tradeQuantity;
      if (existingStock.quantity === 0) {
        user.portfolio = user.portfolio.filter(s => s.tickerCode !== tickerCode);
      }

      stock.volume = (stock.volume || 0) + tradeQuantity;

    } else {
      return res.status(400).json({ message: '잘못된 거래 유형입니다.' });
    }

    await writeJsonFile(usersFilePath, users);
    await writeJsonFile(stocksFilePath, stocks);

    res.status(200).json({
      message: '거래가 성공적으로 체결되었습니다.',
      fee,
      feeRate: FEE_RATE
    });

  } catch (error) {
    console.error("Trade Error:", error);
    res.status(500).json({ message: '거래 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
