// 1. 필요한 모듈 가져오기
const express = require('express');
const path =require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const https = require('https');

// [수정] multer는 한 번만 불러옵니다.
const multer = require('multer'); 
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// 2. Express 앱 생성 및 설정
const app = express();
const port = 443;

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// [삭제] 로컬 uploads 폴더를 static으로 제공할 필요가 이제 없습니다.
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

cloudinary.config ({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // 별명으로 변경
  api_key: process.env.CLOUDINARY_API_KEY,       // 별명으로 변경
  api_secret: process.env.CLOUDINARY_API_SECRET  // 별명으로 변경
});

// [수정] Multer 설정을 Cloudinary 스토리지로 교체합니다.
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bebcon-uploads',
    format: 'png',
    public_id: (req, file) => file.originalname.split('.')[0] + '-' + Date.now(),
  },
});

const upload = multer({ storage: storage });

// 3. 페이지 라우팅
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.get('/signup', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'signup.html')); });
app.get('/mypage', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'mypage.html')); });
app.get('/complaints', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'complaints.html')); });
app.get('/schedule', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'schedule.html')); });
app.get('/news', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'news.html')); });
app.get('/write-news', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'write_news.html')); });
app.get('/find-password', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'find-password.html')); });
app.get('/community', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'community.html')); });
app.get('/write-post', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'write-post.html')); });

// [수정] 시정소식 상세 페이지 라우트 (오픈그래프 동적 생성)
app.get('/news/:id', (req, res) => {
    try {
        const newsId = parseInt(req.params.id, 10);
        const newsData = fs.readFileSync(newsFilePath, 'utf8');
        const news = JSON.parse(newsData);
        const article = news.find(a => a.id === newsId);

        if (!article) {
            return res.status(404).sendFile(path.join(__dirname, 'public', '404.html')); // 404.html 페이지가 있다면 보여주기
        }

        const htmlData = fs.readFileSync(path.join(__dirname, 'public', 'article.html'), 'utf8');
        
        const description = article.content.replace(/<[^>]*>?/gm, '').replace(/\r\n|\n/g, ' ').substring(0, 100).replace(/"/g, '&quot;');
        
        const ogTags = `
            <meta property="og:type" content="article">
            <meta property="og:site_name" content="안현특별시 홈페이지 안현소식">
            <meta property="og:title" content="${article.title.replace(/"/g, '&quot;')}">
            <meta property="og:description" content="${description}...">
            <meta property="og:image" content="https://bebcon.kr/images/og-image.png">
            <meta property="og:url" content="https://bebcon.kr/news/${article.id}">
        `;

        const finalHtml = htmlData.replace('</head>', `${ogTags}</head>`);
        res.send(finalHtml);

    } catch (error) {
        console.error('뉴스 페이지 처리 중 오류:', error);
        res.status(500).send('페이지를 불러오는 중 오류가 발생했습니다.');
    }
});

// [수정] 커뮤니티 상세 페이지 라우트 (오픈그래프 동적 생성)
app.get('/post/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id, 10);
        const postsData = fs.readFileSync(postsFilePath, 'utf8');
        const posts = JSON.parse(postsData);
        const post = posts.find(p => p.id === postId);

        if (!post) {
            return res.status(404).sendFile(path.join(__dirname, 'public', '404.html')); // 404.html 페이지가 있다면 보여주기
        }

        const htmlData = fs.readFileSync(path.join(__dirname, 'public', 'post-detail.html'), 'utf8');
        
        const description = post.content.replace(/\r\n|\n/g, ' ').substring(0, 100).replace(/"/g, '&quot;');
        const imageUrl = post.image ? `https://bebcon.kr${post.image}` : 'https://bebcon.kr/images/og-image.png';

        const ogTags = `
            <meta property="og:type" content="article">
            <meta property="og:site_name" content="안현특별시 홈페이지 커뮤니티">
            <meta property="og:title" content="${post.title.replace(/"/g, '&quot;')}">
            <meta property="og:description" content="${description}...">
            <meta property="og:image" content="${imageUrl}">
            <meta property="og:url" content="https://bebcon.kr/post/${post.id}">
        `;

        const finalHtml = htmlData.replace('</head>', `${ogTags}</head>`);
        res.send(finalHtml);

    } catch (error) {
        console.error('게시물 페이지 처리 중 오류:', error);
        res.status(500).send('페이지를 불러오는 중 오류가 발생했습니다.');
    }
});

