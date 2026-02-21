const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Configure multer for local upload (fallback)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
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

async function getFeed(req, res) {
  try {
    const currentUser = req.user;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get posts from followed users
    const result = await db.query(
      `SELECT DISTINCT p.id, p.caption, p.image, p.user_id, p.created_at,
              u.id as user_id, u.name, u.username, u.image as user_image,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = $1) > 0 as is_liked,
              (SELECT COUNT(*) FROM saves WHERE post_id = p.id AND user_id = $1) > 0 as is_saved
       FROM posts p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN follows f ON f.following_id = p.user_id AND f.follower_id = $1
       WHERE f.follower_id = $1 OR p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [currentUser.id, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM posts p
       LEFT JOIN follows f ON f.following_id = p.user_id AND f.follower_id = $1
       WHERE f.follower_id = $1 OR p.user_id = $1`,
      [currentUser.id]
    );

    res.json({
      posts: result.rows.map((p) => ({
        id: p.id,
        caption: p.caption,
        image: p.image,
        userId: p.user_id,
        user: {
          id: p.user_id,
          name: p.name,
          username: p.username,
          image: p.user_image,
        },
        likeCount: parseInt(p.like_count),
        commentCount: parseInt(p.comment_count),
        isLiked: p.is_liked,
        isSaved: p.is_saved,
        createdAt: p.created_at,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createPost(req, res) {
  try {
    const currentUser = req.user;

    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const { caption } = req.body;
    let imageUrl = `/uploads/${req.file.filename}`;

    // Upload to Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'sociality',
          resource_type: 'image',
        });
        imageUrl = uploadResult.secure_url;
      } catch (cloudError) {
        console.error('Cloudinary upload error:', cloudError);
        // Fall back to local upload
      }
    }

    const result = await db.query(
      'INSERT INTO posts (user_id, image, caption) VALUES ($1, $2, $3) RETURNING *',
      [currentUser.id, imageUrl, caption || null]
    );

    const post = result.rows[0];

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        id: post.id,
        caption: post.caption,
        image: post.image,
        userId: post.user_id,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          image: currentUser.image,
        },
        likeCount: 0,
        commentCount: 0,
        isLiked: false,
        isSaved: false,
        createdAt: post.created_at,
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPostDetail(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const result = await db.query(
      `SELECT p.id, p.caption, p.image, p.user_id, p.created_at,
              u.id as user_id, u.name, u.username, u.image as user_image,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = $2) > 0 as is_liked,
              (SELECT COUNT(*) FROM saves WHERE post_id = p.id AND user_id = $2) > 0 as is_saved
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id, currentUser.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const p = result.rows[0];

    res.json({
      id: p.id,
      caption: p.caption,
      image: p.image,
      userId: p.user_id,
      user: {
        id: p.user_id,
        name: p.name,
        username: p.username,
        image: p.user_image,
      },
      likeCount: parseInt(p.like_count),
      commentCount: parseInt(p.comment_count),
      isLiked: p.is_liked,
      isSaved: p.is_saved,
      createdAt: p.created_at,
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deletePost(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if post exists and belongs to current user
    const postResult = await db.query(
      'SELECT user_id FROM posts WHERE id = $1',
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (postResult.rows[0].user_id !== currentUser.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Delete post (cascades to likes, comments, saves)
    await db.query('DELETE FROM posts WHERE id = $1', [id]);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function likePost(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if post exists
    const postResult = await db.query('SELECT id FROM posts WHERE id = $1', [
      id,
    ]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if already liked
    const existingLike = await db.query(
      'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
      [currentUser.id, id]
    );

    if (existingLike.rows.length > 0) {
      return res.status(400).json({ message: 'Already liked' });
    }

    // Create like
    await db.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [
      currentUser.id,
      id,
    ]);

    res.json({ message: 'Liked successfully' });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function unlikePost(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if post exists
    const postResult = await db.query('SELECT id FROM posts WHERE id = $1', [
      id,
    ]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if liked
    const existingLike = await db.query(
      'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
      [currentUser.id, id]
    );

    if (existingLike.rows.length === 0) {
      return res.status(400).json({ message: 'Not liked' });
    }

    // Remove like
    await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [
      currentUser.id,
      id,
    ]);

    res.json({ message: 'Unliked successfully' });
  } catch (error) {
    console.error('Unlike error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getComments(req, res) {
  try {
    const { id } = req.params;

    // Check if post exists
    const postResult = await db.query('SELECT id FROM posts WHERE id = $1', [
      id,
    ]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const result = await db.query(
      `SELECT c.id, c.comment, c.user_id, c.post_id, c.created_at,
              u.id as user_id, u.name, u.username, u.image as user_image
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at DESC`,
      [id]
    );

    res.json({
      comments: result.rows.map((c) => ({
        id: c.id,
        comment: c.comment,
        userId: c.user_id,
        postId: c.post_id,
        user: {
          id: c.user_id,
          name: c.name,
          username: c.username,
          image: c.user_image,
        },
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function addComment(req, res) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const currentUser = req.user;

    if (!comment) {
      return res.status(400).json({ message: 'Comment is required' });
    }

    // Check if post exists
    const postResult = await db.query('SELECT id FROM posts WHERE id = $1', [
      id,
    ]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const result = await db.query(
      'INSERT INTO comments (user_id, post_id, comment) VALUES ($1, $2, $3) RETURNING *',
      [currentUser.id, id, comment]
    );

    const newComment = result.rows[0];

    res.status(201).json({
      message: 'Comment added successfully',
      comment: {
        id: newComment.id,
        comment: newComment.comment,
        userId: newComment.user_id,
        postId: newComment.post_id,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          image: currentUser.image,
        },
        createdAt: newComment.created_at,
      },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteComment(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if comment exists
    const commentResult = await db.query(
      'SELECT user_id FROM comments WHERE id = $1',
      [id]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (commentResult.rows[0].user_id !== currentUser.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Delete comment
    await db.query('DELETE FROM comments WHERE id = $1', [id]);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function savePost(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if post exists
    const postResult = await db.query('SELECT id FROM posts WHERE id = $1', [
      id,
    ]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if already saved
    const existingSave = await db.query(
      'SELECT id FROM saves WHERE user_id = $1 AND post_id = $2',
      [currentUser.id, id]
    );

    if (existingSave.rows.length > 0) {
      return res.status(400).json({ message: 'Already saved' });
    }

    // Create save
    await db.query('INSERT INTO saves (user_id, post_id) VALUES ($1, $2)', [
      currentUser.id,
      id,
    ]);

    res.json({ message: 'Post saved successfully' });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function unsavePost(req, res) {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if post exists
    const postResult = await db.query('SELECT id FROM posts WHERE id = $1', [
      id,
    ]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if saved
    const existingSave = await db.query(
      'SELECT id FROM saves WHERE user_id = $1 AND post_id = $2',
      [currentUser.id, id]
    );

    if (existingSave.rows.length === 0) {
      return res.status(400).json({ message: 'Not saved' });
    }

    // Remove save
    await db.query('DELETE FROM saves WHERE user_id = $1 AND post_id = $2', [
      currentUser.id,
      id,
    ]);

    res.json({ message: 'Post unsaved successfully' });
  } catch (error) {
    console.error('Unsave error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getSavedPosts(req, res) {
  try {
    const currentUser = req.user;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT p.id, p.caption, p.image, p.user_id, p.created_at,
              u.id as user_id, u.name, u.username, u.image as user_image,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
              true as is_saved
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN saves s ON s.post_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [currentUser.id, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM saves WHERE user_id = $1',
      [currentUser.id]
    );

    res.json({
      posts: result.rows.map((p) => ({
        id: p.id,
        caption: p.caption,
        image: p.image,
        userId: p.user_id,
        user: {
          id: p.user_id,
          name: p.name,
          username: p.username,
          image: p.user_image,
        },
        likeCount: parseInt(p.like_count),
        commentCount: parseInt(p.comment_count),
        isLiked: false,
        isSaved: p.is_saved,
        createdAt: p.created_at,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
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
};
