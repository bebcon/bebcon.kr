const express = require('express');
const router = express.Router();
const { readJsonFile, writeJsonFile, newsFilePath, stocksFilePath } = require('../utils/fileHandler');
const { checkRole } = require('../utils/auth'); // [신규] 권한 체크 미들웨어 불러오기

// GET /api/news - 뉴스 목록 조회 (누구나 접근 가능)
router.get('/', async (req, res) => {
    try {
        const news = await readJsonFile(newsFilePath);
        const { category, subcategory, search, page = 1, limit = 10 } = req.query;
        let filteredNews = news;

        // 1차 분류 필터링
        if (category && category !== '전체') {
            filteredNews = filteredNews.filter(article => {
                if (Array.isArray(article.categories) && typeof article.categories[0] === 'object') {
                    return article.categories.some(c => c.category === category);
                } else if (Array.isArray(article.categories)) {
                    return article.categories.includes(category);
                } else if (typeof article.category === 'string') {
                    return article.category === category;
                }
                return false;
            });
        }
        
        // 2차 분류(subcategory) 필터링
        if (subcategory && subcategory !== '전체') {
            filteredNews = filteredNews.filter(article => {
                 if (Array.isArray(article.categories) && typeof article.categories[0] === 'object') {
                    return article.categories.some(c => c.subcategories && c.subcategories.includes(subcategory));
                } else if (article.subcategory) {
                    return article.subcategory === subcategory;
                }
                return false;
            });
        }

        // 검색어 필터링
        if (search) {
            const searchTerm = search.toLowerCase();
            filteredNews = filteredNews.filter(article =>
                (article.title && article.title.toLowerCase().includes(searchTerm)) ||
                (article.content && article.content.toLowerCase().includes(searchTerm))
            );
        }

        const sortedNews = filteredNews.sort((a, b) => b.createdAt - a.createdAt);
        const totalItems = sortedNews.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedData = sortedNews.slice((page - 1) * limit, page * limit);

        res.json({
            data: paginatedData,
            totalPages,
            currentPage: parseInt(page, 10)
        });
    } catch (error) {
        console.error('Get News Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// GET /api/news/stock/:tickerCode - 특정 주식 관련 뉴스 조회
router.get('/stock/:tickerCode', async (req, res) => {
    try {
        const { tickerCode } = req.params;
        const allNews = await readJsonFile(newsFilePath);
        
        const relatedNews = allNews
            .filter(news => news.targetStocks && news.targetStocks.some(stock => stock.tickerCode === tickerCode))
            .map(news => {
                const relevantStock = news.targetStocks.find(stock => stock.tickerCode === tickerCode);
                return {
                    ...news,
                    relevantSentiment: relevantStock ? relevantStock.sentiment : 'neutral'
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);
            
        res.json(relatedNews);
    } catch (error) {
        console.error(`Get related news for ${req.params.tickerCode} Error:`, error);
        res.status(500).json({ message: '관련 뉴스를 불러오는 중 오류가 발생했습니다.' });
    }
});

// GET /api/news/my-news - 내가 작성한 뉴스 조회 (관리자 및 기자)
// [수정] admin 뿐만 아니라 reporter도 접근 가능하게 변경할 수 있으나, 일단 checkRole 없이 목록 조회는 유지하고 필터링만 함
router.get('/my-news', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    try {
        const allNews = await readJsonFile(newsFilePath);
        // 권한 체크 없이 본인 글만 리턴 (프론트엔드에서 보여주기 용)
        const myNews = allNews.filter(a => a.username === username);
        res.json(myNews);
    } catch (error) {
        console.error('Get My News Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// GET /api/news/:id - 특정 뉴스 상세 조회
router.get('/:id', async (req, res) => {
    const newsId = parseInt(req.params.id, 10);
    try {
        const news = await readJsonFile(newsFilePath);
        const article = news.find(a => a.id === newsId);
        if (article) {
            res.json(article);
        } else {
            res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error(`Get News ${newsId} Error:`, error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// POST /api/news - 새 뉴스 작성
// [수정] 관리자(admin)와 기자(reporter)만 작성 가능
router.post('/', checkRole(['admin', 'reporter']), async (req, res) => {
    const { title, content, username, categories, author, targetStocks } = req.body;

    // 카테고리 유효성 검사
    if (!categories || !Array.isArray(categories) || categories.length === 0 || !author) {
        return res.status(400).json({ message: '하나 이상의 카테고리와 작성자는 필수입니다.' });
    }
    
    // Toast UI Editor 마크다운 이미지 태그 변환
    const imageRegex = /!\[(.*?)\]\((https?:\/\/\S+)\)/g;
    const simpleImageRegex = /!\[(https?:\/\/\S+)\]/g;
    let processedContent = content
        .replace(imageRegex, '<br /><img src="$2" alt="$1" style="max-width: 75%; border-radius: 8px;"/><br />')
        .replace(simpleImageRegex, '<br /><img src="$1" alt="Image" style="max-width: 75%; border-radius: 8px;"/><br />');


    const newArticle = {
        id: Date.now(),
        title,
        content: processedContent,
        rawContent: content,
        categories,
        author,
        username,
        createdAt: Date.now(),
        likes: 0,
        dislikes: 0,
        voters: [],
        targetStocks: targetStocks || []
    };

    try {
        const news = await readJsonFile(newsFilePath);
        news.push(newArticle);
        await writeJsonFile(newsFilePath, news);

        // 주식 변동성 스코어 로직
        if (targetStocks && Array.isArray(targetStocks) && targetStocks.length > 0) {
            const stocks = await readJsonFile(stocksFilePath);
            let stocksModified = false;
            targetStocks.forEach(target => {
                if (target.tickerCode && target.sentiment && target.sentiment !== 'neutral') {
                    const stockIndex = stocks.findIndex(s => s.tickerCode === target.tickerCode);
                    if (stockIndex !== -1) {
                        let currentScore = stocks[stockIndex].fluctuationScore;
                        if (typeof currentScore !== 'number') currentScore = 50;
                        if (target.sentiment === 'positive') {
                            stocks[stockIndex].fluctuationScore = Math.min(100, currentScore + 20);
                        } else if (target.sentiment === 'negative') {
                            stocks[stockIndex].fluctuationScore = Math.max(0, currentScore - 20);
                        }
                        stocksModified = true;
                    }
                }
            });
            if (stocksModified) {
                await writeJsonFile(stocksFilePath, stocks);
            }
        }
        res.status(201).json(newArticle);
    } catch (error) {
        console.error('Create News Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


// PUT /api/news/:id - 뉴스 수정
// [수정] 관리자(admin)와 기자(reporter)만 수정 가능
router.put('/:id', checkRole(['admin', 'reporter']), async (req, res) => {
    const newsId = parseInt(req.params.id, 10);
    const { title, content, categories, author, targetStocks, username } = req.body; 
    // checkRole 미들웨어가 username을 체크하지만, 로직 내에서 작성자 확인을 위해 username을 받습니다.

    if (!categories || !Array.isArray(categories) || categories.length === 0 || !author) {
        return res.status(400).json({ message: '하나 이상의 카테고리와 작성자는 필수입니다.' });
    }
    
    // Toast UI Editor 마크다운 이미지 태그 변환
    const imageRegex = /!\[(.*?)\]\((https?:\/\/\S+)\)/g;
    const simpleImageRegex = /!\[(https?:\/\/\S+)\]/g;
    let processedContent = content
        .replace(imageRegex, '<br /><img src="$2" alt="$1" style="max-width: 75%; border-radius: 8px;"/><br />')
        .replace(simpleImageRegex, '<br /><img src="$1" alt="Image" style="max-width: 75%; border-radius: 8px;"/><br />');

    try {
        const news = await readJsonFile(newsFilePath);
        const articleIndex = news.findIndex(a => a.id === newsId);

        if (articleIndex === -1) {
            return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
        }

        const originalArticle = news[articleIndex];
        
        // [추가] 기자는 본인의 글만 수정 가능 (관리자는 모두 가능)
        if (username !== 'admin' && originalArticle.username !== username) {
            return res.status(403).json({ message: '본인의 기사만 수정할 수 있습니다.' });
        }

        const updatedArticle = {
            ...originalArticle,
            title,
            content: processedContent,
            rawContent: content,
            categories,
            author,
            targetStocks: targetStocks || [],
            updatedAt: Date.now()
        };

        news[articleIndex] = updatedArticle;
        await writeJsonFile(newsFilePath, news);
        
        res.status(200).json(updatedArticle);
    } catch (error) {
        console.error(`Update News ${newsId} Error:`, error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


// POST /api/news/:id/vote - 뉴스 추천/비추천 (누구나 가능)
router.post('/:id/vote', async (req, res) => {
    const newsId = parseInt(req.params.id, 10);
    const { voteType, username } = req.body;
    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

    try {
        const news = await readJsonFile(newsFilePath);
        const articleIndex = news.findIndex(a => a.id === newsId);
        if (articleIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

        const article = news[articleIndex];
        if (!article.voters) article.voters = [];
        if (article.voters.includes(username)) return res.status(409).json({ message: '이미 이 게시물에 투표하셨습니다.' });

        if (voteType === 'like') {
            article.likes = (article.likes || 0) + 1;
        } else if (voteType === 'dislike') {
            article.dislikes = (article.dislikes || 0) + 1;
        }

        article.voters.push(username);
        await writeJsonFile(newsFilePath, news);
        res.status(200).json(article);
    } catch (error) {
        console.error(`Vote News ${newsId} Error:`, error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// DELETE /api/news/:id - 뉴스 삭제
// [수정] 관리자(admin)와 기자(reporter)만 삭제 가능
router.delete('/:id', checkRole(['admin', 'reporter']), async (req, res) => {
    const articleId = parseInt(req.params.id, 10);
    const { username } = req.body;

    try {
        const news = await readJsonFile(newsFilePath);
        const articleToDelete = news.find(a => a.id === articleId);

        if (!articleToDelete) {
            return res.status(404).json({ message: '삭제할 게시물을 찾을 수 없습니다.' });
        }

        // [추가] 기자는 본인의 글만 삭제 가능
        if (username !== 'admin' && articleToDelete.username !== username) {
            return res.status(403).json({ message: '본인의 기사만 삭제할 수 있습니다.' });
        }

        const updatedNews = news.filter(a => a.id !== articleId);
        await writeJsonFile(newsFilePath, updatedNews);
        res.status(200).json({ message: '게시물이 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error(`Delete News ${articleId} Error:`, error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;