const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Sociality API is running',
    version: '1.0.0',
    vercel: process.env.VERCEL === '1' ? 'yes' : 'no',
    status: 'healthy'
  });
});

// Swagger UI
const swaggerDocument = require('./swagger.json');

// Serve swagger.json
app.get('/api-swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerDocument);
});

// Swagger UI endpoint for Vercel compatibility
app.get('/api-swagger', (req, res) => {
  const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sociality API - Swagger UI</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/api-swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout",
        validatorUrl: null,
      });
    };
  </script>
</body>
</html>
`.trim();
  res.setHeader('Content-Type', 'text/html');
  res.send(swaggerHtml);
});

// Simple test API route (without database)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes - Load all routes with database
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const profileRoutes = require('./routes/profile');
const commentsRoutes = require('./routes/comments');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/me', profileRoutes);
app.use('/api/comments', commentsRoutes);

// Alias routes for Cloud Run compatibility
const { getFeed, likePost, unlikePost, addComment, getComments, savePost, unsavePost } = require('./controllers/posts');
const { followUser, unfollowUser, getFollowers, getFollowing, getUserPosts } = require('./controllers/users');
const { getSavedPosts } = require('./controllers/posts');

app.get('/api/feed', authenticateToken, getFeed);

// Likes alias
app.post('/api/likes/:postId', authenticateToken, likePost);
app.delete('/api/likes/:postId', authenticateToken, unlikePost);

// Comments alias
app.post('/api/comments/:postId', authenticateToken, addComment);
app.get('/api/comments/:postId', authenticateToken, getComments);

// Follows alias
app.post('/api/follows/:username', authenticateToken, followUser);
app.delete('/api/follows/:username', authenticateToken, unfollowUser);

// Saves alias
app.post('/api/saves/:postId', authenticateToken, savePost);
app.delete('/api/saves/:postId', authenticateToken, unsavePost);
app.get('/api/users/:username/saves', authenticateToken, (req, res) => {
  // Map username to user and get their saved posts
  require('./models/db').query(
    'SELECT id FROM users WHERE username = $1',
    [req.params.username]
  ).then(result => {
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    req.params.id = result.rows[0].id;
    getSavedPosts(req, res);
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Generic 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Vercel serverless export
module.exports = app;
