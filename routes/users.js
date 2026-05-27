const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { readJsonFile, writeJsonFile, usersFilePath } = require('../utils/fileHandler');

// A temporary in-memory store for users who are verifying their email
let tempUsers = {}; 

// Setup for the email transporter using Gmail
const transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { 
        user: process.env.GMAIL_USER, 
        pass: process.env.GMAIL_APP_PASSWORD 
    } 
});

// [신규] 특수 계정 초기화 (Seeding) 로직
const SPECIAL_ACCOUNTS = [
    { username: 'admin', password: 'Anhyeongov1!', realName: '관리자', role: 'admin' },
    { username: 'rea1ty', password: 'Anhyeonbds1!', realName: '공인중개사', role: 'realtor' },
    { username: 'r2port2r', password: 'Anhyeonrpt1!', realName: '기자', role: 'reporter' }
];

async function initializeSpecialAccounts() {
    try {
        let users = [];
        try {
            users = await readJsonFile(usersFilePath);
        } catch (fileError) {
            if (fileError.code !== 'ENOENT') throw fileError;
        }

        let modified = false;

        for (const account of SPECIAL_ACCOUNTS) {
            // 이미 존재하는지 확인
            const exists = users.find(u => u.username === account.username);
            if (!exists) {
                const hashedPassword = await bcrypt.hash(account.password, 10);
                users.push({
                    id: Date.now() + Math.floor(Math.random() * 10000), // 겹치지 않게 난수 추가
                    realName: account.realName,
                    dob: '0000-00-00', // 특수 계정은 더미 데이터
                    email: `${account.username}@bebcon.kr`, // 특수 계정은 더미 이메일
                    username: account.username,
                    password: hashedPassword,
                    role: account.role, // 역할 부여
                    balance: 9999999999, // 업무용 계정은 자산 넉넉하게
                    portfolio: []
                });
                console.log(`[System] 특수 계정 생성 완료: ${account.username} (${account.role})`);
                modified = true;
            }
        }

        if (modified) {
            await writeJsonFile(usersFilePath, users);
        }
    } catch (error) {
        console.error('[System] 특수 계정 초기화 중 오류 발생:', error);
    }
}

// 모듈이 로드될 때 초기화 함수 실행
initializeSpecialAccounts();


// Route to handle signup requests
router.post('/signup', async (req, res) => {
    const { realName, dob, email, username, password } = req.body;

    // --- Input Validation ---
    if (!/^[a-z]{1,10}$/.test(username)) {
        return res.status(400).json({ message: '아이디는 1~10자의 영어 소문자만 사용 가능합니다.' });
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(password)) {
        return res.status(400).json({ message: '비밀번호는 15자 이하, 영문 대/소문자, 숫자, 특수기호를 모두 포함해야 합니다.' });
    }
    
    try {
        let users;
        try {
            users = await readJsonFile(usersFilePath);
        } catch (fileError) {
            if (fileError.code === 'ENOENT') {
                users = [];
            } else {
                throw fileError;
            }
        }

        if (users.find(u => u.username === username) || users.find(u => u.email === email)) {
            return res.status(409).json({ message: '이미 사용 중인 아이디 또는 이메일입니다.' });
        }

        const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
        tempUsers[email] = { ...req.body, verificationCode };
        
        await transporter.sendMail({ 
            from: process.env.GMAIL_USER, 
            to: email, 
            subject: '[안현민국] 회원가입 이메일 인증번호입니다.', 
            html: `<h2>안현민국 누리집에 가입하신 것을 진심으로 환영합니다.</h2><p>인증번호 6자리를 입력해주세요: <strong>${verificationCode}</strong></p>` 
        });

        res.status(200).json({ message: '인증번호가 이메일로 발송되었습니다.' });

    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: '서버 오류로 인해 회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    }
});

// Route to handle email verification
router.post('/verify', async (req, res) => {
    const { email, code } = req.body;
    const tempUser = tempUsers[email];

    if (!tempUser || tempUser.verificationCode !== code) {
        return res.status(400).json({ message: '인증번호가 올바르지 않습니다.' });
    }

    try {
        let users;
        try {
            users = await readJsonFile(usersFilePath);
        } catch (fileError) {
            if (fileError.code === 'ENOENT') {
                users = [];
            } else {
                throw fileError;
            }
        }

        const hashedPassword = await bcrypt.hash(tempUser.password, 10);
        const newUser = { 
            id: Date.now(), 
            realName: tempUser.realName, 
            dob: tempUser.dob, 
            email: tempUser.email, 
            username: tempUser.username, 
            password: hashedPassword, 
            role: 'user', // 일반 가입자는 user 역할 고정
            balance: 10000000, 
            portfolio: [] 
        };
        
        users.push(newUser);
        await writeJsonFile(usersFilePath, users);
        
        delete tempUsers[email];
        
        res.status(201).json({ message: '회원가입이 성공적으로 완료되었습니다.' });
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: '서버 오류로 인해 회원가입에 실패했습니다.' });
    }
});

