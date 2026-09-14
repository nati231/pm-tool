require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const createDb = require('./prisma/db');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');
const memberRoutes = require('./routes/members');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173'
  }
});

io.on('connection', (socket) => {
  socket.on('joinProject', (projectId) => {
    socket.join(projectId);
  });

  socket.on('leaveProject', (projectId) => {
    socket.leave(projectId);
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const db = await createDb();

    await db.orm.public.User.all();

    app.locals.db = db;
    app.locals.io = io;

    app.get('/test-db', async (req, res) => {
      try {
        const users = await db.orm.public.User.all();

        res.json({
          message: 'DB connected',
          userCount: users.length
        });
      } catch (err) {
        res.status(500).json({
          error: err.message
        });
      }
    });

    app.use('/api/auth', authRoutes(db));
    app.use('/api/projects', projectRoutes(db));
    app.use('/api/tasks', taskRoutes(db));
    app.use('/api/comments', commentRoutes(db));
    app.use('/api/members', memberRoutes(db));

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Prisma PostgreSQL connected');
      console.log('Socket.io ready');
    });
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

startServer();