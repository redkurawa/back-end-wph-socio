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
    vercel: process.env.VERCEL === '1' ? 'yes' : 'no'
  });
});

// API Routes - Define BEFORE Swagger to avoid conflicts
console.log('Loading API routes...');

try {
  const authRoutes = require('./routes/auth');
  console.log('Auth routes loaded');
  app.use('/api/auth', authRoutes);
} catch (err) {
  console.error('Failed to load auth routes:', err.message);
}

try {
  const userRoutes = require('./routes/users');
  console.log('User routes loaded');
  app.use('/api/users', userRoutes);
} catch (err) {
  console.error('Failed to load user routes:', err.message);
}

try {
  const postRoutes = require('./routes/posts');
  console.log('Post routes loaded');
  app.use('/api/posts', postRoutes);
} catch (err) {
  console.error('Failed to load post routes:', err.message);
}

try {
  const profileRoutes = require('./routes/profile');
  console.log('Profile routes loaded');
  app.use('/api/me', profileRoutes);
} catch (err) {
  console.error('Failed to load profile routes:', err.message);
}

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

// Generic 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Vercel serverless export
module.exports = app;
