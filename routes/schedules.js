const express = require('express');
const router = express.Router();
const { readJsonFile, writeJsonFile, schedulesFilePath } = require('../utils/fileHandler');
const { checkRole } = require('../utils/auth'); // [신규] 권한 체크 미들웨어

// GET /api/schedules - 전체 일정 조회 (FullCalendar 형식에 맞게)
router.get('/', async (req, res) => {
    try {
        const schedules = await readJsonFile(schedulesFilePath);
        const calendarEvents = schedules.map(schedule => ({
            title: schedule.content,
            start: schedule.date
        }));
        res.json(calendarEvents);
    } catch (error) {
        console.error('Get Schedules Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// POST /api/schedules - 새 일정 등록
// [수정] 관리자(admin)만 일정 등록 가능
router.post('/', checkRole(['admin']), async (req, res) => {
    const { date, content } = req.body;
    // checkRole 미들웨어 덕분에 username 체크 불필요

    if (!date || !content) {
        return res.status(400).json({ message: '날짜와 내용은 필수입니다.' });
    }

    const newSchedule = {
        id: Date.now(),
        date,
        content
    };

    try {
        const schedules = await readJsonFile(schedulesFilePath);
        schedules.push(newSchedule);
        // 날짜순으로 정렬
        schedules.sort((a, b) => new Date(a.date) - new Date(b.date));

        await writeJsonFile(schedulesFilePath, schedules);
        res.status(201).json(newSchedule);
    } catch (error) {
        console.error('Create Schedule Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;