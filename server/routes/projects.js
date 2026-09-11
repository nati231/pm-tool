const express = require('express');
const requireAuth = require('../middleware/auth');

module.exports = function projectRoutes(db) {
  const router = express.Router();
  router.use(requireAuth); // every route below requires a valid token

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

      const projectIds = memberships.map(m => m.projectId);

      const projects = await Promise.all(
        projectIds.map(id =>
          db.orm.public.Project.where({ id }).first()
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

  return router;
};