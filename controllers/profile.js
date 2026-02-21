const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../models/db');

// Configure multer for profile image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WEBP) are allowed'));
    }
  },
});

async function getMyProfile(req, res) {
  try {
    const currentUser = req.user;

    // Get follower and following counts
    const followerResult = await db.query(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = $1',
      [currentUser.id]
    );
    const followingResult = await db.query(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
      [currentUser.id]
    );

    // Get post count
    const postResult = await db.query(
      'SELECT COUNT(*) as count FROM posts WHERE user_id = $1',
      [currentUser.id]
    );

    res.json({
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username,
      email: currentUser.email,
      phone: currentUser.phone,
      bio: currentUser.bio,
      image: currentUser.image,
      followerCount: parseInt(followerResult.rows[0].count),
      followingCount: parseInt(followingResult.rows[0].count),
      postCount: parseInt(postResult.rows[0].count),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateMyProfile(req, res) {
  try {
    const currentUser = req.user;
    const { name, bio, phone } = req.body;

    let imagePath = currentUser.image;

    // Handle image upload
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    }

    // Update user
    const result = await db.query(
      'UPDATE users SET name = COALESCE($1, name), bio = COALESCE($2, bio), phone = COALESCE($3, phone), image = COALESCE($4, image) WHERE id = $5 RETURNING id, name, username, email, phone, bio, image',
      [
        name || null,
        bio !== undefined ? bio : null,
        phone !== undefined ? phone : null,
        imagePath,
        currentUser.id,
      ]
    );

    const user = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        image: user.image,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function changePassword(req, res) {
  try {
    const currentUser = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Old password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: 'New password must be at least 6 characters' });
    }

    // Get current password
    const userResult = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [currentUser.id]
    );

    // Verify old password
    const isValidPassword = await bcrypt.compare(
      oldPassword,
      userResult.rows[0].password
    );
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Old password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [
      hashedPassword,
      currentUser.id,
    ]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  upload,
  getMyProfile,
  updateMyProfile,
  changePassword,
};
