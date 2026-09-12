import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import socket from '../socket';

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [taskRes, commentsRes] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get(`/comments/task/${id}`)
      ]);

      setTask(taskRes.data);
      setComments(commentsRes.data);
    } catch (err) {
      console.error('Failed to load task:', err);
      setError('Failed to load task');
    }
  };

  useEffect(() => {
    fetchData();

    const handleCommentCreated = (newComment) => {
      if (newComment.taskId === id) {
        setComments((prev) => [...prev, newComment]);
      }
    };

    socket.on('comment:created', handleCommentCreated);

    return () => {
      socket.off('comment:created', handleCommentCreated);
    };
  }, [id]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/comments', {
        content,
        taskId: id
      });

      setContent('');
    } catch (err) {
      console.error('Failed to post comment:', err);
      setError('Failed to post comment');
    }
  };

  if (!task) {
    return (
      <div style={{ maxWidth: 700, margin: '40px auto' }}>
        {error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto' }}>
      <Link to={`/project/${task.projectId}`}>
        ← Back to Project
      </Link>

      <h2>{task.title}</h2>

      {task.description && <p>{task.description}</p>}

      <p style={{ fontSize: 12, color: '#888' }}>
        Status: {task.status}
      </p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h3>Comments</h3>

      <div style={{ marginBottom: 20 }}>
        {comments.length === 0 && <p>No comments yet.</p>}

        {comments.map((c) => (
          <div
            key={c.id}
            style={{
              background: '#f4f4f4',
              padding: 10,
              borderRadius: 6,
              marginBottom: 8
            }}
          >
            <strong>{c.author?.name}</strong>{' '}

            <span style={{ fontSize: 12, color: '#888' }}>
              {new Date(c.createdAt).toLocaleString()}
            </span>

            <p style={{ margin: '4px 0 0' }}>
              {c.content}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddComment}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          required
          style={{
            width: '100%',
            minHeight: 60
          }}
        />

        <button type="submit">Post Comment</button>
      </form>
    </div>
  );
}