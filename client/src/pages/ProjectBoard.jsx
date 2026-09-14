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

  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

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
    } catch (err) {
      console.error('Failed to load project:', err);
      setError('Failed to load project');
    }
  };

  useEffect(() => {
    fetchData();

    socket.emit('joinProject', id);

    const handleTaskCreated = (newTask) => {
      if (newTask.projectId === id) {
        setTasks((prev) => [...prev, newTask]);
      }
    };

    const handleTaskUpdated = (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === updatedTask.id ? updatedTask : t
        )
      );
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);

    return () => {
      socket.emit('leaveProject', id);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/tasks', {
        title,
        projectId: id,
        status: 'todo'
      });

      setTitle('');
    } catch (err) {
      setError('Failed to create task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, {
        status: newStatus
      });
    } catch (err) {
      setError('Failed to update task');
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

      const res = await api.get(`/members/project/${id}`);
      setMembers(res.data);
    } catch (err) {
      setMemberError(
        err.response?.data?.error || 'Failed to add member'
      );
    }
  };

  if (!project) {
    return <p>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto' }}>
      <Link to="/dashboard">← Back to Dashboard</Link>

      <h2>{project.name}</h2>
      <p>{project.description}</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h3>Project Members</h3>

      {members.length === 0 ? (
        <p>No members yet.</p>
      ) : (
        <ul>
          {members.map((member) => (
            <li key={member.id}>
              <strong>{member.user?.name}</strong>{' '}
              ({member.user?.email}) — {member.role}
            </li>
          ))}
        </ul>
      )}

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

        {search.trim() && searchResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 75,
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: 6,
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
              zIndex: 10
            }}
          >
            {searchResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 10,
                  border: 'none',
                  borderBottom: '1px solid #eee',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <strong>{user.name}</strong>
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
            <p style={{ fontSize: 13, color: '#777' }}>
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
            <strong>{selectedUser.name}</strong>
            <br />
            <span style={{ fontSize: 13, color: '#777' }}>
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
            cursor: selectedUser ? 'pointer' : 'not-allowed'
          }}
        >
          Add Member
        </button>

        {memberMessage && (
          <p style={{ color: 'green' }}>{memberMessage}</p>
        )}

        {memberError && (
          <p style={{ color: 'red' }}>{memberError}</p>
        )}
      </div>

      <h3>New Task</h3>

      <form onSubmit={handleCreateTask} style={{ marginBottom: 20 }}>
        <input
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <button type="submit">Add Task</button>
      </form>

      <div style={{ display: 'flex', gap: 20 }}>
        {STATUSES.map((s) => (
          <div
            key={s.key}
            style={{
              flex: 1,
              background: '#f4f4f4',
              padding: 10,
              borderRadius: 8
            }}
          >
            <h4>{s.label}</h4>

            {tasks
              .filter((t) => t.status === s.key)
              .map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: 'white',
                    padding: 10,
                    marginBottom: 8,
                    borderRadius: 6,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <Link to={`/task/${t.id}`}>{t.title}</Link>

                  <div style={{ marginTop: 6 }}>
                    {STATUSES
                      .filter((st) => st.key !== t.status)
                      .map((st) => (
                        <button
                          key={st.key}
                          onClick={() =>
                            handleStatusChange(t.id, st.key)
                          }
                          style={{
                            fontSize: 11,
                            marginRight: 4
                          }}
                        >
                          → {st.label}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}