// routes/todos.js
const express = require('express');
const router = express.Router();
const { readJsonFile, writeJsonFile, todoFilePath } = require('../utils/fileHandler');

// GET /api/todos - 내 할 일 목록 조회
router.get('/', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

    try {
        const todos = await readJsonFile(todoFilePath);
        const myTodos = todos.filter(todo => todo.username === username);
        // 완료되지 않은 일을 먼저, 그 다음 생성일 순으로 정렬
        myTodos.sort((a, b) => (a.isCompleted === b.isCompleted) ? b.createdAt - a.createdAt : a.isCompleted ? 1 : -1);
        res.json(myTodos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '서버 오류' });
    }
});

// POST /api/todos - 할 일 추가
router.post('/', async (req, res) => {
    const { username, content } = req.body;
    if (!username || !content) return res.status(400).json({ message: '내용이 필요합니다.' });

    try {
        const todos = await readJsonFile(todoFilePath);
        const newTodo = {
            id: Date.now(),
            username,
            content,
            isCompleted: false,
            createdAt: Date.now()
        };
        todos.push(newTodo);
        await writeJsonFile(todoFilePath, todos);
        res.status(201).json(newTodo);
    } catch (error) {
        res.status(500).json({ message: '저장 실패' });
    }
});

// PATCH /api/todos/:id/toggle - 완료 상태 토글
router.patch('/:id/toggle', async (req, res) => {
    const { username } = req.body;
    const id = parseInt(req.params.id);

    try {
        const todos = await readJsonFile(todoFilePath);
        const todoIndex = todos.findIndex(t => t.id === id);

        if (todoIndex === -1) return res.status(404).json({ message: '할 일을 찾을 수 없습니다.' });
        if (todos[todoIndex].username !== username) return res.status(403).json({ message: '권한이 없습니다.' });

        todos[todoIndex].isCompleted = !todos[todoIndex].isCompleted;
        await writeJsonFile(todoFilePath, todos);
        res.json(todos[todoIndex]);
    } catch (error) {
        res.status(500).json({ message: '상태 변경 실패' });
    }
});

// DELETE /api/todos/:id - 삭제
router.delete('/:id', async (req, res) => {
    const { username } = req.body;
    const id = parseInt(req.params.id);

    try {
        const todos = await readJsonFile(todoFilePath);
        const newTodos = todos.filter(t => !(t.id === id && t.username === username));
        
        if (todos.length === newTodos.length) return res.status(403).json({ message: '삭제 권한이 없거나 항목이 없습니다.' });

        await writeJsonFile(todoFilePath, newTodos);
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '삭제 실패' });
    }
});

module.exports = router;