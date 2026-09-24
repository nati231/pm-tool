const express = require('express');
const requireAuth = require('../middleware/auth');

require('temporal-polyfill/global');

module.exports = function taskRoutes(db) {
  const router = express.Router();

  router.use(requireAuth);

  async function assertMember(projectId, userId) {
    const membership = await db.orm.public.ProjectMember
      .where({ projectId, userId })
      .first();

    return !!membership;
  }

  async function assertAssignee(projectId, userId) {
    if (!userId) {
      return true;
    }

    const membership = await db.orm.public.ProjectMember
      .where({
        projectId,
        userId
      })
      .first();

    return !!membership;
  }

  // Create task
  router.post('/', async (req, res) => {
    try {
      const {
        title,
        description,
        projectId,
        assigneeId,
        status,
        priority,
        dueDate
      } = req.body;

      if (!title || !projectId) {
        return res.status(400).json({
          error: 'title and projectId are required'
        });
      }

      const isMember = await assertMember(
        projectId,
        req.userId
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Not a member of this project'
        });
      }

      const validAssignee = await assertAssignee(
        projectId,
        assigneeId
      );

      if (!validAssignee) {
        return res.status(400).json({
          error: 'Assignee must be a member of this project'
        });
      }

      const task = await db.orm.public.Task.create({
        title,
        description: description || null,
        projectId,
        assigneeId: assigneeId || null,
        status: status || 'todo',
        priority: priority || 'medium',
        dueDate: dueDate
          ? Temporal.Instant.from(dueDate)
          : null
      });

      req.app.locals.io
        .to(projectId)
        .emit('task:created', task);

      res.status(201).json(task);
    } catch (err) {
      console.error('Create task error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // List project tasks
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
        .where({
          projectId: req.params.projectId
        })
        .all();

      res.json(tasks);
    } catch (err) {
      console.error('List tasks error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // Get single task
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
      console.error('Get task error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // Update task
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
        priority,
        dueDate
      } = req.body;

      if (assigneeId !== undefined) {
        const validAssignee = await assertAssignee(
          task.projectId,
          assigneeId
        );

        if (!validAssignee) {
          return res.status(400).json({
            error: 'Assignee must be a member of this project'
          });
        }
      }

      const updated = await db.orm.public.Task
        .where({ id: req.params.id })
        .update({
          ...(title !== undefined && { title }),

          ...(description !== undefined && {
            description
          }),

          ...(status !== undefined && {
            status
          }),

          ...(assigneeId !== undefined && {
            assigneeId: assigneeId || null
          }),

          ...(priority !== undefined && {
            priority
          }),

          ...(dueDate !== undefined && {
            dueDate: dueDate
              ? Temporal.Instant.from(dueDate)
              : null
          })
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

  // Delete task
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
        .where({
          taskId: req.params.id
        })
        .delete();

      await db.orm.public.Task
        .where({
          id: req.params.id
        })
        .delete();

      req.app.locals.io
        .to(task.projectId)
        .emit('task:deleted', {
          id: task.id,
          projectId: task.projectId
        });

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