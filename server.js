require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const profileRoutes = require('./routes/profile');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/me', profileRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Sociality API is running', version: '1.0.0' });
});

// Swagger UI
const swaggerDocument = require('./swagger.json');

// Serve swagger.json first (before the UI setup)
app.get('/api-swagger.json', (req, res) => {
  res.json(swaggerDocument);
});

app.use(
  '/api-swagger',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      url: '/api-swagger.json',
    },
  })
);

// Only start server when not in Vercel (serverless environment)
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
