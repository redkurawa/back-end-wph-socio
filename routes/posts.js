const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  upload,
  getFeed,
  createPost,
  getPostDetail,
  deletePost,
  likePost,
  unlikePost,
  getComments,
  addComment,
  deleteComment,
  savePost,
  unsavePost,
  getSavedPosts,
} = require('../controllers/posts');

const router = express.Router();

// GET /api/posts - Get feed (posts from followed users)
router.get('/', authenticateToken, getFeed);

// POST /api/posts - Create a post (upload image + caption)
router.post('/', authenticateToken, upload.single('image'), createPost);

// POST /api/posts/:id/like - Like a post (MUST be before /:id)
router.post('/:id/like', authenticateToken, likePost);

// DELETE /api/posts/:id/like - Unlike a post
router.delete('/:id/like', authenticateToken, unlikePost);

// POST /api/posts/:id/save - Save a post (MUST be before /:id)
router.post('/:id/save', authenticateToken, savePost);

// DELETE /api/posts/:id/save - Unsave a post
router.delete('/:id/save', authenticateToken, unsavePost);

// GET /api/posts/:id/comments - Get comments (MUST be before /:id)
router.get('/:id/comments', authenticateToken, getComments);

// POST /api/posts/:id/comments - Add comment
router.post('/:id/comments', authenticateToken, addComment);

// GET /api/posts/:id - Get post detail
router.get('/:id', authenticateToken, getPostDetail);

// DELETE /api/posts/:id - Delete my own post
router.delete('/:id', authenticateToken, deletePost);

module.exports = router;
