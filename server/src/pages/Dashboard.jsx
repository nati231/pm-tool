import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      setError('Failed to load projects');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []); // empty array = run once, when the component first mounts

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
      fetchProjects(); // refresh the list after creating
    } catch (err) {
      setError('Failed to create project');
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '60px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Welcome, {user?.name}</h2>
        <button onClick={logout}>Logout</button>
      </div>

      <h3>New Project</h3>
      <form onSubmit={handleCreate} style={{ marginBottom: 30 }}>
        <input
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h3>Your Projects</h3>
      {projects.length === 0 && <p>No projects yet.</p>}
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/project/${p.id}`}>{p.name}</Link>
            {p.description && <span> — {p.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}