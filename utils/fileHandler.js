const fs = require('fs').promises; // promises를 import하여 async/await 사용
const path = require('path');

// 이 파일의 위치(utils)에서 한 단계 위인 프로젝트 루트 디렉토리를 기준으로 데이터 파일 경로 설정
const dataDir = path.join(__dirname, '..'); 

const complaintsFilePath = path.join(dataDir, 'complaints.json');
const usersFilePath = path.join(dataDir, 'users.json');
const schedulesFilePath = path.join(dataDir, 'schedules.json');
const newsFilePath = path.join(dataDir, 'news.json');
const postsFilePath = path.join(dataDir, 'posts.json');
const imagesFilePath = path.join(dataDir, 'images.json');
const realtyFilePath = path.join(dataDir, 'realty.json');
const stocksFilePath = path.join(dataDir, 'stocks.json');
const notificationsFilePath = path.join(dataDir, 'notifications.json');
const todoFilePath = path.join(dataDir, 'todo.json');
// [신규] 전자책 데이터 파일 경로 추가
const ebooksFilePath = path.join(dataDir, 'ebooks.json');

/**
 * JSON 파일을 비동기적으로 읽는 함수
 * @param {string} filePath - 읽을 파일의 경로
 * @returns {Promise<Array|Object>} 파싱된 JSON 데이터. 파일이 없으면 빈 배열 반환.
 */
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // 파일이 존재하지 않는 경우(ENOENT), 빈 배열을 반환하여 초기 상태 처리
        if (error.code === 'ENOENT') {
            return [];
        }
        // 그 외 다른 에러는 그대로 throw
        throw error;
    }
}

/**
 * 데이터를 JSON 파일에 비동기적으로 쓰는 함수
 * @param {string} filePath - 쓸 파일의 경로
 * @param {Array|Object} data - 저장할 데이터
 * @returns {Promise<void>}
 */
async function writeJsonFile(filePath, data) {
    // JSON.stringify의 세 번째 인자는 들여쓰기 칸 수로, 가독성을 높여줍니다.
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 다른 파일에서 사용할 수 있도록 함수와 경로 변수들을 export
module.exports = {
    readJsonFile,
    writeJsonFile,
    complaintsFilePath,
    usersFilePath,
    schedulesFilePath,
    newsFilePath,
    postsFilePath,
    imagesFilePath,
    realtyFilePath,
    stocksFilePath,
    notificationsFilePath,
    todoFilePath,
    // [신규] 전자책 경로 export
    ebooksFilePath,
};