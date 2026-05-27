const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const {
    readJsonFile,
    newsFilePath,
    postsFilePath,
    imagesFilePath,
    realtyFilePath,
    stocksFilePath,
    ebooksFilePath // [추가] 전자책 경로
} = require('../utils/fileHandler');

// --- 정적 페이지 라우팅 ---
const publicDir = path.join(__dirname, '..', 'public');

router.get('/', (req, res) => { res.sendFile(path.join(publicDir, 'index.html')); });
router.get('/login', (req, res) => { res.sendFile(path.join(publicDir, 'login.html')); });
router.get('/signup', (req, res) => { res.sendFile(path.join(publicDir, 'signup.html')); });
router.get('/mypage', (req, res) => { res.sendFile(path.join(publicDir, 'mypage.html')); });
router.get('/complaints', (req, res) => { res.sendFile(path.join(publicDir, 'complaints.html')); });
router.get('/schedule', (req, res) => { res.sendFile(path.join(publicDir, 'schedule.html')); });
router.get('/news', (req, res) => { res.sendFile(path.join(publicDir, 'news.html')); });
router.get('/write-news', (req, res) => { res.sendFile(path.join(publicDir, 'write_news.html')); });
router.get('/edit-news/:id', (req, res) => { res.sendFile(path.join(publicDir, 'edit-news.html')); });
router.get('/find-password', (req, res) => { res.sendFile(path.join(publicDir, 'find-password.html')); });
router.get('/community', (req, res) => { res.sendFile(path.join(publicDir, 'community.html')); });
router.get('/write-post', (req, res) => { res.sendFile(path.join(publicDir, 'write-post.html')); });
router.get('/image-hosting', (req, res) => { res.sendFile(path.join(publicDir, 'image-hosting.html')); });
router.get('/realty', (req, res) => { res.sendFile(path.join(publicDir, 'realty.html')); });
router.get('/realty/:id', (req, res) => { res.sendFile(path.join(publicDir, 'realty-detail.html')); });
router.get('/write-realty', (req, res) => { res.sendFile(path.join(publicDir, 'write-realty.html')); });
router.get('/stock-main', (req, res) => { res.sendFile(path.join(publicDir, 'stock-main.html')); });
router.get('/stock-list', (req, res) => { res.sendFile(path.join(publicDir, 'stock-list.html')); });
router.get('/stock-detail', (req, res) => { res.sendFile(path.join(publicDir, 'stock-detail.html')); });
router.get('/todo', (req, res) => { res.sendFile(path.join(publicDir, 'todo.html')); });

// [신규] 전자책 관련 정적 라우팅
router.get('/ebooks', (req, res) => { res.sendFile(path.join(publicDir, 'ebook-list.html')); });
router.get('/ebook-reader/:id', (req, res) => { res.sendFile(path.join(publicDir, 'ebook-reader.html')); });
router.get('/ebook-write', (req, res) => { res.sendFile(path.join(publicDir, 'ebook-write.html')); });
router.get('/ebook-edit/:id', (req, res) => { res.sendFile(path.join(publicDir, 'ebook-write.html')); }); // 작성/수정 페이지 공용 사용

// --- 헬퍼 함수: HTML 특수문자 이스케이프 ---
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- 동적 오픈그래프(OG) 및 서버 사이드 콘텐츠 주입 페이지 라우팅 ---

