const express = require('express');
const requireAuth = require('../middleware/auth');

module.exports = function commentRoutes(db) {
  const router = express.Router();
  router.use(requireAuth);

  async function assertMember(projectId, userId) {
    const membership = await db.orm.public.ProjectMember
      .where({ projectId, userId })
      .first();

    return !!membership;
  }

  // POST a comment on a task
  router.post('/', async (req, res) => {
    try {
      const { content, taskId } = req.body;

      if (!content || !taskId) {
        return res.status(400).json({
          error: 'content and taskId are required'
        });
      }

      const task = await db.orm.public.Task
        .where({ id: taskId })
        .first();

      if (!task) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      const isMember = await assertMember(
        task.projectId,
        req.userId
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Not a member of this project'
        });
      }

      const comment = await db.orm.public.Comment.create({
        content,
        taskId,
        authorId: req.userId
      });

      req.app.locals.io
        .to(task.projectId)
        .emit('comment:created', comment);

      res.status(201).json(comment);
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  });

  // LIST comments for a task, oldest first, with author info attached
  router.get('/task/:taskId', async (req, res) => {
    try {
      const task = await db.orm.public.Task
        .where({ id: req.params.taskId })
        .first();

      if (!task) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      const isMember = await assertMember(
        task.projectId,
        req.userId
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Not a member of this project'
        });
      }

      const comments = await db.orm.public.Comment
        .where({ taskId: req.params.taskId })
        .all();

      // Sort oldest first
      comments.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      // Attach author name/email to each comment
      const withAuthors = await Promise.all(
        comments.map(async (c) => {
          const author = await db.orm.public.User
            .where({ id: c.authorId })
            .first();

          return {
            ...c,
            author: author
              ? {
                  id: author.id,
                  name: author.name,
                  email: author.email
                }
              : null
          };
        })
      );

      res.json(withAuthors);
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  });

  return router;
};