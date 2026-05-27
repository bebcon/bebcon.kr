const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { readJsonFile, writeJsonFile, realtyFilePath } = require('../utils/fileHandler');
const { checkRole } = require('../utils/auth'); // [신규] 권한 체크 미들웨어

// 이 라우터는 server.js로부터 upload 객체를 주입받아야 합니다.
module.exports = function(upload) {

    // GET /api/realty - 부동산 매물 목록 조회 (누구나)
    router.get('/', async (req, res) => {
        try {
            const realty = await readJsonFile(realtyFilePath);
            const { category, search, page = 1 } = req.query;
            let filteredRealty = realty;

            if (category && category !== '전체') {
                filteredRealty = filteredRealty.filter(item => item.category === category);
            }
            if (search) {
                const searchTerm = search.toLowerCase();
                filteredRealty = filteredRealty.filter(item =>
                    (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                    (item.region && item.region.toLowerCase().includes(searchTerm))
                );
            }

            const sortedRealty = filteredRealty.sort((a, b) => b.createdAt - a.createdAt);
            const limit = 12;
            const totalItems = sortedRealty.length;
            const totalPages = Math.ceil(totalItems / limit);
            const paginatedData = sortedRealty.slice((page - 1) * limit, page * limit);

            res.json({
                data: paginatedData,
                totalPages,
                currentPage: parseInt(page, 10)
            });
        } catch (error) {
            console.error('Get Realty List Error:', error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // GET /api/realty/:id - 특정 매물 상세 정보 조회
    router.get('/:id', async (req, res) => {
        const realtyId = parseInt(req.params.id, 10);
        try {
            const realty = await readJsonFile(realtyFilePath);
            const item = realty.find(r => r.id === realtyId);
            if (item) {
                res.json(item);
            } else {
                res.status(44).json({ message: '해당 매물을 찾을 수 없습니다.' });
            }
        } catch (error) {
            console.error(`Get Realty Detail ${realtyId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // POST /api/realty - 새 매물 등록
    // [수정] 관리자(admin)와 공인중개사(realtor)만 등록 가능
    // 주의: multer(upload.fields)가 req.body를 파싱한 후에 checkRole이 실행되어야 username을 읽을 수 있음
    router.post('/', 
        upload.fields([
            { name: 'thumbnail', maxCount: 1 },
            { name: 'images', maxCount: 50 }
        ]), 
        checkRole(['admin', 'realtor']), 
        async (req, res) => {
            const { username, ...formData } = req.body;
            // checkRole에서 이미 권한을 검사했으므로, 여기서는 별도 체크 불필요

            const thumbnailFile = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;
            const imageFiles = req.files['images'] || [];

            if (!thumbnailFile) {
                return res.status(400).json({ message: '대표 이미지는 필수입니다.' });
            }

            try {
                const realty = await readJsonFile(realtyFilePath);
                let completedAtValue = formData.completedAt;
                if (completedAtValue && !completedAtValue.trim().endsWith('준공')) {
                    completedAtValue = `${completedAtValue.trim()} 준공`;
                }

                const newRealty = {
                    id: Date.now(),
                    category: formData.category,
                    name: formData.name,
                    description: formData.description,
                    region: formData.region,
                    address: formData.address,
                    thumbnail: `/uploads/${thumbnailFile.filename}`,
                    images: imageFiles.map(file => `/uploads/${file.filename}`),
                    size: {
                        blocks_w: parseInt(formData.blocks_w, 10),
                        blocks_h: parseInt(formData.blocks_h, 10),
                        area_m2: parseFloat(formData.area_m2)
                    },
                    price: {
                        type: formData.price_type,
                        value: formData.price_value
                    },
                    floor: formData.floor,
                    completedAt: completedAtValue,
                    ipju: formData.ipju,
                    realtor: {
                        name: formData.realtor_name,
                        contact: formData.realtor_contact
                    },
                    uploader: username, // [추가] 등록자 정보 저장
                    createdAt: Date.now()
                };

                realty.push(newRealty);
                await writeJsonFile(realtyFilePath, realty);
                res.status(201).json({ message: '매물이 성공적으로 등록되었습니다.', data: newRealty });

            } catch (error) {
                console.error('Create Realty Error:', error);
                // 업로드 실패 시 파일 삭제
                if (thumbnailFile) fs.unlink(thumbnailFile.path, () => {});
                imageFiles.forEach(file => fs.unlink(file.path, () => {}));
                res.status(500).json({ message: '서버 오류가 발생했습니다.' });
            }
    });

    // DELETE /api/realty/:id - 매물 삭제
    // [수정] 관리자(admin)와 공인중개사(realtor)만 삭제 가능
    router.delete('/:id', checkRole(['admin', 'realtor']), async (req, res) => {
        const realtyId = parseInt(req.params.id, 10);
        const { username } = req.body;

        try {
            const realty = await readJsonFile(realtyFilePath);
            const itemToDelete = realty.find(r => r.id === realtyId);
            if (!itemToDelete) {
                return res.status(404).json({ message: '삭제할 매물을 찾을 수 없습니다.' });
            }

            // [추가] 중개사는 본인이 올린 매물만 삭제 가능
            if (username !== 'admin' && itemToDelete.uploader && itemToDelete.uploader !== username) {
                return res.status(403).json({ message: '본인이 등록한 매물만 삭제할 수 있습니다.' });
            }

            // 연결된 파일들 삭제
            const filesToDelete = [itemToDelete.thumbnail, ...itemToDelete.images];
            filesToDelete.forEach(fileUrl => {
                if (fileUrl) {
                    const filePath = path.join(__dirname, '..', fileUrl);
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                            console.error(`파일 삭제 오류: ${filePath}`, unlinkErr);
                        }
                    });
                }
            });

            const updatedRealty = realty.filter(r => r.id !== realtyId);
            await writeJsonFile(realtyFilePath, updatedRealty);
            res.status(200).json({ message: '매물이 성공적으로 삭제되었습니다.' });

        } catch (error) {
            console.error(`Delete Realty ${realtyId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    return router;
};