const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('neon.tech')
        ? {
            rejectUnauthorized: false,
            requestCert: true,
          }
        : false,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

module.exports = {
  query: async (text, params) => {
    const p = getPool();
    if (!p) {
      throw new Error(
        'Database not configured. Please set DATABASE_URL environment variable.'
      );
    }
    return p.query(text, params);
  },
  getPool,
};
