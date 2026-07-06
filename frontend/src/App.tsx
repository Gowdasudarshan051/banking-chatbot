import React from 'react';
import { AuthProvider, useAuth } from './store/AuthContext';
import Login from './components/auth/Login';
import AppShell from './components/layout/AppShell';
import ChatPanel from './components/chat/ChatPanel';
import DocumentsPanel from './components/documents/DocumentsPanel';
import OneDrivePanel from './components/documents/OneDrivePanel';
import AdminPanel from './components/admin/AdminPanel';
import './global.css';

function AppContent() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Login />;
  return (
    <AppShell>
      {(view) => {
        switch (view) {
          case 'chat':      return <ChatPanel />;
          case 'documents': return <DocumentsPanel />;
          case 'onedrive':  return <OneDrivePanel />;
          case 'admin':     return <AdminPanel />;
          default:          return <ChatPanel />;
        }
      }}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
