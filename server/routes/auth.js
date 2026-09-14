const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requireAuth = require('../middleware/auth');

module.exports = function authRoutes(db) {
  const router = express.Router();

  // REGISTER
  router.post('/register', async (req, res) => {
    console.log('REGISTER ROUTE HIT');

    try {
      const { email, name, password } = req.body;

      if (!email || !name || !password) {
        return res.status(400).json({
          error: 'Email, name, and password are required'
        });
      }

      const existing = await db.orm.public.User
        .where({ email })
        .first();

      if (existing) {
        return res.status(409).json({
          error: 'Email already registered'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await db.orm.public.User.create({
        email,
        name,
        password: hashedPassword
      });

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (err) {
      console.error('Registration error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // LOGIN
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      const user = await db.orm.public.User
        .where({ email })
        .first();

      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      const validPassword = await bcrypt.compare(
        password,
        user.password
      );

      if (!validPassword) {
        return res.status(401).json({
          error: 'Invalid email or password'
        });
      }

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (err) {
      console.error('Login error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // GET CURRENT USER
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const user = await db.orm.public.User
        .where({ id: req.userId })
        .first();

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name
      });
    } catch (err) {
      console.error('Get current user error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // SEARCH USERS
  router.get('/users/search', requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();

      if (!q) {
        return res.json([]);
      }

      const users = await db.orm.public.User.all();

      const results = users
        .filter((user) => {
          return (
            user.name.toLowerCase().includes(q) ||
            user.email.toLowerCase().includes(q)
          );
        })
        .slice(0, 10)
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email
        }));

      res.json(results);
    } catch (err) {
      console.error('Search users error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  return router;
};