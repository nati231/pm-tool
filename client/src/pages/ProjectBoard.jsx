import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import socket from '../socket';

const STATUSES = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' }
];

export default function ProjectBoard() {
  const { id } = useParams();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);

  // New task
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState('');

  // Project editing
  const [editingProject, setEditingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectError, setProjectError] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // Project deletion
  const [deletingProject, setDeletingProject] = useState(false);

  // Member search
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [memberMessage, setMemberMessage] = useState('');
  const [memberError, setMemberError] = useState('');

  const fetchData = async () => {
    try {
      const [projRes, tasksRes, membersRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks/project/${id}`),
        api.get(`/members/project/${id}`)
      ]);

      setProject(projRes.data);
      setTasks(tasksRes.data);
      setMembers(membersRes.data);

      // Populate project edit fields
      setProjectName(projRes.data.name || '');
      setProjectDescription(projRes.data.description || '');
    } catch (err) {
      console.error('Failed to load project:', err);

      setError(
        err.response?.data?.error || 'Failed to load project'
      );
    }
  };

  useEffect(() => {
    fetchData();

    socket.emit('joinProject', id);

    const handleTaskCreated = (newTask) => {
      if (newTask.projectId === id) {
        setTasks((prev) => {
          const alreadyExists = prev.some(
            (task) => task.id === newTask.id
          );

          if (alreadyExists) {
            return prev;
          }

          return [...prev, newTask];
        });
      }
    };

    const handleTaskUpdated = (updatedTask) => {
      if (updatedTask.projectId !== id) {
        return;
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === updatedTask.id
            ? updatedTask
            : task
        )
      );
    };

    const handleTaskDeleted = (deletedTask) => {
      if (deletedTask.projectId !== id) {
        return;
      }

      setTasks((prev) =>
        prev.filter(
          (task) => task.id !== deletedTask.id
        )
      );
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      socket.emit('leaveProject', id);

      socket.off(
        'task:created',
        handleTaskCreated
      );

      socket.off(
        'task:updated',
        handleTaskUpdated
      );

      socket.off(
        'task:deleted',
        handleTaskDeleted
      );
    };
  }, [id]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!search.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const res = await api.get(
          `/auth/users/search?q=${encodeURIComponent(search)}`
        );

        setSearchResults(res.data);
      } catch (err) {
        console.error('User search error:', err);
        setSearchResults([]);
      }
    };

    const timeout = setTimeout(searchUsers, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const getMemberName = (member) => {
    return (
      member.user?.name ||
      member.user?.email ||
      'Unknown user'
    );
  };

  const getMemberEmail = (member) => {
    return member.user?.email || '';
  };

  const getTaskAssignee = (task) => {
    return members.find(
      (member) => member.userId === task.assigneeId
    );
  };

  const getTaskAssigneeName = (task) => {
    const assignee = getTaskAssignee(task);

    if (!assignee) {
      return 'Unassigned';
    }

    return getMemberName(assignee);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Task title is required');
      return;
    }

    try {
      await api.post('/tasks', {
        title: title.trim(),
        projectId: id,
        status: 'todo',
        priority,
        dueDate: dueDate || null,
        assigneeId: assigneeId || null
      });

      setTitle('');
      setPriority('medium');
      setDueDate('');
      setAssigneeId('');
    } catch (err) {
      console.error('Failed to create task:', err);

      setError(
        err.response?.data?.error ||
          'Failed to create task'
      );
    }
  };

  const handleStatusChange = async (
    taskId,
    newStatus
  ) => {
    setError('');

    try {
      await api.patch(`/tasks/${taskId}`, {
        status: newStatus
      });
    } catch (err) {
      console.error('Failed to update task:', err);

      setError(
        err.response?.data?.error ||
          'Failed to update task'
      );
    }
  };

  const handleAssigneeChange = async (
    taskId,
    newAssigneeId
  ) => {
    setError('');

    try {
      await api.patch(`/tasks/${taskId}`, {
        assigneeId: newAssigneeId || null
      });
    } catch (err) {
      console.error(
        'Failed to update task assignee:',
        err
      );

      setError(
        err.response?.data?.error ||
          'Failed to update task assignee'
      );

      await fetchData();
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearch(user.email);
    setSearchResults([]);
    setMemberError('');
    setMemberMessage('');
  };

  const handleAddMember = async () => {
    if (!selectedUser) {
      setMemberError('Please select a user first');
      return;
    }

    setMemberError('');
    setMemberMessage('');

    try {
      await api.post('/members', {
        projectId: id,
        userId: selectedUser.id,
        role: 'member'
      });

      setMemberMessage(
        `${selectedUser.name} was added to the project`
      );

      setSearch('');
      setSelectedUser(null);

      const res = await api.get(
        `/members/project/${id}`
      );

      setMembers(res.data);
    } catch (err) {
      setMemberError(
        err.response?.data?.error ||
          'Failed to add member'
      );
    }
  };

  // Save project name and description
  const handleSaveProject = async (e) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setProjectError(
        'Project name cannot be empty'
      );

      return;
    }

    setProjectError('');
    setSavingProject(true);

    try {
      const res = await api.patch(
        `/projects/${id}`,
        {
          name: projectName.trim(),
          description:
            projectDescription.trim() || null
        }
      );

      setProject(res.data);
      setProjectName(res.data.name || '');
      setProjectDescription(
        res.data.description || ''
      );
      setEditingProject(false);
    } catch (err) {
      console.error(
        'Failed to update project:',
        err
      );

      setProjectError(
        err.response?.data?.error ||
          'Failed to update project'
      );
    } finally {
      setSavingProject(false);
    }
  };

  const handleCancelProjectEdit = () => {
    setProjectName(project?.name || '');
    setProjectDescription(
      project?.description || ''
    );
    setProjectError('');
    setEditingProject(false);
  };

  // Delete project
  const handleDeleteProject = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?\n\nThis will permanently delete the project, its tasks, comments, and members.`
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setDeletingProject(true);

    try {
      await api.delete(`/projects/${id}`);

      // Return to dashboard after successful deletion
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(
        'Failed to delete project:',
        err
      );

      setError(
        err.response?.data?.error ||
          'Failed to delete project'
      );

      setDeletingProject(false);
    }
  };

  const formatDueDate = (date) => {
    if (!date) {
      return null;
    }

    return new Date(date).toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    );
  };

  if (!project) {
    return (
      <div
        style={{
          maxWidth: 1000,
          margin: '40px auto'
        }}
      >
        {error ? (
          <p style={{ color: 'red' }}>
            {error}
          </p>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: '40px auto'
      }}
    >
      <Link to="/dashboard">
        ← Back to Dashboard
      </Link>

      {/* Project Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          marginTop: 20,
          marginBottom: 20
        }}
      >
        <div>
          <h2 style={{ marginBottom: 5 }}>
            {project.name}
          </h2>

          {project.description && (
            <p
              style={{
                marginTop: 0,
                color: '#666'
              }}
            >
              {project.description}
            </p>
          )}
        </div>

        {!editingProject && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setProjectName(
                  project.name || ''
                );

                setProjectDescription(
                  project.description || ''
                );

                setProjectError('');
                setEditingProject(true);
              }}
              disabled={deletingProject}
            >
              Edit Project
            </button>

            <button
              type="button"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject
                ? 'Deleting...'
                : 'Delete Project'}
            </button>
          </div>
        )}
      </div>

      {/* Edit Project Form */}
      {editingProject && (
        <form
          onSubmit={handleSaveProject}
          style={{
            border: '1px solid #ddd',
            padding: 20,
            borderRadius: 8,
            marginBottom: 30,
            background: '#fafafa'
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            Edit Project
          </h3>

          <div style={{ marginBottom: 15 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 5,
                fontWeight: 'bold'
              }}
            >
              Project Name
            </label>

            <input
              type="text"
              value={projectName}
              onChange={(e) =>
                setProjectName(e.target.value)
              }
              required
              style={{
                width: '100%',
                padding: 10,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 15 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 5,
                fontWeight: 'bold'
              }}
            >
              Description
            </label>

            <textarea
              value={projectDescription}
              onChange={(e) =>
                setProjectDescription(
                  e.target.value
                )
              }
              rows={4}
              placeholder="Project description (optional)"
              style={{
                width: '100%',
                padding: 10,
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>

          {projectError && (
            <p style={{ color: 'red' }}>
              {projectError}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: 10
            }}
          >
            <button
              type="submit"
              disabled={savingProject}
            >
              {savingProject
                ? 'Saving...'
                : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={
                handleCancelProjectEdit
              }
              disabled={savingProject}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {/* Project Members */}
      <h3>Project Members</h3>

      {members.length === 0 ? (
        <p>No members yet.</p>
      ) : (
        <ul>
          {members.map((member) => (
            <li key={member.id}>
              <strong>
                {getMemberName(member)}
              </strong>{' '}
              ({getMemberEmail(member)}) —{' '}
              {member.role}
            </li>
          ))}
        </ul>
      )}

      {/* Add Member */}
      <div
        style={{
          position: 'relative',
          maxWidth: 450,
          marginBottom: 30
        }}
      >
        <h3>Add Member</h3>

        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedUser(null);
            setMemberMessage('');
            setMemberError('');
          }}
          style={{
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box'
          }}
        />

        {search.trim() &&
          searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 75,
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: 6,
                boxShadow:
                  '0 4px 10px rgba(0,0,0,0.1)',
                zIndex: 10
              }}
            >
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() =>
                    handleSelectUser(user)
                  }
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: 10,
                    border: 'none',
                    borderBottom:
                      '1px solid #eee',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <strong>
                    {user.name}
                  </strong>

                  <br />

                  <span
                    style={{
                      fontSize: 12,
                      color: '#777'
                    }}
                  >
                    {user.email}
                  </span>
                </button>
              ))}
            </div>
          )}

        {search.trim() &&
          searchResults.length === 0 &&
          !selectedUser && (
            <p
              style={{
                fontSize: 13,
                color: '#777'
              }}
            >
              No users found
            </p>
          )}

        {selectedUser && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              background: '#f4f4f4',
              borderRadius: 6
            }}
          >
            <strong>
              {selectedUser.name}
            </strong>

            <br />

            <span
              style={{
                fontSize: 13,
                color: '#777'
              }}
            >
              {selectedUser.email}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleAddMember}
          disabled={!selectedUser}
          style={{
            marginTop: 10,
            padding: '9px 15px',
            cursor: selectedUser
              ? 'pointer'
              : 'not-allowed'
          }}
        >
          Add Member
        </button>

        {memberMessage && (
          <p style={{ color: 'green' }}>
            {memberMessage}
          </p>
        )}

        {memberError && (
          <p style={{ color: 'red' }}>
            {memberError}
          </p>
        )}
      </div>

      {/* New Task */}
      <h3>New Task</h3>

      <form
        onSubmit={handleCreateTask}
        style={{
          marginBottom: 20,
          border: '1px solid #ddd',
          padding: 15,
          borderRadius: 8
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 10
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 5,
                fontWeight: 'bold'
              }}
            >
              Task Title
            </label>

            <input
              placeholder="New task title"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              required
              style={{
                width: '100%',
                padding: 8,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 5,
                fontWeight: 'bold'
              }}
            >
              Priority
            </label>

            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value)
              }
              style={{
                width: '100%',
                padding: 8
              }}
            >
              <option value="low">
                Low
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="high">
                High
              </option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 5,
                fontWeight: 'bold'
              }}
            >
              Assignee
            </label>

            <select
              value={assigneeId}
              onChange={(e) =>
                setAssigneeId(e.target.value)
              }
              style={{
                width: '100%',
                padding: 8
              }}
            >
              <option value="">
                Unassigned
              </option>

              {members.map((member) => (
                <option
                  key={member.userId}
                  value={member.userId}
                >
                  {getMemberName(member)}
                  {member.role === 'owner'
                    ? ' (Owner)'
                    : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 5,
                fontWeight: 'bold'
              }}
            >
              Due Date
            </label>

            <input
              type="date"
              value={dueDate}
              onChange={(e) =>
                setDueDate(e.target.value)
              }
              style={{
                width: '100%',
                padding: 8,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <button type="submit">
              Add Task
            </button>
          </div>
        </div>
      </form>

      {/* Task Board */}
      <div
        style={{
          display: 'flex',
          gap: 20
        }}
      >
        {STATUSES.map((status) => (
          <div
            key={status.key}
            style={{
              flex: 1,
              background: '#f4f4f4',
              padding: 10,
              borderRadius: 8
            }}
          >
            <h4>{status.label}</h4>

            {tasks
              .filter(
                (task) =>
                  task.status === status.key
              )
              .map((task) => (
                <div
                  key={task.id}
                  style={{
                    background: 'white',
                    padding: 10,
                    marginBottom: 8,
                    borderRadius: 6,
                    boxShadow:
                      '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <Link
                    to={`/task/${task.id}`}
                  >
                    {task.title}
                  </Link>

                  {/* Assignee */}
                  <div
                    style={{
                      marginTop: 8
                    }}
                  >
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#666',
                        marginBottom: 4
                      }}
                    >
                      Assignee
                    </label>

                    <select
                      value={
                        task.assigneeId || ''
                      }
                      onChange={(e) =>
                        handleAssigneeChange(
                          task.id,
                          e.target.value
                        )
                      }
                      style={{
                        width: '100%',
                        padding: 5,
                        fontSize: 12
                      }}
                    >
                      <option value="">
                        Unassigned
                      </option>

                      {members.map((member) => (
                        <option
                          key={member.userId}
                          value={member.userId}
                        >
                          {getMemberName(member)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority */}
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: '#666'
                    }}
                  >
                    Priority:{' '}
                    <strong>
                      {task.priority ||
                        'medium'}
                    </strong>
                  </div>

                  {/* Due Date */}
                  {task.dueDate && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 13
                      }}
                    >
                      📅 Due:{' '}
                      <strong>
                        {formatDueDate(
                          task.dueDate
                        )}
                      </strong>
                    </div>
                  )}

                  {/* Status Buttons */}
                  <div
                    style={{
                      marginTop: 8
                    }}
                  >
                    {STATUSES.filter(
                      (nextStatus) =>
                        nextStatus.key !==
                        task.status
                    ).map((nextStatus) => (
                      <button
                        key={nextStatus.key}
                        type="button"
                        onClick={() =>
                          handleStatusChange(
                            task.id,
                            nextStatus.key
                          )
                        }
                        style={{
                          fontSize: 11,
                          marginRight: 4,
                          marginBottom: 4
                        }}
                      >
                        → {nextStatus.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

            {tasks.filter(
              (task) =>
                task.status === status.key
            ).length === 0 && (
              <p
                style={{
                  color: '#888',
                  fontSize: 13
                }}
              >
                No tasks
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}