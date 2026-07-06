import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Logo / Brand */}
        <div className={styles.brand}>
          <div className={styles.logo}>
            <svg viewBox="0 0 40 40" fill="none" width={40} height={40}>
              <rect width="40" height="40" rx="10" fill="#1a3a5c"/>
              <path d="M8 28V14l12-6 12 6v14l-12 5-12-5z" fill="none" stroke="#4fc3f7" strokeWidth="1.5"/>
              <path d="M14 20h12M20 14v12" stroke="#4fc3f7" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className={styles.title}>BankIQ</h1>
          <p className={styles.subtitle}>Secure Document Intelligence</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>Username</label>
            <input
              id="username"
              type="text"
              className={styles.input}
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="Enter your username"
              autoComplete="username"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? <span className={styles.spinner}/> : 'Sign In'}
          </button>
        </form>

        <div className={styles.demoHint}>
          <p>Demo credentials</p>
          <div className={styles.demoGrid}>
            <span className={`${styles.badge} ${styles.admin}`}>admin / admin123</span>
            <span className={`${styles.badge} ${styles.lead}`}>lead / lead123</span>
            <span className={`${styles.badge} ${styles.user}`}>analyst / analyst123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