// [수정] 게시물 상세 페이지 라우트 (오픈그래프 동적 생성)

app.get('/post/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);

    // 1. 데이터 파일(posts.json)을 읽습니다.
    readJsonFile(postsFilePath, (err, posts) => {
        if (err) {
            console.error(err);
            return res.status(500).send('서버 오류가 발생했습니다.');
        }
        
        const post = posts.find(p => p.id === postId);

        if (!post) {
            return res.status(404).send('게시물을 찾을 수 없습니다.');
        }
        
        // 2. HTML 템플릿 파일(post-detail.html)을 읽습니다.
        fs.readFile(path.join(__dirname, 'public', 'post-detail.html'), 'utf8', (fileErr, htmlData) => {
            if (fileErr) {
                console.error(fileErr);
                return res.status(500).send('서버 오류가 발생했습니다.');
            }

            // 3. 현재 게시물 정보로 오픈그래프 메타 태그를 생성합니다.
            const ogTags = `
                <meta property="og:type" content="article">
                <meta property="og:site_name" content="안현특별시 커뮤니티">
                <meta property="og:title" content="${post.title}">
                <meta property="og:description" content="${post.content.substring(0, 100).replace(/"/g, '&quot;')}...">
                <meta property="og:image" content="${post.image ? `https://bebcon.kr${post.image}` : 'https://bebcon.kr/images/og-default.png'}">
                <meta property="og:url" content="https://bebcon.kr/post/${post.id}">
            `;

            // 4. HTML의 </head> 태그 앞에 위에서 만든 오픈그래프 태그를 삽입합니다.
            const finalHtml = htmlData.replace('</head>', `${ogTags}</head>`);
            
            // 5. 동적으로 완성된 HTML을 사용자에게 보냅니다.
            res.send(finalHtml);
        });
    });
});


// --- API 로직들 ---
const complaintsFilePath = path.join(__dirname, 'complaints.json');
const usersFilePath = path.join(__dirname, 'users.json');
const schedulesFilePath = path.join(__dirname, 'schedules.json');
const newsFilePath = path.join(__dirname, 'news.json');
const postsFilePath = path.join(__dirname, 'posts.json');
let tempUsers = {};

function readJsonFile(filePath, callback) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') return callback(null, []);
            return callback(err);
        }
        try {
            callback(null, JSON.parse(data));
        } catch (parseErr) {
            callback(parseErr);
        }
    });
}

function writeJsonFile(filePath, data, callback) {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), callback);
}

// [커뮤니티 API]
app.get('/api/posts', (req, res) => {
    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '오류' });
        res.json(posts.sort((a, b) => b.createdAt - a.createdAt));
    });
});

app.get('/api/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '오류' });
        const post = posts.find(p => p.id === postId);
        if (post) {
            // [수정] 프론트엔드에 voters 정보를 보내지 않도록 복사해서 전송
            const { voters, ...postToSend } = post;
            res.json(postToSend);
        } else {
            res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
        }
    });
});

app.post('/api/posts', upload.single('image'), (req, res) => {
    const { title, content, username, realName } = req.body;
    if (!username || !realName) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!title || !content) return res.status(400).json({ message: '제목과 내용 모두 입력해 주세요.' });

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '오류' });
        const newPost = {
            id: Date.now(),
            title,
            content,
            author: username,
            realName,
            createdAt: Date.now(),
            image: req.file ? `/uploads/${req.file.filename}` : null,
            comments: [],
            likes: 0,
            dislikes: 0,
            voters: [] // voters 필드 추가
        };
        posts.push(newPost);
        writeJsonFile(postsFilePath, posts, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: '오류' });
            res.status(201).json(newPost);
        });
    });
});

app.get('/api/my-posts', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });
    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '오류' });
        const myPosts = posts.filter(p => p.author === username);
        res.json(myPosts.sort((a, b) => b.createdAt - a.createdAt));
    });
});

app.delete('/api/posts/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const { username } = req.body;
    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '오류' });
        
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return res.status(404).json({ message: '삭제할 게시물을 찾지 못했습니다.' });
        
        const postToDelete = posts[postIndex];
        if (postToDelete.author !== username && username !== 'admin') {
            return res.status(403).json({ message: '삭제 권한이 없습니다.' });
        }
        
        // [수정] 로컬 파일 삭제(fs.unlink) 대신 Cloudinary에서 이미지 삭제하는 로직으로 변경
        if (postToDelete.image) {
            // 1. 이미지 URL에서 public_id를 추출합니다.
            // 예: ".../bebcon-uploads/filename-12345.png" -> "bebcon-uploads/filename-12345"
            const publicId = postToDelete.image.split('/').slice(-2).join('/').split('.')[0];
            
            // 2. Cloudinary에 삭제 요청을 보냅니다.
            cloudinary.uploader.destroy(publicId, (error, result) => {
                if (error) {
                    console.error("Cloudinary 이미지 삭제 오류:", error);
                } else {
                    console.log("Cloudinary 이미지 삭제 성공:", result);
                }
            });
        }
        
        const updatedPosts = posts.filter(p => p.id !== postId);
        writeJsonFile(postsFilePath, updatedPosts, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: '오류' });
            res.status(200).json({ message: '게시물이 성공적으로 삭제되었습니다.' });
        });
    });
});

app.post('/api/posts/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const { username, realName, content } = req.body;

    if (!username || !realName) return res.status(401).json({ message: '댓글을 작성하려면 로그인이 필요합니다.' });
    if (!content) return res.status(400).json({ message: '댓글 내용을 입력해주세요.' });

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '오류가 발생했습니다.' });
        
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

        const newComment = {
            id: Date.now(),
            author: username,
            realName,
            content,
            createdAt: Date.now(),
            updatedAt: null
        };

        if (!posts[postIndex].comments) {
            posts[postIndex].comments = [];
        }
        posts[postIndex].comments.push(newComment);

        writeJsonFile(postsFilePath, posts, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: '댓글 저장 중 오류가 발생했습니다.' });
            res.status(201).json(newComment);
        });
    });
});

// [수정] 커뮤니티 게시물 추천/비추천 API (voters 로직 추가)
app.post('/api/posts/:id/vote', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    const { voteType, username } = req.body;

    if (!username) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '서버에서 파일을 읽는 중 오류가 발생했습니다.' });

        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) {
            return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
        }

        const post = posts[postIndex];
        
        // voters 필드가 없으면 초기화
        if (!post.voters) {
            post.voters = [];
        }
        
        // 이미 투표했는지 확인
        if (post.voters.includes(username)) {
            return res.status(409).json({ message: '이미 이 게시물에 투표하셨습니다.' });
        }

        // 투표 유형에 따라 수치 증가
        if (voteType === 'like') {
            post.likes++;
        } else if (voteType === 'dislike') {
            post.dislikes++;
        } else {
            return res.status(400).json({ message: '잘못된 투표 타입입니다.' });
        }
        
        // 투표자 기록
        post.voters.push(username);

        writeJsonFile(postsFilePath, posts, (writeErr) => {
            if (writeErr) {
                return res.status(500).json({ message: '투표 결과를 저장하는 중 오류가 발생했습니다.' });
            }
            // 성공 시 업데이트된 추천/비추천 수 반환
            res.status(200).json({
                likes: post.likes,
                dislikes: post.dislikes
            });
        });
    });
});

app.delete('/api/posts/:postId/comments/:commentId', (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    const commentId = parseInt(req.params.commentId, 10);
    const { username } = req.body;

    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '서버 오류' });
        
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

        const post = posts[postIndex];
        const commentIndex = post.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });

        if (post.comments[commentIndex].author !== username) {
            return res.status(403).json({ message: '삭제 권한이 없습니다.' });
        }

        post.comments.splice(commentIndex, 1);

        writeJsonFile(postsFilePath, posts, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: '서버 오류' });
            res.status(200).json({ message: '댓글이 성공적으로 삭제되었습니다.' });
        });
    });
});

app.patch('/api/posts/:postId/comments/:commentId', (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    const commentId = parseInt(req.params.commentId, 10);
    const { username, content } = req.body;

    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!content) return res.status(400).json({ message: '수정할 내용이 없습니다.' });

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '서버 오류' });

        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
        
        const post = posts[postIndex];
        const commentIndex = post.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });

        if (post.comments[commentIndex].author !== username) {
            return res.status(403).json({ message: '수정 권한이 없습니다.' });
        }

        post.comments[commentIndex].content = content;
        post.comments[commentIndex].updatedAt = Date.now(); // 수정 시간 기록

        writeJsonFile(postsFilePath, posts, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: '서버 오류' });
            res.status(200).json(post.comments[commentIndex]);
        });
    });
});

// [추가] 댓글 삭제 API
app.delete('/api/posts/:postId/comments/:commentId', (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    const commentId = parseInt(req.params.commentId, 10);
    const { username } = req.body;

    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '서버 오류' });
        
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

        const post = posts[postIndex];
        const commentIndex = post.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });

        if (post.comments[commentIndex].author !== username) {
            return res.status(403).json({ message: '삭제 권한이 없습니다.' });
        }

        post.comments.splice(commentIndex, 1);

        writeJsonFile(postsFilePath, posts, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: '서버 오류' });
            res.status(200).json({ message: '댓글이 성공적으로 삭제되었습니다.' });
        });
    });
});

// [추가] 댓글 수정 API
app.patch('/api/posts/:postId/comments/:commentId', (req, res) => {
    const postId = parseInt(req.params.postId, 10);
    const commentId = parseInt(req.params.commentId, 10);
    const { username, content } = req.body;

    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });
    if (!content) return res.status(400).json({ message: '수정할 내용이 없습니다.' });

    readJsonFile(postsFilePath, (err, posts) => {
        if (err) return res.status(500).json({ message: '서버 오류' });

        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
        
        const post = posts[postIndex];
        const commentIndex = post.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });

        if (post.comments[commentIndex].author !== username) {
            return res.status(403).json({ message: '수정 권한이 없습니다.' });
        }

        post.comments[commentIndex].content = content;
        post.comments[commentIndex].updatedAt = Date.now(); // 수정 시간 기록

        writeJsonFile(postsFilePath, posts, (writeErr) => {
            if (writeErr) return res.status(500).json({ message: '서버 오류' });
            res.status(200).json(post.comments[commentIndex]);
        });
    });
});


// [의견] API]
app.get('/api/complaints', (req, res) => {
    readJsonFile(complaintsFilePath, (err, data) => {
        if (err) return res.status(500).send('오류');
        res.json(data);
    });
});
app.post('/api/complaints', (req, res) => {
    const { author, username, title, content } = req.body;
    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });
    const newComplaint = { id: Date.now(), author, username, title, content, date: new Date().toLocaleString() };
    readJsonFile(complaintsFilePath, (err, complaints) => {
        if (err) return res.status(500).send('오류');
        complaints.push(newComplaint);
        writeJsonFile(complaintsFilePath, complaints, (err) => {
            if (err) return res.status(500).send('오류');
            res.status(201).json(newComplaint);
        });
    });
});
app.get('/api/my-complaints', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: '사용자 정보가 없습니다.' });
    readJsonFile(complaintsFilePath, (err, allComplaints) => {
        if (err) return res.status(500).send('오류');
        const myComplaints = allComplaints.filter(c => c.username === username);
        res.json(myComplaints);
    });
});
app.delete('/api/complaints/:id', (req, res) => {
    const complaintId = parseInt(req.params.id, 10);
    const { username } = req.body;
    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });
    readJsonFile(complaintsFilePath, (err, complaints) => {
        if (err) return res.status(500).send('오류');
        const complaintToDelete = complaints.find(c => c.id === complaintId);
        if (!complaintToDelete) return res.status(404).json({ message: '삭제할 글을 찾지 못했습니다.' });
        if (complaintToDelete.username !== username) return res.status(403).json({ message: '삭제 권한이 없습니다.' });
        const updatedComplaints = complaints.filter(c => c.id !== complaintId);
        writeJsonFile(complaintsFilePath, updatedComplaints, (err) => {
            if (err) return res.status(500).send('오류');
            res.status(200).json({ message: '삭제되었습니다.' });
        });
    });
});

// [유저 API]
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: 'anhyeon.gov@gmail.com', pass: 'zciv lcsi pnti jkye' } });
app.post('/api/signup', (req, res) => {
    const { realName, dob, email, username, password } = req.body;
    if (!/^[a-z]{1,10}$/.test(username)) return res.status(400).json({ message: '아이디는 10자 이하의 영어 소문자여야 합니다.' });
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(password)) return res.status(400).json({ message: '비밀번호는 15자 이하의 영문 대/소문자, 숫자, 기호를 모두 포함해야 합니다.' });
    readJsonFile(usersFilePath, (err, users) => {
        if (err) return res.status(500).json({ message: '오류' });
        if (users.find(u => u.username === username) || users.find(u => u.email === email)) {
            return res.status(409).json({ message: '이미 사용 중인 아이디 또는 이메일입니다.' });
        }
        const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
        tempUsers[email] = { ...req.body, verificationCode };
        transporter.sendMail({ from: 'anhyeon.gov@gmail.com', to: email, subject: '[안현특별시] 회원가입 이메일 인증번호입니다.', html: `<h2>안현특별시 가입을 환영합니다!</h2><p>인증번호 6자리를 입력해주세요: <strong>${verificationCode}</strong></p>` }, (error) => {
            if (error) return res.status(500).json({ message: '인증메일 발송에 실패했습니다.' });
            res.status(200).json({ message: '인증번호가 이메일로 발송되었습니다.' });
        });
    });
});

app.post('/api/verify', (req, res) => {
    const { email, code } = req.body;
    const tempUser = tempUsers[email];
    if (!tempUser || tempUser.verificationCode !== code) return res.status(400).json({ message: '인증번호가 올바르지 않습니다.' });
    
    bcrypt.hash(tempUser.password, 10, (hashErr, hashedPassword) => {
        if(hashErr) return res.status(500).json({ message: '오류가 발생했습니다.' });
        const newUser = { id: Date.now(), realName: tempUser.realName, dob: tempUser.dob, email: tempUser.email, username: tempUser.username, password: hashedPassword, role: 'user' };
        readJsonFile(usersFilePath, (readErr, users) => {
            if (readErr) return res.status(500).json({ message: '오류가 발생했습니다.' });
            users.push(newUser);
            writeJsonFile(usersFilePath, users, (writeErr) => {
                if (writeErr) return res.status(500).json({ message: '오류가 발생했습니다.' });
                delete tempUsers[email];
                res.status(201).json({ message: '회원가입이 성공적으로 완료되었습니다.' });
            });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    readJsonFile(usersFilePath, (err, users) => {
        if (err) return res.status(500).json({ message: '오류' });
        const user = users.find(u => u.username === username);
        if (!user) return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        
        bcrypt.compare(password, user.password, (bcryptErr, isMatch) => {
            if(bcryptErr) return res.status(500).json({ message: '오류' });
            if (isMatch) res.status(200).json({ message: `${user.realName} 님, 로그인을 환영합니다.`, username: user.username, realName: user.realName });
            else res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        });
    });
});

app.post('/api/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(newPassword)) return res.status(400).json({ message: '새 비밀번호 규정을 확인해주세요.' });
    readJsonFile(usersFilePath, (err, users) => {
        if (err) return res.status(500).json({ message: '오류' });
        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex === -1) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        
        bcrypt.compare(currentPassword, users[userIndex].password, (bcryptErr, isMatch) => {
            if(bcryptErr) return res.status(500).json({ message: '오류' });
            if (!isMatch) return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
            
            bcrypt.hash(newPassword, 10, (hashErr, hashedNewPassword) => {
                if(hashErr) return res.status(500).json({ message: '오류' });
                users[userIndex].password = hashedNewPassword;
                writeJsonFile(usersFilePath, users, (writeErr) => {
                    if (writeErr) return res.status(500).json({ message: '오류' });
                    res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
                });
            });
        });
    });
});

app.post('/api/delete-account', (req, res) => {
    const { username, password } = req.body;
    readJsonFile(usersFilePath, (err, users) => {
        if (err) return res.status(500).json({ message: '오류' });
        const user = users.find(u => u.username === username);
        if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

        bcrypt.compare(password, user.password, (bcryptErr, isMatch) => {
            if(bcryptErr) return res.status(500).json({ message: '오류' });
            if (!isMatch) return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });

            const updatedUsers = users.filter(u => u.username !== username);
            writeJsonFile(usersFilePath, updatedUsers, (writeErr) => {
                if (writeErr) return res.status(500).json({ message: '오류' });
                res.status(200).json({ message: '회원 탈퇴가 완료되었습니다.' });
            });
        });
    });
});


// [비밀번호 찾기 API]
app.post('/api/request-password-reset', (req, res) => {
    const { email, username } = req.body;
    if (!email || !username) return res.status(400).json({ message: '이메일과 아이디를 모두 입력해주세요.' });
    readJsonFile(usersFilePath, (err, users) => {
        if (err) return res.status(500).json({ message: '오류' });
        const user = users.find(u => u.email === email && u.username === username);
        if (!user) return res.status(404).json({ message: '일치하는 사용자 정보가 없습니다.' });
        
        const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
        tempUsers[email] = { ...tempUsers[email], username: user.username, resetCode: verificationCode, resetTimestamp: Date.now() };
        
        transporter.sendMail({
            from: 'anhyeon.gov@gmail.com', to: email,
            subject: '[안현특별시] 비밀번호 재설정 인증번호입니다.',
            html: `<h2>비밀번호 재설정 인증번호</h2><p>요청하신 인증번호 6자리를 입력해주세요: <strong>${verificationCode}</strong></p><p>이 인증번호는 10분간 유효합니다.</p>`
        }, (error) => {
            if (error) { console.error('인증메일 발송 실패:', error); return res.status(500).json({ message: '인증메일 발송에 실패했습니다.' }); }
            res.status(200).json({ message: '인증번호가 이메일로 발송되었습니다.' });
        });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{1,15}$/.test(newPassword)) {
        return res.status(400).json({ message: '비밀번호는 15자 이하의 영문 대/소문자, 숫자, 기호를 모두 포함해야 합니다.' });
    }
    const tempUserData = tempUsers[email];
    const tenMinutes = 10 * 60 * 1000;
    if (!tempUserData || tempUserData.resetCode !== code || (Date.now() - tempUserData.resetTimestamp > tenMinutes)) {
        return res.status(400).json({ message: '인증번호가 올바르지 않거나 만료되었습니다. 다시 시도해주세요.' });
    }

    bcrypt.hash(newPassword, 10, (hashErr, hashedPassword) => {
        if(hashErr) return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        readJsonFile(usersFilePath, (readErr, users) => {
            if(readErr) return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
            const userIndex = users.findIndex(u => u.username === tempUserData.username);
            if (userIndex === -1) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

            users[userIndex].password = hashedPassword;
            writeJsonFile(usersFilePath, users, (writeErr) => {
                if(writeErr) return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
                delete tempUsers[email].resetCode;
                delete tempUsers[email].resetTimestamp;
                res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
            });
        });
    });
});


// [일정 API]
app.get('/api/schedules', (req, res) => {
    readJsonFile(schedulesFilePath, (err, schedules) => {
        if (err) return res.status(500).send('오류');
        const calendarEvents = schedules.map(schedule => ({ title: schedule.content, start: schedule.date }));
        res.json(calendarEvents);
    });
});
app.post('/api/schedules', (req, res) => {
    const { date, content, username } = req.body;
    if (username !== 'admin') return res.status(403).json({ message: '일정을 등록할 권한이 없습니다.' });
    const newSchedule = { id: Date.now(), date, content };
    readJsonFile(schedulesFilePath, (err, schedules) => {
        if (err) return res.status(500).send('오류');
        schedules.push(newSchedule);
        schedules.sort((a, b) => new Date(a.date) - new Date(b.date));
        writeJsonFile(schedulesFilePath, schedules, (err) => {
            if (err) return res.status(500).send('오류');
            res.status(201).json(newSchedule);
        });
    });
});

// [시정소식 API]
// [수정] 카테고리 필터링 및 검색 기능 추가
app.get('/api/news', (req, res) => {
    const { category, search } = req.query; // category와 search 쿼리 파라미터 받기
    readJsonFile(newsFilePath, (err, data) => {
        if (err) return res.status(500).send('오류');
        
        let filteredNews = data;

        // 카테고리 필터링
        if (category && category !== '전체') {
            filteredNews = filteredNews.filter(article => article.category === category);
        }

        // 검색어 필터링 (제목 또는 내용)
        if (search) {
            const searchTerm = search.toLowerCase();
            filteredNews = filteredNews.filter(article => 
                article.title.toLowerCase().includes(searchTerm) || 
                article.content.toLowerCase().includes(searchTerm)
            );
        }

        res.json(filteredNews.sort((a, b) => b.createdAt - a.createdAt));
    });
});

app.get('/api/news/:id', (req, res) => {
    const newsId = parseInt(req.params.id, 10);
    readJsonFile(newsFilePath, (err, news) => {
        if (err) return res.status(500).send('오류');
        const article = news.find(a => a.id === newsId);
        if (article) res.json(article);
        else res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
    });
});

// [수정] 카테고리 추가 및 이미지 URL 자동 변환 기능
app.post('/api/news', (req, res) => {
    let { title, content, username, category } = req.body; // category 추가

    if (username !== 'admin') {
        return res.status(403).json({ message: '게시물을 등록할 권한이 없습니다.' });
    }
    if (!category || category === 'none') {
        return res.status(400).json({ message: '카테고리를 선택해주세요.' });
    }

    // [추가] 이미지 자동 변환 로직: ![URL] 형식을 <img> 태그로 변환
    const imageRegex = /!\[(.*?)\]\((https?:\/\/\S+)\)/g; // 표준 마크다운 이미지 형식
    const simpleImageRegex = /!\[(https?:\/\/\S+)\]/g; // ![URL] 형식
    
    // 두 가지 형식을 모두 처리하여 <img> 태그로 변환
    let processedContent = content.replace(imageRegex, '<br /><img src="$2" alt="$1" style="max-width: 80%; border-radius: 10px;"/><br />');
    processedContent = processedContent.replace(simpleImageRegex, '<br /><img src="$1" alt="Image" style="max-width: 80%; border-radius: 10px;"/><br />');


    const newArticle = {
        id: Date.now(),
        title,
        content: processedContent, // 변환된 콘텐츠 저장
        category, // 카테고리 필드 추가
        author: '안현특별시청 뉴미디어팀',
        username,
        createdAt: Date.now(),
        likes: 0,
        dislikes: 0,
        voters: []
    };

    readJsonFile(newsFilePath, (err, news) => {
        if (err) return res.status(500).send('오류');
        news.push(newArticle);
        writeJsonFile(newsFilePath, news, (err) => {
            if (err) return res.status(500).send('오류');
            res.status(201).json(newArticle);
        });
    });
});
app.post('/api/news/:id/vote', (req, res) => {
    const newsId = parseInt(req.params.id, 10);
    const { voteType, username } = req.body;
    if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });
    readJsonFile(newsFilePath, (err, news) => {
        if (err) return res.status(500).send('오류');
        const articleIndex = news.findIndex(a => a.id === newsId);
        if (articleIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
        const article = news[articleIndex];
        if (!article.voters) article.voters = [];
        if (article.voters.includes(username)) return res.status(409).json({ message: '이미 투표했습니다.' });
        if (voteType === 'like') article.likes++;
        else if (voteType === 'dislike') article.dislikes++;
        article.voters.push(username);
        writeJsonFile(newsFilePath, news, (err) => {
            if (err) return res.status(500).send('오류');
            res.status(200).json(article);
        });
    });
});
app.get('/api/my-news', (req, res) => {
    const { username } = req.query;
    if (username !== 'admin') return res.status(403).json({ message: '권한이 없습니다.' });
    readJsonFile(newsFilePath, (err, allNews) => {
        if (err) return res.status(500).send('오류');
        const myNews = allNews.filter(a => a.username === username);
        res.json(myNews);
    });
});
app.delete('/api/news/:id', (req, res) => {
    const articleId = parseInt(req.params.id, 10);
    const { username } = req.body;
    if (username !== 'admin') return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    readJsonFile(newsFilePath, (err, news) => {
        if (err) return res.status(500).send('오류');
        const updatedNews = news.filter(a => a.id !== articleId);
        if (news.length === updatedNews.length) return res.status(404).json({ message: '삭제할 게시물을 찾을 수 없습니다.' });
        writeJsonFile(newsFilePath, updatedNews, (err) => {
            if (err) return res.status(500).send('오류');
            res.status(200).json({ message: '게시물이 성공적으로 삭제되었습니다.' });
        });
    });
});

// 5. 서버 시작
const httpsOptions = {
    key: fs.readFileSync(path.join('C:', 'Certbot', 'live', 'bebcon.kr', 'privkey.pem')),
    cert: fs.readFileSync(path.join('C:', 'Certbot', 'live', 'bebcon.kr', 'fullchain.pem'))
};
https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`서버가 실행되었습니다. https://localhost:${port}`);
});