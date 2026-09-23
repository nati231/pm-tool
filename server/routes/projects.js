const express = require('express');
const requireAuth = require('../middleware/auth');

module.exports = function projectRoutes(db) {
  const router = express.Router();

  router.use(requireAuth);

  // CREATE a project
  router.post('/', async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({
          error: 'Project name is required'
        });
      }

      const project = await db.orm.public.Project.create({
        name,
        description: description || null,
        ownerId: req.userId
      });

      // Add the creator as a member with role "owner"
      await db.orm.public.ProjectMember.create({
        projectId: project.id,
        userId: req.userId,
        role: 'owner'
      });

      res.status(201).json(project);
    } catch (err) {
      console.error('Create project error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // LIST projects the logged-in user is a member of
  router.get('/', async (req, res) => {
    try {
      const memberships = await db.orm.public.ProjectMember
        .where({ userId: req.userId })
        .all();

      const projectIds = memberships.map(
        (m) => m.projectId
      );

      const projects = await Promise.all(
        projectIds.map((projectId) =>
          db.orm.public.Project
            .where({ id: projectId })
            .first()
        )
      );

      res.json(projects);
    } catch (err) {
      console.error('List projects error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // GET a single project (must be a member)
  router.get('/:id', async (req, res) => {
    try {
      const membership = await db.orm.public.ProjectMember
        .where({
          projectId: req.params.id,
          userId: req.userId
        })
        .first();

      if (!membership) {
        return res.status(403).json({
          error: 'Not a member of this project'
        });
      }

      const project = await db.orm.public.Project
        .where({ id: req.params.id })
        .first();

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      res.json(project);
    } catch (err) {
      console.error('Get project error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // UPDATE a project
  router.patch('/:id', async (req, res) => {
    try {
      const { name, description } = req.body;

      const project = await db.orm.public.Project
        .where({ id: req.params.id })
        .first();

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      // Only the owner can edit the project
      if (project.ownerId !== req.userId) {
        return res.status(403).json({
          error: 'Only the project owner can edit this project'
        });
      }

      if (name !== undefined && !name.trim()) {
        return res.status(400).json({
          error: 'Project name cannot be empty'
        });
      }

      const updatedProject =
        await db.orm.public.Project.update(
          { id: req.params.id },
          {
            ...(name !== undefined && {
              name: name.trim()
            }),
            ...(description !== undefined && {
              description: description || null
            })
          }
        );

      res.json(updatedProject);
    } catch (err) {
      console.error('Update project error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // DELETE a project (owner only)
  router.delete('/:id', async (req, res) => {
    try {
      const project = await db.orm.public.Project
        .where({ id: req.params.id })
        .first();

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      // Only the owner can delete the project
      if (project.ownerId !== req.userId) {
        return res.status(403).json({
          error:
            'Only the project owner can delete this project'
        });
      }

      // Find all tasks in the project
      const tasks = await db.orm.public.Task
        .where({ projectId: req.params.id })
        .all();

      // Delete comments for each task first
      for (const task of tasks) {
        await db.orm.public.Comment
          .where({ taskId: task.id })
          .delete();
      }

      // Delete all tasks
      await db.orm.public.Task
        .where({ projectId: req.params.id })
        .delete();

      // Delete all project members
      await db.orm.public.ProjectMember
        .where({ projectId: req.params.id })
        .delete();

      // Finally delete the project
      await db.orm.public.Project
        .where({ id: req.params.id })
        .delete();

      res.json({
        message: 'Project deleted successfully'
      });
    } catch (err) {
      console.error('Delete project error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  return router;
};