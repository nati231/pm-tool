const express = require('express');
const requireAuth = require('../middleware/auth');

module.exports = function memberRoutes(db) {
  const router = express.Router();

  router.use(requireAuth);

  // List members of a project
  router.get('/project/:projectId', async (req, res) => {
    try {
      const membership = await db.orm.public.ProjectMember
        .where({
          projectId: req.params.projectId,
          userId: req.userId
        })
        .first();

      if (!membership) {
        return res.status(403).json({
          error: 'Not a member of this project'
        });
      }

      const memberships = await db.orm.public.ProjectMember
        .where({
          projectId: req.params.projectId
        })
        .all();

      const members = await Promise.all(
        memberships.map(async (membership) => {
          const user = await db.orm.public.User
            .where({ id: membership.userId })
            .first();

          return {
            id: membership.id,
            userId: membership.userId,
            projectId: membership.projectId,
            role: membership.role,
            joinedAt: membership.joinedAt,
            user: user
              ? {
                  id: user.id,
                  name: user.name,
                  email: user.email
                }
              : null
          };
        })
      );

      res.json(members);
    } catch (err) {
      console.error('List project members error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  // Add a member to a project
  router.post('/', async (req, res) => {
    try {
      const { projectId, userId, role } = req.body;

      if (!projectId || !userId) {
        return res.status(400).json({
          error: 'projectId and userId are required'
        });
      }

      // Only the project owner can add members
      const ownerMembership = await db.orm.public.ProjectMember
        .where({
          projectId,
          userId: req.userId,
          role: 'owner'
        })
        .first();

      if (!ownerMembership) {
        return res.status(403).json({
          error: 'Only the project owner can add members'
        });
      }

      // Make sure the user exists
      const user = await db.orm.public.User
        .where({ id: userId })
        .first();

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Make sure the project exists
      const project = await db.orm.public.Project
        .where({ id: projectId })
        .first();

      if (!project) {
        return res.status(404).json({
          error: 'Project not found'
        });
      }

      // Prevent duplicate membership
      const existingMembership = await db.orm.public.ProjectMember
        .where({
          projectId,
          userId
        })
        .first();

      if (existingMembership) {
        return res.status(409).json({
          error: 'User is already a member of this project'
        });
      }

      const membership = await db.orm.public.ProjectMember.create({
        projectId,
        userId,
        role: role || 'member'
      });

      res.status(201).json({
        id: membership.id,
        projectId: membership.projectId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.joinedAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });
    } catch (err) {
      console.error('Add project member error:', err);

      res.status(500).json({
        error: err.message
      });
    }
  });

  return router;
};