// Route to handle user login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await readJsonFile(usersFilePath);
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            // [수정] 로그인 성공 시 role 정보도 함께 반환
            res.status(200).json({ 
                message: `${user.realName}님, 로그인을 환영합니다.`, 
                username: user.username, 
                realName: user.realName,
                role: user.role || 'user' // role이 없으면 기본값 user
            });
        } else {
            res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// Route to get a user's portfolio and balance
router.get('/portfolio', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ message: '사용자 정보가 필요합니다.' });
    }

    try {
        const users = await readJsonFile(usersFilePath);
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json({
            balance: user.balance,
            portfolio: user.portfolio || []
        });
    } catch (error) {
        console.error("Portfolio Fetch Error:", error);
        res.status(500).json({ message: '사용자 정보를 불러오는 데 실패했습니다.' });
    }
});


// Route to change a user's password
router.post('/change-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(newPassword)) {
        return res.status(400).json({ message: '새 비밀번호는 15자 이하, 영문 대/소문자, 숫자, 특수기호를 모두 포함해야 합니다.' });
    }
    
    try {
        const users = await readJsonFile(usersFilePath);
        const userIndex = users.findIndex(u => u.username === username);

        if (userIndex === -1) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, users[userIndex].password);
        
        if (!isMatch) {
            return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
        }
        
        users[userIndex].password = await bcrypt.hash(newPassword, 10);
        await writeJsonFile(usersFilePath, users);
        
        res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: '비밀번호 변경 중 오류가 발생했습니다.' });
    }
});

// Route to delete a user account
router.post('/delete-account', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await readJsonFile(usersFilePath);
        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
        }
        
        const updatedUsers = users.filter(u => u.username !== username);
        await writeJsonFile(usersFilePath, updatedUsers);
        
        res.status(200).json({ message: '회원 탈퇴가 완료되었습니다.' });
    } catch (error) {
        console.error("Delete Account Error:", error);
        res.status(500).json({ message: '회원 탈퇴 처리 중 오류가 발생했습니다.' });
    }
});

// Route to request a password reset
router.post('/request-password-reset', async (req, res) => {
    const { email, username } = req.body;

    if (!email || !username) {
        return res.status(400).json({ message: '이메일과 아이디를 모두 입력해주세요.' });
    }
    
    try {
        const users = await readJsonFile(usersFilePath);
        const user = users.find(u => u.email === email && u.username === username);

        if (!user) {
            return res.status(404).json({ message: '일치하는 사용자 정보가 없습니다.' });
        }

        const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
        tempUsers[email] = { ...tempUsers[email], username: user.username, resetCode: verificationCode, resetTimestamp: Date.now() };

        await transporter.sendMail({
            from: process.env.GMAIL_USER, 
            to: email,
            subject: '[안현민국] 비밀번호 재설정 인증번호입니다.',
            html: `<h2>비밀번호 재설정 인증번호</h2><p>요청하신 인증번호 6자리를 입력해주세요: <strong>${verificationCode}</strong></p><p>이 인증번호는 10분간 유효합니다.</p>`
        });

        res.status(200).json({ message: '인증번호가 이메일로 발송되었습니다.' });
    } catch (error) {
        console.error("Request Password Reset Error:", error);
        res.status(500).json({ message: '인증메일 발송에 실패했습니다.' });
    }
});

// Route to reset password
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(newPassword)) {
        return res.status(400).json({ message: '새 비밀번호는 15자 이하, 영문 대/소문자, 숫자, 특수기호를 모두 포함해야 합니다.' });
    }

    const tempUserData = tempUsers[email];
    const tenMinutes = 10 * 60 * 1000;

    if (!tempUserData || tempUserData.resetCode !== code || (Date.now() - tempUserData.resetTimestamp > tenMinutes)) {
        return res.status(400).json({ message: '인증번호가 올바르지 않거나 만료되었습니다. 다시 시도해주세요.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const users = await readJsonFile(usersFilePath);
        const userIndex = users.findIndex(u => u.username === tempUserData.username);

        if (userIndex === -1) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        users[userIndex].password = hashedPassword;
        await writeJsonFile(usersFilePath, users);
        
        // Clean up the temporary reset data
        delete tempUsers[email].resetCode;
        delete tempUsers[email].resetTimestamp;

        res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: '비밀번호 재설정 중 오류가 발생했습니다.' });
    }
});

module.exports = router;