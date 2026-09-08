require('dotenv').config();

const express = require('express');
const cors = require('cors');
const createDb = require('./prisma/db');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const db = await createDb();

    // Verify the Prisma PostgreSQL connection.
    await db.orm.public.User.all();

    app.locals.db = db;

    app.get('/test-db', async (req, res) => {
      try {
        const users = await db.orm.public.User.all();
        res.json({ message: 'DB connected', userCount: users.length });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Prisma PostgreSQL connected');
    });
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

startServer();