// 1. 뉴스 상세 (기존 유지)
router.get('/news/:id', async (req, res) => {
    try {
        const newsId = parseInt(req.params.id, 10);
        const news = await readJsonFile(newsFilePath);
        const article = news.find(a => a.id === newsId);

        if (!article) return res.status(404).sendFile(path.join(publicDir, '404.html'));

        const htmlData = await fs.readFile(path.join(publicDir, 'article.html'), 'utf8');
        const description = article.content.replace(/<[^>]*>?/gm, '').replace(/\r\n|\n/g, ' ').substring(0, 100).replace(/"/g, '&quot;');
        const ogTags = `
            <meta property="og:type" content="article">
            <meta property="og:site_name" content="안현민국 뉴스">
            <meta property="og:title" content="${article.title.replace(/"/g, '&quot;')}">
            <meta property="og:description" content="${description}...">
            <meta property="og:image" content="https://bebcon.kr/images/og-image.png">
            <meta property="og:url" content="https://bebcon.kr/news/${article.id}">
        `;

        const serverRenderedContent = `
            <div class="server-content-preload">
                <h1>${escapeHtml(article.title)}</h1>
                <div class="meta-info">
                    <span>작성자: ${escapeHtml(article.author)}</span> | 
                    <span>날짜: ${new Date(article.createdAt).toLocaleDateString()}</span>
                </div>
                <hr>
                <div class="article-body" style="white-space: pre-wrap;">${escapeHtml(article.content)}</div>
            </div>
        `;

        let finalHtml = htmlData.replace('</head>', `${ogTags}</head>`);
        finalHtml = finalHtml.replace(/(<div[^>]*id=["']article-container["'][^>]*>)/i, `$1${serverRenderedContent}`);
        res.send(finalHtml);
    } catch (error) {
        res.status(500).send('페이지를 불러오는 중 오류가 발생했습니다.');
    }
});

// 2. 게시물 상세 (기존 유지)
router.get('/post/:id', async (req, res) => {
    try {
        const postId = parseInt(req.params.id, 10);
        const posts = await readJsonFile(postsFilePath);
        const post = posts.find(p => p.id === postId);

        if (!post) return res.status(404).sendFile(path.join(publicDir, '404.html'));

        const htmlData = await fs.readFile(path.join(publicDir, 'post-detail.html'), 'utf8');
        const description = post.content.replace(/\r\n|\n/g, ' ').substring(0, 100).replace(/"/g, '&quot;');
        const imageUrl = post.image ? `https://bebcon.kr${post.image}` : 'https://bebcon.kr/images/og-image.png';
        const ogTags = `
            <meta property="og:type" content="article">
            <meta property="og:site_name" content="안현민국 커뮤니티">
            <meta property="og:title" content="${post.title.replace(/"/g, '&quot;')}">
            <meta property="og:description" content="${description}...">
            <meta property="og:image" content="${imageUrl}">
            <meta property="og:url" content="https://bebcon.kr/post/${post.id}">
        `;

        const serverRenderedContent = `
            <div class="server-content-preload">
                <h1>${escapeHtml(post.title)}</h1>
                <div class="meta-info">
                    <span>작성자: ${escapeHtml(post.realName)}</span> | 
                    <span>날짜: ${new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                <hr>
                <div class="post-body" style="white-space: pre-wrap;">${escapeHtml(post.content)}</div>
            </div>
        `;

        let finalHtml = htmlData.replace('</head>', `${ogTags}</head>`);
        if (finalHtml.includes('id="post-content-area"')) {
            finalHtml = finalHtml.replace(/(<div[^>]*id=["']post-content-area["'][^>]*>)/i, `$1${serverRenderedContent}`);
        } else {
            finalHtml = finalHtml.replace(/(<div[^>]*id=["']post-detail-container["'][^>]*>)/i, `$1${serverRenderedContent}`);
        }
        res.send(finalHtml);
    } catch (error) {
        res.status(500).send('페이지를 불러오는 중 오류가 발생했습니다.');
    }
});

// [신규] 3. 전자책 리더 상세 (OG 태그 주입)
router.get('/ebook-reader/:id', async (req, res) => {
    try {
        const ebookId = parseInt(req.params.id, 10);
        const ebooks = await readJsonFile(ebooksFilePath);
        const ebook = ebooks.find(b => b.id === ebookId);

        if (!ebook) return res.status(404).sendFile(path.join(publicDir, '404.html'));

        const htmlData = await fs.readFile(path.join(publicDir, 'ebook-reader.html'), 'utf8');
        
        // OG 태그 생성
        const description = ebook.description ? ebook.description.substring(0, 100).replace(/"/g, '&quot;') : "안현민국 전자책 서비스";
        const coverImageUrl = ebook.coverImage ? `https://bebcon.kr${ebook.coverImage}` : 'https://bebcon.kr/images/og-image.png';
        
        const ogTags = `
            <meta property="og:type" content="book">
            <meta property="og:site_name" content="안현민국 전자책">
            <meta property="og:title" content="${ebook.title.replace(/"/g, '&quot;')}">
            <meta property="og:description" content="${description}...">
            <meta property="og:image" content="${coverImageUrl}">
            <meta property="og:url" content="https://bebcon.kr/ebook-reader/${ebook.id}">
        `;

        const finalHtml = htmlData.replace('</head>', `${ogTags}</head>`);
        res.send(finalHtml);
    } catch (error) {
        console.error('전자책 리더 페이지 처리 중 오류:', error);
        res.sendFile(path.join(publicDir, 'ebook-reader.html')); // 오류 시 기본 페이지라도 전송
    }
});


// --- 기타 API ---

// [신규] 뉴스 작성 페이지에 필요한 주식/산업 목록 데이터 제공
router.get('/api/stock-targets', async (req, res) => {
    try {
        const stocks = await readJsonFile(stocksFilePath);
        const companies = stocks.map(s => ({ name: s.companyName, code: s.tickerCode }));
        const industries = [...new Set(stocks.map(s => s.industry))];
        res.json({ companies, industries });
    } catch (error) {
        res.status(500).json({ message: '주식 정보를 불러오는 데 실패했습니다.' });
    }
});


// GET /api/autocomplete - 검색어 자동완성 데이터
router.get('/api/autocomplete', async (req, res) => {
    const { type } = req.query;
    let filePath;
    let isStock = false;

    switch (type) {
        case 'news': filePath = newsFilePath; break;
        case 'community': filePath = postsFilePath; break;
        case 'media': filePath = imagesFilePath; break;
        case 'realty': filePath = realtyFilePath; break;
        case 'stock': filePath = stocksFilePath; isStock = true; break;
        case 'ebook': filePath = ebooksFilePath; break; // [추가] 전자책 자동완성 지원
        default: return res.status(400).json({ message: '잘못된 타입입니다.' });
    }

    try {
        const data = await readJsonFile(filePath);
        let titles;
        if (isStock) {
            const stockNames = data.map(item => item.companyName).filter(Boolean);
            const stockCodes = data.map(item => item.tickerCode).filter(Boolean);
            titles = [...new Set([...stockNames, ...stockCodes])];
        } else {
            titles = data.map(item => item.title || item.name).filter(Boolean);
        }
        res.json(titles);
    } catch (error) {
        console.error('Autocomplete Error:', error);
        res.status(500).json({ message: '데이터 로딩 오류' });
    }
});


module.exports = router;