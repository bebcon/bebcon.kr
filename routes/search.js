const express = require('express');
const router = express.Router();

const {
  readJsonFile,
  newsFilePath,
  postsFilePath,
  stocksFilePath,
  realtyFilePath,
  ebooksFilePath
} = require('../utils/fileHandler');

// 마크다운 이미지/HTML img 제거
const removeMarkdownImages = (text) => {
  if (!text) return '';
  return text
    .replace(/!\[[\s\S]*?\]\([\s\S]*?\)/g, '')
    .replace(/!\[[\s\S]*?\]/g, '')
    .replace(/<img[^>]*>/gi, '');
};

// -------------------------
// GET /api/search/integrated
// -------------------------
router.get('/integrated', async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === '') {
    return res.status(400).json({ message: '검색어를 입력해주세요.' });
  }

  const query = q.toLowerCase().trim();

  try {
    const [news, posts, stocks, realty, ebooks] = await Promise.all([
      readJsonFile(newsFilePath),
      readJsonFile(postsFilePath),
      readJsonFile(stocksFilePath),
      readJsonFile(realtyFilePath),
      readJsonFile(ebooksFilePath)
    ]);

    // [뉴스]
    const newsResults = (news || [])
      .filter(item => {
        const title = (item.title || '').toLowerCase();
        const rawText = item.rawContent || item.content || '';
        const content = removeMarkdownImages(rawText).toLowerCase();
        const author = (item.author || '').toLowerCase();

        let categoriesStr = '';
        if (Array.isArray(item.categories)) {
          categoriesStr = item.categories.map(c =>
            typeof c === 'object'
              ? `${c.category} ${(c.subcategories || []).join(' ')}`
              : c
          ).join(' ').toLowerCase();
        } else if (item.category) {
          categoriesStr = (item.category || '').toLowerCase();
        }

        return (
          title.includes(query) ||
          content.includes(query) ||
          author.includes(query) ||
          categoriesStr.includes(query)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // [커뮤니티]
    const postsResults = (posts || [])
      .filter(item => {
        const title = (item.title || '').toLowerCase();
        const content = removeMarkdownImages(item.content || '').toLowerCase();
        const author = (item.author || '').toLowerCase();
        const realName = (item.realName || '').toLowerCase();

        return (
          title.includes(query) ||
          content.includes(query) ||
          author.includes(query) ||
          realName.includes(query)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // [주식]
    const stocksResults = (stocks || [])
      .filter(item => {
        const name = (item.companyName || '').toLowerCase();
        const code = (item.tickerCode || '').toLowerCase();
        const industry = (item.industry || '').toLowerCase();
        return name.includes(query) || code.includes(query) || industry.includes(query);
      });

    // [부동산]
    const realtyResults = (realty || [])
      .filter(item => {
        const name = (item.name || '').toLowerCase();
        const region = (item.region || '').toLowerCase();
        const address = (item.address || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const realtorName = (item.realtor && item.realtor.name ? item.realtor.name : '').toLowerCase();

        return (
          name.includes(query) ||
          region.includes(query) ||
          address.includes(query) ||
          description.includes(query) ||
          realtorName.includes(query)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // ✅ [전자책]
    const ebooksResults = (ebooks || [])
      .filter(item => {
        const title = (item.title || '').toLowerCase();
        const author = (item.author || '').toLowerCase();
        const publisher = (item.publisher || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const tagsStr = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';

        // 본문까지 검색 (이미지 제거)
        const content = removeMarkdownImages(item.content || '').toLowerCase();

        return (
          title.includes(query) ||
          author.includes(query) ||
          publisher.includes(query) ||
          description.includes(query) ||
          tagsStr.includes(query) ||
          content.includes(query)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.json({
      query: q,
      results: {
        news: newsResults,
        posts: postsResults,
        stocks: stocksResults,
        realty: realtyResults,
        ebooks: ebooksResults
      },
      counts: {
        news: newsResults.length,
        posts: postsResults.length,
        stocks: stocksResults.length,
        realty: realtyResults.length,
        ebooks: ebooksResults.length
      }
    });

  } catch (error) {
    console.error('Integrated Search Error:', error);
    res.status(500).json({ message: '검색 처리 중 오류가 발생했습니다.' });
  }
});

// -------------------------
// GET /api/search/suggest
// 자동완성 용 (가볍게)
// -------------------------
router.get('/suggest', async (req, res) => {
  const { q, type = 'ebooks', limit = 8 } = req.query;

  if (!q || q.trim() === '') {
    return res.json({ items: [] });
  }

  const query = q.toLowerCase().trim();
  const n = Math.min(20, Math.max(1, parseInt(limit, 10) || 8));

  try {
    if (type !== 'ebooks') {
      return res.json({ items: [] });
    }

    const ebooks = await readJsonFile(ebooksFilePath);

    const items = (ebooks || [])
      .filter(b => {
        const title = (b.title || '').toLowerCase();
        const author = (b.author || '').toLowerCase();
        const tags = Array.isArray(b.tags) ? b.tags.join(' ').toLowerCase() : '';
        return title.includes(query) || author.includes(query) || tags.includes(query);
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, n)
      .map(b => ({
        id: b.id,
        title: b.title || '',
        author: b.author || ''
      }));

    res.json({ items });
  } catch (error) {
    console.error('Suggest Error:', error);
    res.status(500).json({ items: [] });
  }
});

module.exports = router;
