import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import styles from './AppShell.module.css';

type View = 'chat' | 'documents' | 'onedrive' | 'admin';

interface AppShellProps {
  children: (view: View) => React.ReactNode;
}

const NAV_ITEMS: Array<{ id: View; label: string; icon: string; roles: string[] }> = [
  { id: 'chat',      label: 'Chat',      icon: '💬', roles: ['admin','teamlead','user'] },
  { id: 'documents', label: 'Documents', icon: '📄', roles: ['admin','teamlead','user'] },
  { id: 'onedrive',  label: 'OneDrive',  icon: '☁️',  roles: ['admin','teamlead'] },
  { id: 'admin',     label: 'Admin',     icon: '⚙️',  roles: ['admin'] },
];

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef9a9a',
  teamlead: '#ffcc80',
  user: '#a5d6a7',
};

export default function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const visibleItems = NAV_ITEMS.filter(
    item => user && item.roles.includes(user.role)
  );

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.collapsed}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandMark}>
            <svg viewBox="0 0 32 32" width={28} height={28}>
              <rect width="32" height="32" rx="8" fill="#1a3a5c"/>
              <path d="M6 22V11l10-5 10 5v11l-10 4-10-4z" fill="none" stroke="#4fc3f7" strokeWidth="1.5"/>
              <path d="M11 16h10M16 11v10" stroke="#4fc3f7" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          {sidebarOpen && <span className={styles.brandName}>BankIQ</span>}
        </div>

        <nav className={styles.nav}>
          {visibleItems.map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${view === item.id ? styles.active : ''}`}
              onClick={() => setView(item.id)}
              title={item.label}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {sidebarOpen && <span className={styles.navLabel}>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {user && (
            <div className={styles.userCard}>
              <div className={styles.avatar}>{user.full_name[0]}</div>
              {sidebarOpen && (
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.full_name}</span>
                  <span className={styles.userRole} style={{ color: ROLE_COLORS[user.role] }}>
                    {user.role}
                  </span>
                </div>
              )}
            </div>
          )}
          <button
            className={styles.logoutBtn}
            onClick={logout}
            title="Sign out"
          >
            <span>🚪</span>
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Toggle button */}
      <button
        className={styles.toggleBtn}
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? '‹' : '›'}
      </button>

      {/* Main content */}
      <main className={styles.main}>
        {children(view)}
      </main>
    </div>
  );
}
