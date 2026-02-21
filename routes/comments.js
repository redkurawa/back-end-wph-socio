const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { deleteComment } = require('../controllers/posts');

const router = express.Router();

// DELETE /api/comments/:id - Delete my comment
router.delete('/:id', authenticateToken, deleteComment);

module.exports = router;
