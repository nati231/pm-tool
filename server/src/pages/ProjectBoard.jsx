import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

const STATUSES = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' }
];

export default function ProjectBoard() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [projRes, tasksRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/tasks/project/${id}`)
      ]);
      setProject(projRes.data);
      setTasks(tasksRes.data);
    } catch (err) {
      setError('Failed to load project');
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]); // re-run if the project id in the URL changes

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', { title, projectId: id, status: 'todo' });
      setTitle('');
      fetchData();
    } catch (err) {
      setError('Failed to create task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      fetchData();
    } catch (err) {
      setError('Failed to update task');
    }
  };

  if (!project) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto' }}>
      <Link to="/dashboard">← Back to Dashboard</Link>
      <h2>{project.name}</h2>
      <p>{project.description}</p>

      <form onSubmit={handleCreateTask} style={{ marginBottom: 20 }}>
        <input
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button type="submit">Add Task</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 20 }}>
        {STATUSES.map((s) => (
          <div key={s.key} style={{ flex: 1, background: '#f4f4f4', padding: 10, borderRadius: 8 }}>
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
                    {STATUSES.filter((st) => st.key !== t.status).map((st) => (
                      <button
                        key={st.key}
                        onClick={() => handleStatusChange(t.id, st.key)}
                        style={{ fontSize: 11, marginRight: 4 }}
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