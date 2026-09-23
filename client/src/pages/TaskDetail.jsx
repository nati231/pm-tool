import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import socket from '../socket';

export default function TaskDetail() {
  const { id } = useParams();

  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [members, setMembers] = useState([]);

  const [content, setContent] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');

  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [taskRes, commentsRes] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get(`/comments/task/${id}`)
      ]);

      setTask(taskRes.data);
      setComments(commentsRes.data);

      const membersRes = await api.get(
        `/members/project/${taskRes.data.projectId}`
      );

      setMembers(membersRes.data);
      setAssigneeId(taskRes.data.assigneeId || '');
      setDescription(taskRes.data.description || '');
      setPriority(taskRes.data.priority || 'medium');

      if (taskRes.data.dueDate) {
        setDueDate(taskRes.data.dueDate.slice(0, 10));
      } else {
        setDueDate('');
      }
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

  const handleAssigneeChange = async (e) => {
    const newAssigneeId = e.target.value;

    setAssigneeId(newAssigneeId);
    setError('');

    try {
      const res = await api.patch(`/tasks/${id}`, {
        assigneeId: newAssigneeId || null
      });

      setTask(res.data);
    } catch (err) {
      console.error('Failed to assign task:', err);
      setError('Failed to assign task');

      setAssigneeId(task.assigneeId || '');
    }
  };

  const handlePriorityChange = async (e) => {
    const newPriority = e.target.value;

    setPriority(newPriority);
    setError('');

    try {
      const res = await api.patch(`/tasks/${id}`, {
        priority: newPriority
      });

      setTask(res.data);
    } catch (err) {
      console.error('Failed to update priority:', err);
      setError('Failed to update priority');

      setPriority(task.priority || 'medium');
    }
  };

  const handleDueDateChange = async (e) => {
    const newDueDate = e.target.value;

    setDueDate(newDueDate);
    setError('');

    try {
      const res = await api.patch(`/tasks/${id}`, {
        dueDate: newDueDate
          ? `${newDueDate}T12:00:00.000Z`
          : null
      });

      setTask(res.data);
    } catch (err) {
      console.error('Failed to update due date:', err);
      setError('Failed to update due date');

      if (task.dueDate) {
        setDueDate(task.dueDate.slice(0, 10));
      } else {
        setDueDate('');
      }
    }
  };

  const handleSaveDescription = async () => {
    setError('');

    try {
      const res = await api.patch(`/tasks/${id}`, {
        description: description || null
      });

      setTask(res.data);
      setDescription(res.data.description || '');
      setEditingDescription(false);
    } catch (err) {
      console.error('Failed to update description:', err);
      setError('Failed to update description');
    }
  };

  const handleCancelDescription = () => {
    setDescription(task.description || '');
    setEditingDescription(false);
  };

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

  const handleDeleteTask = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this task?'
    );

    if (!confirmed) {
      return;
    }

    setError('');

    try {
      await api.delete(`/tasks/${id}`);

      window.location.href = `/project/${task.projectId}`;
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task');
    }
  };

  const formatDueDate = (date) => {
    if (!date) {
      return null;
    }

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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

  const currentAssignee = members.find(
    (member) => member.userId === task.assigneeId
  );

  return (
    <div style={{ maxWidth: 700, margin: '40px auto' }}>
      <Link to={`/project/${task.projectId}`}>
        ← Back to Project
      </Link>

      <div
        style={{
          margin: '20px 0',
          padding: 20,
          background: '#f4f4f4',
          borderRadius: 10
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 15 }}>
          {task.title}
        </h2>

        <div
          style={{
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            fontSize: 14
          }}
        >
          <span>
            <strong>Status:</strong> {task.status}
          </span>

          <span>
            <strong>Priority:</strong> {task.priority || 'medium'}
          </span>

          <span>
            <strong>Assignee:</strong>{' '}
            {currentAssignee?.user?.name || 'Unassigned'}
          </span>

          <span>
            <strong>Due:</strong>{' '}
            {task.dueDate
              ? formatDueDate(task.dueDate)
              : 'No due date'}
          </span>
        </div>
      </div>

      <div
        style={{
          margin: '20px 0',
          padding: 15,
          background: '#f4f4f4',
          borderRadius: 8
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 style={{ marginTop: 0 }}>Description</h3>

          {!editingDescription && (
            <button
              type="button"
              onClick={() => setEditingDescription(true)}
            >
              Edit
            </button>
          )}
        </div>

        {editingDescription ? (
          <>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a task description..."
              style={{
                width: '100%',
                minHeight: 100,
                boxSizing: 'border-box',
                padding: 10,
                marginBottom: 10
              }}
            />

            <button
              type="button"
              onClick={handleSaveDescription}
              style={{ marginRight: 8 }}
            >
              Save
            </button>

            <button
              type="button"
              onClick={handleCancelDescription}
            >
              Cancel
            </button>
          </>
        ) : (
          <p style={{ marginBottom: 0 }}>
            {task.description || 'No description yet.'}
          </p>
        )}
      </div>

      <div
        style={{
          margin: '20px 0',
          padding: 15,
          background: '#f4f4f4',
          borderRadius: 8
        }}
      >
        <h3 style={{ marginTop: 0 }}>Priority</h3>

        <select
          value={priority}
          onChange={handlePriorityChange}
          style={{
            width: '100%',
            padding: 10
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div
        style={{
          margin: '20px 0',
          padding: 15,
          background: '#f4f4f4',
          borderRadius: 8
        }}
      >
        <h3 style={{ marginTop: 0 }}>Due Date</h3>

        <input
          type="date"
          value={dueDate}
          onChange={handleDueDateChange}
          style={{
            width: '100%',
            padding: 10,
            boxSizing: 'border-box'
          }}
        />

        {task.dueDate && (
          <p style={{ marginBottom: 0, fontSize: 13 }}>
            Due on <strong>{formatDueDate(task.dueDate)}</strong>
          </p>
        )}

        {!task.dueDate && (
          <p
            style={{
              marginBottom: 0,
              fontSize: 13,
              color: '#777'
            }}
          >
            No due date set.
          </p>
        )}
      </div>

      <div
        style={{
          margin: '20px 0',
          padding: 15,
          background: '#f4f4f4',
          borderRadius: 8
        }}
      >
        <h3 style={{ marginTop: 0 }}>Assignee</h3>

        <select
          value={assigneeId}
          onChange={handleAssigneeChange}
          style={{
            width: '100%',
            padding: 10
          }}
        >
          <option value="">Unassigned</option>

          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user?.name} — {member.user?.email}
            </option>
          ))}
        </select>

        {currentAssignee && (
          <p style={{ marginBottom: 0, fontSize: 13 }}>
            Assigned to <strong>{currentAssignee.user?.name}</strong>
          </p>
        )}
      </div>

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

      <div style={{ marginTop: 30, marginBottom: 20 }}>
        <button
          type="button"
          onClick={handleDeleteTask}
        >
          Delete Task
        </button>
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