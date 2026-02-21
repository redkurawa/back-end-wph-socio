const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  upload,
  getMyProfile,
  updateMyProfile,
  changePassword,
} = require('../controllers/profile');

const router = express.Router();

// GET /api/me - Get my profile
router.get('/', authenticateToken, getMyProfile);

// PUT /api/me - Update my profile
router.put('/', authenticateToken, upload.single('image'), updateMyProfile);

// PUT /api/me/password - Change password
router.put('/password', authenticateToken, changePassword);

// GET /api/me/saved - Get my saved posts
router.get(
  '/saved',
  authenticateToken,
  require('../controllers/posts').getSavedPosts
);

module.exports = router;
