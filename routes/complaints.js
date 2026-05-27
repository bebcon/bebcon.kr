const express = require('express');
const router = express.Router();
const { readJsonFile, writeJsonFile, complaintsFilePath } = require('../utils/fileHandler');
const { checkRole } = require('../utils/auth'); // [신규] 권한 체크 미들웨어

// GET /api/complaints - 민원 목록 조회 (페이지네이션)
router.get('/', async (req, res) => {
    try {
        const complaints = await readJsonFile(complaintsFilePath);
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const sortedComplaints = complaints.sort((a, b) => b.createdAt - a.createdAt);
        const totalItems = sortedComplaints.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedData = sortedComplaints.slice((page - 1) * limit, page * limit);

        res.json({
            data: paginatedData,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error('Get Complaints Error:', error);
        res.status(500).json({ message: '민원 목록을 불러오는 중 오류가 발생했습니다.' });
    }
});

// GET /api/complaints/my-complaints - 내 민원 목록 조회
router.get('/my-complaints', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ message: '사용자 정보가 없습니다.' });
    }
    try {
        const allComplaints = await readJsonFile(complaintsFilePath);
        const myComplaints = allComplaints
            .filter(c => c.username === username)
            .sort((a, b) => b.createdAt - a.createdAt);
        res.json(myComplaints);
    } catch (error) {
        console.error('Get My Complaints Error:', error);
        res.status(500).send('내 민원 목록을 불러오는 데 실패했습니다.');
    }
});

// POST /api/complaints - 새 민원 작성 (누구나 가능)
router.post('/', async (req, res) => {
    const { author, username, title, content } = req.body;
    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    try {
        const newComplaint = {
            id: Date.now(),
            author,
            username,
            title,
            content,
            createdAt: Date.now(),
            status: '접수 완료',
            answer: null,
            answeredAt: null
        };
        const complaints = await readJsonFile(complaintsFilePath);
        complaints.push(newComplaint);
        await writeJsonFile(complaintsFilePath, complaints);
        res.status(201).json(newComplaint);
    } catch (error) {
        console.error('Create Complaint Error:', error);
        res.status(500).json({ message: '민원 접수 중 오류가 발생했습니다.' });
    }
});

// POST /api/complaints/:id/answer - 민원 답변 등록/수정
// [수정] 관리자(admin)만 답변 가능
router.post('/:id/answer', checkRole(['admin']), async (req, res) => {
    const complaintId = parseInt(req.params.id, 10);
    const { answer } = req.body; // checkRole이 이미 권한을 검사했으므로 username 체크 불필요

    try {
        const complaints = await readJsonFile(complaintsFilePath);
        const complaintIndex = complaints.findIndex(c => c.id === complaintId);
        if (complaintIndex === -1) {
            return res.status(404).json({ message: '해당 민원을 찾을 수 없습니다.' });
        }

        complaints[complaintIndex].answer = answer;
        complaints[complaintIndex].answeredAt = Date.now();

        const currentStatus = complaints[complaintIndex].status;
        if (currentStatus === '접수 완료' || currentStatus === '검토 중') {
            complaints[complaintIndex].status = '답변 완료';
        }

        await writeJsonFile(complaintsFilePath, complaints);
        res.status(200).json({ message: '답변이 성공적으로 등록(수정)되었습니다.' });
    } catch (error) {
        console.error(`Answer Complaint ${complaintId} Error:`, error);
        res.status(500).json({ message: '답변 저장 중 오류가 발생했습니다.' });
    }
});

// POST /api/complaints/:id/status - 민원 상태 변경
// [수정] 관리자(admin)만 상태 변경 가능
router.post('/:id/status', checkRole(['admin']), async (req, res) => {
    const complaintId = parseInt(req.params.id, 10);
    const { status } = req.body;

    try {
        const complaints = await readJsonFile(complaintsFilePath);
        const complaintIndex = complaints.findIndex(c => c.id === complaintId);
        if (complaintIndex === -1) {
            return res.status(404).json({ message: '해당 민원을 찾을 수 없습니다.' });
        }
        complaints[complaintIndex].status = status;
        await writeJsonFile(complaintsFilePath, complaints);
        res.status(200).json({ message: '상태가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error(`Update Complaint Status ${complaintId} Error:`, error);
        res.status(500).json({ message: '상태 정보 저장 중 오류가 발생했습니다.' });
    }
});

// PATCH /api/complaints/:id - 민원 수정 (작성자 본인만)
router.patch('/:id', async (req, res) => {
    const complaintId = parseInt(req.params.id, 10);
    const { username, title, content } = req.body;
    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    if (!title || !content) {
        return res.status(400).json({ message: '제목과 내용은 필수입니다.' });
    }

    try {
        const complaints = await readJsonFile(complaintsFilePath);
        const complaintIndex = complaints.findIndex(c => c.id === complaintId);

        if (complaintIndex === -1) {
            return res.status(404).json({ message: '수정할 민원을 찾지 못했습니다.' });
        }

        if (complaints[complaintIndex].username !== username) {
            return res.status(403).json({ message: '수정 권한이 없습니다.' });
        }

        complaints[complaintIndex].title = title;
        complaints[complaintIndex].content = content;

        await writeJsonFile(complaintsFilePath, complaints);
        res.status(200).json({ message: '민원이 성공적으로 수정되었습니다.', data: complaints[complaintIndex] });

    } catch (error) {
        console.error(`Edit Complaint ${complaintId} Error:`, error);
        res.status(500).json({ message: '민원 수정 중 오류가 발생했습니다.' });
    }
});

// DELETE /api/complaints/:id - 민원 삭제
// (작성자 본인 또는 관리자 가능 - 로직 내에서 처리 유지)
router.delete('/:id', async (req, res) => {
    const complaintId = parseInt(req.params.id, 10);
    const { username } = req.body;
    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    try {
        const complaints = await readJsonFile(complaintsFilePath);
        const complaintToDelete = complaints.find(c => c.id === complaintId);
        if (!complaintToDelete) {
            return res.status(404).json({ message: '삭제할 글을 찾지 못했습니다.' });
        }
        if (complaintToDelete.username !== username && username !== 'admin') {
            return res.status(403).json({ message: '삭제 권한이 없습니다.' });
        }
        const updatedComplaints = complaints.filter(c => c.id !== complaintId);
        await writeJsonFile(complaintsFilePath, updatedComplaints);
        res.status(200).json({ message: '삭제되었습니다.' });
    } catch (error) {
        console.error(`Delete Complaint ${complaintId} Error:`, error);
        res.status(500).json({ message: '민원 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = router;