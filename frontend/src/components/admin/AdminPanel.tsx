import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../utils/api';
import type { User, VectorDBStats } from '../../types';
import styles from './AdminPanel.module.css';

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef9a9a', teamlead: '#ffcc80', user: '#a5d6a7',
};

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<VectorDBStats | null>(null);
  const [tab, setTab] = useState<'users' | 'vector'>('users');
  const [newUser, setNewUser] = useState({ username: '', full_name: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try { setUsers(await adminApi.listUsers()); }
    catch (e: any) { setError(e.message); }
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await adminApi.vectorStats()); }
    catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => { loadUsers(); loadStats(); }, [loadUsers, loadStats]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await adminApi.createUser(newUser);
      setSuccess(`User '${newUser.username}' created.`);
      setNewUser({ username: '', full_name: '', password: '', role: 'user' });
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`Delete user '${username}'?`)) return;
    try {
      await adminApi.deleteUser(username);
      setUsers(prev => prev.filter(u => u.username !== username));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleResetVectorDB = async () => {
    if (!window.confirm('This will WIPE the entire vector database. Continue?')) return;
    try {
      await adminApi.resetVectorDB();
      setSuccess('Vector database wiped.');
      await loadStats();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Admin Console</h2>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'users' ? styles.activeTab : ''}`} onClick={() => setTab('users')}>👥 Users</button>
          <button className={`${styles.tab} ${tab === 'vector' ? styles.activeTab : ''}`} onClick={() => setTab('vector')}>🧠 Vector DB</button>
        </div>
      </div>

      {error   && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.successMsg}>{success}</div>}

      <div className={styles.content}>
        {tab === 'users' && (
          <>
            {/* Create user form */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Create User</h3>
              <form onSubmit={handleCreateUser} className={styles.createForm}>
                <input className={styles.input} placeholder="Username" value={newUser.username}
                  onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} required />
                <input className={styles.input} placeholder="Full name" value={newUser.full_name}
                  onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} required />
                <input className={styles.input} type="password" placeholder="Password" value={newUser.password}
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} required />
                <select className={styles.select} value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="user">User</option>
                  <option value="teamlead">Team Lead</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className={styles.createBtn} disabled={loading}>
                  {loading ? 'Creating…' : '+ Create'}
                </button>
              </form>
            </div>

            {/* User table */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>All Users ({users.length})</h3>
              <div className={styles.userTable}>
                <div className={styles.tableHead}>
                  <span>Username</span><span>Full Name</span><span>Role</span><span>Status</span><span></span>
                </div>
                {users.map(u => (
                  <div key={u.username} className={styles.tableRow}>
                    <span className={styles.mono}>{u.username}</span>
                    <span>{u.full_name}</span>
                    <span className={styles.roleBadge} style={{ color: ROLE_COLORS[u.role] }}>
                      {u.role}
                    </span>
                    <span className={u.is_active ? styles.active : styles.inactive}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                    <button className={styles.deleteUserBtn} onClick={() => handleDeleteUser(u.username)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'vector' && stats && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Vector Database Status</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.total_vectors.toLocaleString()}</span>
                <span className={styles.statLabel}>Total Vectors</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.unique_documents}</span>
                <span className={styles.statLabel}>Documents Indexed</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{stats.dimension}</span>
                <span className={styles.statLabel}>Embedding Dimension</span>
              </div>
            </div>
            <button className={styles.dangerBtn} onClick={handleResetVectorDB}>
              ⚠ Wipe Vector Database
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
