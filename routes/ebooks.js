const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { readJsonFile, writeJsonFile, ebooksFilePath } = require('../utils/fileHandler');

module.exports = (upload) => {
    // ✅ coverImage 경로 생성: uploadEbookCover가 uploads/ebooks에 저장되므로 URL도 /uploads/ebooks 로
    const buildCoverUrl = (file) => (file ? `/uploads/ebooks/${file.filename}` : '/images/default-ebook-cover.png');

    // ✅ 업로드된 표지 파일만 안전 삭제 (/uploads/ebooks/... 인 경우)
    const deleteCoverFileIfExists = (coverUrl) => {
        try {
            if (!coverUrl) return;
            if (!coverUrl.startsWith('/uploads/ebooks/')) return; // 기본 이미지 등은 건드리지 않음

            const filename = coverUrl.replace('/uploads/ebooks/', '');
            const absPath = path.join(__dirname, '..', 'uploads', 'ebooks', filename);

            if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } catch (err) {
            // 삭제 실패해도 기능은 계속 진행
            console.warn('표지 파일 삭제 실패:', err.message);
        }
    };

    // 1. 전자책 목록 조회 (페이징, 검색 포함)
    router.get('/', async (req, res) => {
        try {
            const ebooks = await readJsonFile(ebooksFilePath);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;
            const search = req.query.search ? req.query.search.toLowerCase() : '';
            const category = req.query.category || 'all';

            // 검색 및 필터링
            let filtered = ebooks.filter(b => {
                const matchesSearch = b.title.toLowerCase().includes(search) ||
                                    b.author.toLowerCase().includes(search) ||
                                    (b.tags && b.tags.some(t => t.toLowerCase().includes(search)));
                const matchesCategory = category === 'all' || b.category === category;
                return matchesSearch && matchesCategory;
            });

            // 정렬 (최신순)
            filtered.sort((a, b) => b.createdAt - a.createdAt);

            const totalItems = filtered.length;
            const totalPages = Math.ceil(totalItems / limit);
            const offset = (page - 1) * limit;
            const pagedData = filtered.slice(offset, offset + limit);

            res.json({
                ebooks: pagedData,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: totalItems
                }
            });
        } catch (error) {
            console.error('전자책 목록 조회 오류:', error);
            res.status(500).json({ message: '목록을 불러오는 중 오류가 발생했습니다.' });
        }
    });

    // 2. 전자책 상세 조회 (ID 기준)
    router.get('/:id', async (req, res) => {
        try {
            const ebooks = await readJsonFile(ebooksFilePath);
            const ebook = ebooks.find(b => b.id === parseInt(req.params.id));

            if (!ebook) {
                return res.status(404).json({ message: '해당 전자책을 찾을 수 없습니다.' });
            }

            // 조회수 증가
            ebook.views = (ebook.views || 0) + 1;
            await writeJsonFile(ebooksFilePath, ebooks);

            res.json(ebook);
        } catch (error) {
            res.status(500).json({ message: '데이터를 읽는 중 오류가 발생했습니다.' });
        }
    });

    // 3. 전자책 작성 (표지 이미지 업로드 포함)
    router.post('/', upload.single('coverImage'), async (req, res) => {
        try {
            const { title, author, publisher, description, content, tags, username } = req.body;
            if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

            const ebooks = await readJsonFile(ebooksFilePath);

            const newEbook = {
                id: Date.now(),
                title,
                author,
                publisher,
                description,
                content, // Toast UI Editor 내용
                tags: tags ? tags.split(',').map(t => t.trim()) : [],
                // ✅ 변경: /uploads/ebooks/...
                coverImage: buildCoverUrl(req.file),
                authorId: username,
                views: 0,
                likes: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            ebooks.push(newEbook);
            await writeJsonFile(ebooksFilePath, ebooks);

            res.status(201).json({ message: '전자책이 성공적으로 등록되었습니다.', ebookId: newEbook.id });
        } catch (error) {
            console.error('전자책 등록 오류:', error);
            res.status(500).json({ message: '등록 중 오류가 발생했습니다.' });
        }
    });

    // 4. 전자책 수정
    router.put('/:id', upload.single('coverImage'), async (req, res) => {
        try {
            const { title, author, publisher, description, content, tags, username } = req.body;
            const ebooks = await readJsonFile(ebooksFilePath);
            const index = ebooks.findIndex(b => b.id === parseInt(req.params.id));

            if (index === -1) return res.status(404).json({ message: '책을 찾을 수 없습니다.' });
            if (ebooks[index].authorId !== username) return res.status(403).json({ message: '권한이 없습니다.' });

            // ✅ 새 표지 업로드가 있으면 기존 표지 파일 삭제(uploads/ebooks만)
            if (req.file) {
                deleteCoverFileIfExists(ebooks[index].coverImage);
            }

            ebooks[index] = {
                ...ebooks[index],
                title,
                author,
                publisher,
                description,
                content,
                tags: tags ? tags.split(',').map(t => t.trim()) : [],
                // ✅ 변경: 새 파일이 있으면 /uploads/ebooks/...로 갱신
                ...(req.file ? { coverImage: buildCoverUrl(req.file) } : {}),
                updatedAt: Date.now()
            };

            await writeJsonFile(ebooksFilePath, ebooks);
            res.json({ message: '수정되었습니다.' });
        } catch (error) {
            res.status(500).json({ message: '수정 중 오류가 발생했습니다.' });
        }
    });

    // 5. 전자책 삭제
    router.delete('/:id', async (req, res) => {
        try {
            const { username } = req.body;
            const ebooks = await readJsonFile(ebooksFilePath);
            const ebook = ebooks.find(b => b.id === parseInt(req.params.id));

            if (!ebook) return res.status(404).json({ message: '책을 찾을 수 없습니다.' });
            if (ebook.authorId !== username) return res.status(403).json({ message: '권한이 없습니다.' });

            // ✅ 삭제 시 표지 파일도 삭제(uploads/ebooks만)
            deleteCoverFileIfExists(ebook.coverImage);

            const filtered = ebooks.filter(b => b.id !== parseInt(req.params.id));
            await writeJsonFile(ebooksFilePath, filtered);

            res.json({ message: '삭제되었습니다.' });
        } catch (error) {
            res.status(500).json({ message: '삭제 중 오류가 발생했습니다.' });
        }
    });

    // 6. 좋아요 기능 (인당 1회)
    router.post('/:id/like', async (req, res) => {
        try {
            const { username } = req.body;
            if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

            const ebooks = await readJsonFile(ebooksFilePath);
            const ebook = ebooks.find(b => b.id === parseInt(req.params.id));

            if (!ebook) return res.status(404).json({ message: '책을 찾을 수 없습니다.' });

            if (!ebook.likes) ebook.likes = [];

            const likeIndex = ebook.likes.indexOf(username);
            if (likeIndex > -1) {
                ebook.likes.splice(likeIndex, 1);
                await writeJsonFile(ebooksFilePath, ebooks);
                return res.json({ message: '좋아요를 취소했습니다.', liked: false, count: ebook.likes.length });
            } else {
                ebook.likes.push(username);
                await writeJsonFile(ebooksFilePath, ebooks);
                return res.json({ message: '좋아요를 눌렀습니다.', liked: true, count: ebook.likes.length });
            }
        } catch (error) {
            res.status(500).json({ message: '처리 중 오류가 발생했습니다.' });
        }
    });

    return router;
};
