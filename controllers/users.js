const db = require('../models/db');

async function getPublicProfile(req, res) {
  try {
    const { username } = req.params;

    // Find user by username
    const userResult = await db.query(
      'SELECT id, name, username, bio, image FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get follower and following counts
    const followerResult = await db.query(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = $1',
      [user.id]
    );
    const followingResult = await db.query(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
      [user.id]
    );

    // Get post count
    const postResult = await db.query(
      'SELECT COUNT(*) as count FROM posts WHERE user_id = $1',
      [user.id]
    );

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      image: user.image,
      followerCount: parseInt(followerResult.rows[0].count),
      followingCount: parseInt(followingResult.rows[0].count),
      postCount: parseInt(postResult.rows[0].count),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function searchUsers(req, res) {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchQuery = `%${q}%`;
    const offset = (page - 1) * limit;

    // Search users
    const result = await db.query(
      `SELECT u.id, u.name, u.username, u.image, 
       (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
       FROM users u 
       WHERE LOWER(u.name) LIKE LOWER($1) OR LOWER(u.username) LIKE LOWER($1)
       ORDER BY u.username
       LIMIT $2 OFFSET $3`,
      [searchQuery, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM users 
       WHERE LOWER(name) LIKE LOWER($1) OR LOWER(username) LIKE LOWER($1)`,
      [searchQuery]
    );

    res.json({
      users: result.rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        image: u.image,
        postCount: parseInt(u.post_count),
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getUserPosts(req, res) {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Find user
    const userResult = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    // Get user's posts
    const postsResult = await db.query(
      `SELECT p.id, p.caption, p.image, p.user_id, p.created_at,
              u.id as user_id, u.name, u.username, u.image as user_image,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM posts WHERE user_id = $1',
      [userId]
    );

    res.json({
      posts: postsResult.rows.map((p) => ({
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
        isSaved: false,
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
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function followUser(req, res) {
  try {
    const { username } = req.params;
    const currentUser = req.user;

    // Find user to follow
    const targetUserResult = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = targetUserResult.rows[0].id;

    if (targetUserId === currentUser.id) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    // Check if already following
    const existingFollow = await db.query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUser.id, targetUserId]
    );

    if (existingFollow.rows.length > 0) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Create follow
    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [currentUser.id, targetUserId]
    );

    res.json({ message: 'Followed successfully' });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function unfollowUser(req, res) {
  try {
    const { username } = req.params;
    const currentUser = req.user;

    // Find user to unfollow
    const targetUserResult = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = targetUserResult.rows[0].id;

    // Check if following
    const existingFollow = await db.query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUser.id, targetUserId]
    );

    if (existingFollow.rows.length === 0) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // Remove follow
    await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUser.id, targetUserId]
    );

    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getFollowers(req, res) {
  try {
    const { username } = req.params;

    // Find user
    const targetUserResult = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = targetUserResult.rows[0].id;

    // Get followers
    const result = await db.query(
      `SELECT u.id, u.name, u.username, u.image
       FROM users u
       JOIN follows f ON u.id = f.follower_id
       WHERE f.following_id = $1`,
      [targetUserId]
    );

    res.json({
      followers: result.rows,
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getFollowing(req, res) {
  try {
    const { username } = req.params;

    // Find user
    const targetUserResult = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = targetUserResult.rows[0].id;

    // Get following
    const result = await db.query(
      `SELECT u.id, u.name, u.username, u.image
       FROM users u
       JOIN follows f ON u.id = f.following_id
       WHERE f.follower_id = $1`,
      [targetUserId]
    );

    res.json({
      following: result.rows,
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getPublicProfile,
  searchUsers,
  getUserPosts,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
};
