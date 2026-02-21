const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getPublicProfile,
  searchUsers,
  getUserPosts,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} = require('../controllers/users');

const router = express.Router();

// GET /api/users/search - Search users by name/username
router.get('/search', authenticateToken, searchUsers);

// GET /api/users/:username - Get public profile by username
router.get('/:username', authenticateToken, getPublicProfile);

// GET /api/users/:username/posts - List posts by username (public)
router.get('/:username/posts', authenticateToken, getUserPosts);

// POST /api/users/:username/follow - Follow a user
router.post('/:username/follow', authenticateToken, followUser);

// DELETE /api/users/:username/follow - Unfollow a user
router.delete('/:username/follow', authenticateToken, unfollowUser);

// GET /api/users/:username/followers - Get followers
router.get('/:username/followers', authenticateToken, getFollowers);

// GET /api/users/:username/following - Get following
router.get('/:username/following', authenticateToken, getFollowing);

module.exports = router;
