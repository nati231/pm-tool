const express = require('express');
const requireAuth = require('../middleware/auth');

module.exports = function taskRoutes(db) {
  const router = express.Router();
  router.use(requireAuth);

  async function assertMember(projectId, userId) {
    const membership = await db.orm.public.ProjectMember
      .where({ projectId, userId })
      .first();

    return !!membership;
  }

  router.post('/', async (req, res) => {
    try {
      const {
        title,
        description,
        projectId,
        assigneeId,
        status,
        priority
      } = req.body;

      if (!title || !projectId) {
        return res.status(400).json({
          error: 'title and projectId are required'
        });
      }

      const isMember = await assertMember(projectId, req.userId);

      if (!isMember) {
        return res.status(403).json({
          error: 'Not a member of this project'
        });
      }

      const task = await db.orm.public.Task.create({
        title,
        description: description || null,
        projectId,
        assigneeId: assigneeId || null,
        status: status || 'todo',
        priority: priority || 'medium'
      });

      req.app.locals.io.to(projectId).emit('task:created', task);

      res.status(201).json(task);
    } catch (err) {
      console.error('Create task error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  router.get('/project/:projectId', async (req, res) => {
    try {
      const isMember = await assertMember(
        req.params.projectId,
        req.userId
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Not a member of this project'
        });
      }

      const tasks = await db.orm.public.Task
        .where({ projectId: req.params.projectId })
        .all();

      res.json(tasks);
    } catch (err) {
      console.error('List tasks error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // GET a single task
  router.get('/:id', async (req, res) => {
    try {
      const task = await db.orm.public.Task
        .where({ id: req.params.id })
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

      res.json(task);
    } catch (err) {
      res.status(500).json({
        error: err.message
      });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const task = await db.orm.public.Task
        .where({ id: req.params.id })
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

      const {
        title,
        description,
        status,
        assigneeId,
        priority
      } = req.body;

      const updated = await db.orm.public.Task
        .where({ id: req.params.id })
        .update({
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(assigneeId !== undefined && { assigneeId }),
          ...(priority !== undefined && { priority })
        });

      req.app.locals.io
        .to(task.projectId)
        .emit('task:updated', updated);

      res.json(updated);
    } catch (err) {
      console.error('Update task error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const task = await db.orm.public.Task
        .where({ id: req.params.id })
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

      await db.orm.public.Comment
        .where({ taskId: req.params.id })
        .delete();

      await db.orm.public.Task
        .where({ id: req.params.id })
        .delete();

      res.status(204).send();
    } catch (err) {
      console.error('Delete task error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  return router;
};