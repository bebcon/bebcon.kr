const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { readJsonFile, writeJsonFile, postsFilePath, notificationsFilePath } = require('../utils/fileHandler');

// 재귀적으로 댓글을 찾고 부모 배열과 인덱스를 반환하는 헬퍼 함수
function findCommentRecursive(comments, commentId) {
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        if (comment.id === commentId) {
            return { comment, parentArray: comments, index: i };
        }
        if (comment.replies && comment.replies.length > 0) {
            const found = findCommentRecursive(comment.replies, commentId);
            if (found) {
                return found;
            }
        }
    }
    return null;
}


// 이 라우터는 server.js로부터 upload 객체를 주입받아야 합니다.
module.exports = (upload) => {
    // GET /api/posts - 게시글 목록 조회 (검색, 페이지네이션 포함)
    router.get('/', async (req, res) => {
        try {
            const posts = await readJsonFile(postsFilePath);
            const { search, page = 1 } = req.query;
            let filteredPosts = posts;

            if (search) {
                const searchTerm = search.toLowerCase();
                filteredPosts = filteredPosts.filter(post =>
                    (post.title && post.title.toLowerCase().includes(searchTerm)) ||
                    (post.content && post.content.toLowerCase().includes(searchTerm))
                );
            }

            const limit = 12;
            const sortedPosts = filteredPosts.sort((a, b) => b.createdAt - a.createdAt);
            const totalItems = sortedPosts.length;
            const totalPages = Math.ceil(totalItems / limit);
            const paginatedData = sortedPosts.slice((page - 1) * limit, page * limit);

            res.json({
                data: paginatedData,
                totalPages,
                currentPage: parseInt(page, 10)
            });
        } catch (error) {
            console.error('Get Posts Error:', error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // GET /api/posts/my-posts - 내가 작성한 게시글 조회
    router.get('/my-posts', async (req, res) => {
        const { username } = req.query;
        if (!username) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        try {
            const posts = await readJsonFile(postsFilePath);
            const myPosts = posts
                .filter(p => p.author === username)
                .sort((a, b) => b.createdAt - a.createdAt);
            res.json(myPosts);
        } catch (error) {
            console.error('Get My Posts Error:', error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // GET /api/posts/:id - 특정 게시글 상세 조회
    router.get('/:id', async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        try {
            const posts = await readJsonFile(postsFilePath);
            const post = posts.find(p => p.id === postId);
            if (post) {
                // 민감할 수 있는 voters 정보는 클라이언트에 보내지 않음
                const { voters, ...postToSend } = post;
                res.json(postToSend);
            } else {
                res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
            }
        } catch (error) {
            console.error(`Get Post ${postId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // POST /api/posts - 새 게시글 작성 (이미지 업로드 포함)
    router.post('/', upload.single('image'), async (req, res) => {
        const { title, content, username, realName } = req.body;
        if (!username || !realName) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        if (!title || !content) {
            return res.status(400).json({ message: '제목과 내용은 필수입니다.' });
        }

        try {
            const posts = await readJsonFile(postsFilePath);
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
                voters: []
            };
            posts.push(newPost);
            await writeJsonFile(postsFilePath, posts);
            res.status(201).json(newPost);
        } catch (error) {
            res.status(500).json({ message: '게시물 작성 중 오류가 발생했습니다.' });
        }
    });

    // DELETE /api/posts/:id - 게시물 삭제
    router.delete('/:id', async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        const { username } = req.body;
        if (!username) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }

        try {
            const posts = await readJsonFile(postsFilePath);
            const postIndex = posts.findIndex(p => p.id === postId);
            if (postIndex === -1) {
                return res.status(404).json({ message: '삭제할 게시물을 찾지 못했습니다.' });
            }

            const postToDelete = posts[postIndex];
            // 작성자 본인 또는 admin만 삭제 가능
            if (postToDelete.author !== username && username !== 'admin') {
                return res.status(403).json({ message: '삭제 권한이 없습니다.' });
            }

            // 게시글에 이미지가 있으면 서버에서도 삭제
            if (postToDelete.image) {
                try {
                    await fs.unlink(path.join(__dirname, '..', postToDelete.image));
                } catch (unlinkErr) {
                    // 파일이 이미 없어도 에러를 내지 않고 콘솔에만 기록
                    console.error("Image file deletion error (might be already deleted):", unlinkErr);
                }
            }

            const updatedPosts = posts.filter(p => p.id !== postId);
            await writeJsonFile(postsFilePath, updatedPosts);
            res.status(200).json({ message: '게시물이 성공적으로 삭제되었습니다.' });
        } catch (error) {
            console.error(`Delete Post ${postId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // POST /api/posts/:id/vote - 게시글 추천/비추천
    router.post('/:id/vote', async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        const { voteType, username } = req.body;
        if (!username) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        if (voteType !== 'like' && voteType !== 'dislike') {
            return res.status(400).json({ message: '잘못된 투표 타입입니다.' });
        }

        try {
            const posts = await readJsonFile(postsFilePath);
            const postIndex = posts.findIndex(p => p.id === postId);
            if (postIndex === -1) {
                return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });
            }

            const post = posts[postIndex];
            if (!post.voters) post.voters = [];
            if (post.voters.includes(username)) {
                return res.status(409).json({ message: '이미 이 게시물에 투표하셨습니다.' });
            }

            if (voteType === 'like') {
                post.likes = (post.likes || 0) + 1;
                
                // ▼▼▼ [추가] 좋아요 알림 생성 로직 ▼▼▼
                // 본인이 쓴 글이 아닐 경우에만 알림 발송
                if (post.author !== username) {
                    const notifications = await readJsonFile(notificationsFilePath);
                    const newNotification = {
                        id: Date.now(),
                        targetUser: post.author,
                        message: `${username}님이 회원님의 게시물 "${post.title}"을(를) 좋아합니다.`,
                        isRead: false,
                        link: `/post/${postId}`,
                        createdAt: Date.now(),
                        type: 'like',
                        sourceId: postId
                    };
                    notifications.push(newNotification);
                    await writeJsonFile(notificationsFilePath, notifications);
                }
                // ▲▲▲ [추가] 좋아요 알림 생성 로직 ▲▲▲

            } else {
                post.dislikes = (post.dislikes || 0) + 1;
            }
            post.voters.push(username);

            await writeJsonFile(postsFilePath, posts);
            res.status(200).json({ likes: post.likes, dislikes: post.dislikes });
        } catch (error) {
            console.error(`Vote Post ${postId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // POST /api/posts/:id/comments - 댓글 및 대댓글 작성
    router.post('/:id/comments', async (req, res) => {
        const postId = parseInt(req.params.id, 10);
        const { username, realName, content, parentId } = req.body; // parentId 추가
        if (!username || !realName) return res.status(401).json({ message: '댓글을 작성하려면 로그인이 필요합니다.' });
        if (!content) return res.status(400).json({ message: '댓글 내용을 입력해주세요.' });

        try {
            const posts = await readJsonFile(postsFilePath);
            const postIndex = posts.findIndex(p => p.id === postId);
            if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

            const post = posts[postIndex];
            const newComment = {
                id: Date.now(),
                author: username,
                realName,
                content,
                createdAt: Date.now(),
                updatedAt: null,
                replies: [] // 대댓글을 위한 배열 추가
            };

            if (!post.comments) post.comments = [];

            let notificationTargetUser = null;
            let notificationMessage = '';

            if (parentId) {
                // parentId가 있으면 대댓글로 추가
                const parentCommentData = findCommentRecursive(post.comments, parentId);
                if (!parentCommentData) {
                    return res.status(404).json({ message: '상위 댓글을 찾을 수 없습니다.' });
                }
                const parentComment = parentCommentData.comment;
                if (!parentComment.replies) {
                    parentComment.replies = [];
                }
                parentComment.replies.push(newComment);

                // [알림] 대댓글인 경우 원댓글 작성자에게 알림
                if (parentComment.author !== username) {
                    notificationTargetUser = parentComment.author;
                    notificationMessage = `${realName}님이 회원님의 댓글에 답글을 남겼습니다.`;
                }

            } else {
                // parentId가 없으면 최상위 댓글로 추가
                post.comments.push(newComment);

                // [알림] 댓글인 경우 게시글 작성자에게 알림
                if (post.author !== username) {
                    notificationTargetUser = post.author;
                    notificationMessage = `${realName}님이 게시물 "${post.title}"에 댓글을 남겼습니다.`;
                }
            }

            await writeJsonFile(postsFilePath, posts);

            // [수정] 알림 생성 로직 (메타데이터 type, sourceId 추가)
            if (notificationTargetUser) {
                const notifications = await readJsonFile(notificationsFilePath);
                const newNotification = {
                    id: Date.now(),
                    targetUser: notificationTargetUser,
                    message: notificationMessage,
                    isRead: false,
                    link: `/post/${postId}`,
                    createdAt: Date.now(),
                    type: 'comment', // 식별용 타입
                    sourceId: newComment.id // 식별용 ID (댓글 ID)
                };
                notifications.push(newNotification);
                await writeJsonFile(notificationsFilePath, notifications);
            }

            res.status(201).json(newComment);
        } catch (error) {
            console.error(`Add Comment to Post ${postId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // DELETE /api/posts/:postId/comments/:commentId - 댓글 및 대댓글 삭제
    router.delete('/:postId/comments/:commentId', async (req, res) => {
        const postId = parseInt(req.params.postId, 10);
        const commentId = parseInt(req.params.commentId, 10);
        const { username } = req.body;
        if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });

        try {
            const posts = await readJsonFile(postsFilePath);
            const postIndex = posts.findIndex(p => p.id === postId);
            if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

            const post = posts[postIndex];
            const commentData = findCommentRecursive(post.comments, commentId);

            if (!commentData) return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });

            const { comment, parentArray, index } = commentData;

            if (comment.author !== username) {
                return res.status(403).json({ message: '삭제 권한이 없습니다.' });
            }

            // 댓글 삭제
            parentArray.splice(index, 1);
            await writeJsonFile(postsFilePath, posts);

            // ▼▼▼ [추가] 댓글 삭제 시 관련 알림도 삭제 ▼▼▼
            const notifications = await readJsonFile(notificationsFilePath);
            // 해당 댓글(sourceId)로 생성된 알림 제거
            const updatedNotifications = notifications.filter(n => 
                !(n.type === 'comment' && n.sourceId === commentId)
            );
            
            // 변경사항이 있으면 저장
            if (notifications.length !== updatedNotifications.length) {
                await writeJsonFile(notificationsFilePath, updatedNotifications);
            }
            // ▲▲▲ [추가] 댓글 삭제 시 관련 알림도 삭제 ▲▲▲

            res.status(200).json({ message: '댓글이 성공적으로 삭제되었습니다.' });
        } catch (error) {
            console.error(`Delete Comment ${commentId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // PATCH /api/posts/:postId/comments/:commentId - 댓글 및 대댓글 수정
    router.patch('/:postId/comments/:commentId', async (req, res) => {
        const postId = parseInt(req.params.postId, 10);
        const commentId = parseInt(req.params.commentId, 10);
        const { username, content } = req.body;
        if (!username) return res.status(401).json({ message: '로그인이 필요합니다.' });
        if (!content) return res.status(400).json({ message: '수정할 내용이 없습니다.' });

        try {
            const posts = await readJsonFile(postsFilePath);
            const postIndex = posts.findIndex(p => p.id === postId);
            if (postIndex === -1) return res.status(404).json({ message: '게시물을 찾을 수 없습니다.' });

            const post = posts[postIndex];
            const commentData = findCommentRecursive(post.comments, commentId);

            if (!commentData) return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' });
            
            const { comment } = commentData;

            if (comment.author !== username) {
                return res.status(403).json({ message: '수정 권한이 없습니다.' });
            }

            comment.content = content;
            comment.updatedAt = Date.now();
            
            await writeJsonFile(postsFilePath, posts);
            res.status(200).json(comment);
        } catch (error) {
            console.error(`Edit Comment ${commentId} Error:`, error);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });


    return router;
};