const express = require('express');
const router = express.Router();
const { readJsonFile, writeJsonFile, notificationsFilePath } = require('../utils/fileHandler');

// GET /api/notifications/my - 내 알림 목록 조회
router.get('/my', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    try {
        const notifications = await readJsonFile(notificationsFilePath);
        
        // 해당 사용자의 알림만 필터링하고 최신순(역순)으로 정렬
        const myNotifications = notifications
            .filter(n => n.targetUser === username)
            .sort((a, b) => b.createdAt - a.createdAt);

        // 읽지 않은 알림 개수 계산
        const unreadCount = myNotifications.filter(n => !n.isRead).length;

        res.json({
            data: myNotifications,
            unreadCount
        });
    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ message: '알림을 불러오는 중 오류가 발생했습니다.' });
    }
});

// PATCH /api/notifications/:id/read - 특정 알림 읽음 처리
router.patch('/:id/read', async (req, res) => {
    const notificationId = parseInt(req.params.id, 10);
    const { username } = req.body;

    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    try {
        const notifications = await readJsonFile(notificationsFilePath);
        const index = notifications.findIndex(n => n.id === notificationId);

        if (index === -1) {
            return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
        }

        // 본인의 알림인지 확인
        if (notifications[index].targetUser !== username) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }

        // 읽음 상태로 변경
        notifications[index].isRead = true;
        await writeJsonFile(notificationsFilePath, notifications);

        res.json({ message: '알림을 읽음 처리했습니다.', success: true });
    } catch (error) {
        console.error('Read Notification Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// PATCH /api/notifications/read-all - 모든 알림 읽음 처리
router.patch('/read-all', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    try {
        const notifications = await readJsonFile(notificationsFilePath);
        let modified = false;

        notifications.forEach(n => {
            if (n.targetUser === username && !n.isRead) {
                n.isRead = true;
                modified = true;
            }
        });

        if (modified) {
            await writeJsonFile(notificationsFilePath, notifications);
        }

        res.json({ message: '모든 알림을 읽음 처리했습니다.', success: true });
    } catch (error) {
        console.error('Read All Notifications Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// ▼▼▼ [신규] 모든 알림 삭제 ▼▼▼
router.delete('/delete-all', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    try {
        const notifications = await readJsonFile(notificationsFilePath);
        
        // 요청한 사용자의 알림만 제외하고 나머지 남김 (즉, 내 알림 모두 삭제)
        const updatedNotifications = notifications.filter(n => n.targetUser !== username);

        await writeJsonFile(notificationsFilePath, updatedNotifications);

        res.json({ message: '모든 알림을 삭제했습니다.', success: true });
    } catch (error) {
        console.error('Delete All Notifications Error:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});
// ▲▲▲ [신규] 모든 알림 삭제 ▲▲▲

module.exports = router;