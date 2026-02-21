# Sociality API

REST API untuk aplikasi social media, clone dari Sociality API original.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **File Storage**: Cloudinary
- **Authentication**: JWT
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- PostgreSQL (Neon)
- Cloudinary Account

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials
```

## Configuration

Edit `.env` file:

```env
# Server
PORT=3000

# JWT
JWT_SECRET=your-super-secret-key

# Database (Neon)
DATABASE_URL=postgresql://...

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Database Setup

```bash
# Run database schema
node init-db.js
```

## Run Locally

```bash
npm start
```

Server running di http://localhost:3000

## API Documentation

Swagger UI: http://localhost:3000/api-swagger/

## API Endpoints

### Auth

- POST /api/auth/register - Register user
- POST /api/auth/login - Login user

### Profile

- GET /api/me - Get my profile
- PUT /api/me - Update profile
- PUT /api/me/password - Change password
- GET /api/me/saved - Get saved posts

### Users

- GET /api/users/search - Search users
- GET /api/users/:username - Get public profile
- GET /api/users/:username/posts - Get user's posts
- POST /api/users/:username/follow - Follow user
- DELETE /api/users/:username/follow - Unfollow user
- GET /api/users/:username/followers - Get followers
- GET /api/users/:username/following - Get following

### Posts

- GET /api/posts - Get feed
- POST /api/posts - Create post (upload image)
- GET /api/posts/:id - Get post detail
- DELETE /api/posts/:id - Delete post
- POST /api/posts/:id/like - Like post
- DELETE /api/posts/:id/like - Unlike post
- GET /api/posts/:id/comments - Get comments
- POST /api/posts/:id/comments - Add comment
- DELETE /api/comments/:id - Delete comment
- POST /api/posts/:id/save - Save post
- DELETE /api/posts/:id/save - Unsave post

## Deploy ke Vercel

1. Push ke GitHub
2. Import project di Vercel
3. Tambahkan Environment Variables
4. Deploy!

## License

MIT
