const { readJsonFile, usersFilePath } = require('./fileHandler');

/**
 * 역할 기반 접근 제어 (RBAC) 미들웨어
 * @param {Array<string>} allowedRoles - 허용할 역할 목록 (예: ['admin', 'reporter'])
 */
const checkRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            // 요청에서 사용자명 추출 (Body 우선, Query 파라미터 차선)
            // 주의: 클라이언트가 보낸 username을 믿는 구조이므로, 추후 JWT 도입 시 수정 필요
            const username = req.body.username || req.query.username;

            if (!username) {
                return res.status(401).json({ message: '로그인이 필요합니다. (사용자 정보 누락)' });
            }

            const users = await readJsonFile(usersFilePath);
            const user = users.find(u => u.username === username);

            if (!user) {
                return res.status(401).json({ message: '존재하지 않는 사용자입니다.' });
            }

            // 요청된 역할이 허용된 역할 목록에 있는지 확인
            if (allowedRoles.includes(user.role)) {
                // 권한 있음 -> 다음 미들웨어/라우터로 진행
                next();
            } else {
                // 권한 없음
                return res.status(403).json({ message: '이 기능을 수행할 권한이 없습니다.' });
            }
        } catch (error) {
            console.error('Role Check Error:', error);
            res.status(500).json({ message: '서버 내부 오류로 권한을 확인할 수 없습니다.' });
        }
    };
};

module.exports = { checkRole };