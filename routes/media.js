const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { readJsonFile, writeJsonFile, imagesFilePath } = require('../utils/fileHandler');

// 이 라우터는 server.js로부터 uploadHosting 객체를 주입받아야 합니다.
module.exports = function(uploadHosting) {

    // GET /api/media-list - 미디어 목록 조회 (검색, 필터링, 페이지네이션)
    router.get('/list', async (req, res) => {
        try {
            const media = await readJsonFile(imagesFilePath);
            let filteredMedia = media;
            const { search, category, width, height, page = 1 } = req.query;

            if (search) {
                filteredMedia = filteredMedia.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));
            }
            if (category && category !== '전체') {
                filteredMedia = filteredMedia.filter(m => m.category === category);
            }
            if (width) {
                filteredMedia = filteredMedia.filter(m => m.width && m.width.toString() === width);
            }
            if (height) {
                filteredMedia = filteredMedia.filter(m => m.height && m.height.toString() === height);
            }

            const allCategories = [...new Set(media.map(m => m.category).filter(Boolean))];
            const limit = 12;
            const sortedMedia = filteredMedia.sort((a, b) => b.createdAt - a.createdAt);
            const totalItems = sortedMedia.length;
            const totalPages = Math.ceil(totalItems / limit);
            const paginatedData = sortedMedia.slice((page - 1) * limit, page * limit);

            res.json({
                data: paginatedData,
                totalPages,
                currentPage: parseInt(page, 10),
                allCategories
            });
        } catch (error) {
            console.error('Get Media List Error:', error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // POST /api/media-upload - 미디어 파일 업로드
    router.post('/upload', uploadHosting.single('mediaFile'), async (req, res) => {
        const { username, realName, title, category, width, height } = req.body;

        if (!username || !realName) {
            return res.status(401).json({ message: '미디어를 업로드하려면 로그인이 필요합니다.' });
        }
        if (!req.file) {
            return res.status(400).json({ message: '업로드할 파일이 없습니다.' });
        }

        try {
            const media = await readJsonFile(imagesFilePath);
            const widthNum = parseInt(width, 10) || null;
            const heightNum = parseInt(height, 10) || null;
            let sizeString = null;

            if (widthNum && heightNum) {
                sizeString = `${widthNum}x${heightNum} (${widthNum * 256}x${heightNum * 256})`;
            }

            const newMedia = {
                id: Date.now(),
                title: title || req.file.originalname,
                filename: req.file.filename,
                originalName: req.file.originalname,
                url: `/uploads/hosting/${req.file.filename}`,
                type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
                uploader: username,
                uploaderRealName: realName,
                createdAt: Date.now(),
                category: category || null,
                width: widthNum,
                height: heightNum,
                size: sizeString
            };

            media.push(newMedia);
            await writeJsonFile(imagesFilePath, media);
            res.status(201).json(newMedia);
        } catch (error) {
            console.error('Media Upload Error:', error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // DELETE /api/media/:id - 미디어 삭제
    router.delete('/:id', async (req, res) => {
        const mediaId = parseInt(req.params.id, 10);
        const { username } = req.body;
        if (!username) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }

        try {
            const media = await readJsonFile(imagesFilePath);
            const mediaIndex = media.findIndex(m => m.id === mediaId);
            if (mediaIndex === -1) {
                return res.status(404).json({ message: '삭제할 미디어를 찾지 못했습니다.' });
            }

            const mediaToDelete = media[mediaIndex];
            if (mediaToDelete.uploader !== username && username !== 'admin') {
                return res.status(403).json({ message: '미디어를 삭제할 권한이 없습니다.' });
            }

            // 실제 파일 삭제
            const mediaPath = path.join(__dirname, '..', 'uploads', 'hosting', mediaToDelete.filename);
            fs.unlink(mediaPath, (unlinkErr) => {
                if (unlinkErr) console.error("미디어 파일 삭제 오류:", unlinkErr);
            });

            const updatedMedia = media.filter(m => m.id !== mediaId);
            await writeJsonFile(imagesFilePath, updatedMedia);
            res.status(200).json({ message: '미디어가 성공적으로 삭제되었습니다.' });

        } catch (error) {
            console.error(`Delete Media ${mediaId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    return router;
};
