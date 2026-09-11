import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ maxWidth: 600, margin: '80px auto' }}>
      <h2>Welcome, {user?.name}</h2>
      <p>{user?.email}</p>

      <button onClick={logout}>Logout</button>
    </div>
  );
}
