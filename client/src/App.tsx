import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Users from './pages/Users';
import UserEdit from './pages/UserEdit';
import Settings from './pages/Settings';
import { useEffect, useState } from 'react';
import api from './api/client';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.isAdmin) return <Navigate to={`/users/${user.sAMAccountName}`} replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    api.getStatus().then(({ configured }) => setConfigured(configured)).catch(() => setConfigured(false));
  }, []);

  if (loading || configured === null) return <LoadingScreen />;

  if (!configured && !user) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup onComplete={() => setConfigured(true)} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/setup" element={<ProtectedRoute adminOnly><Setup onComplete={() => {}} /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={
          user?.isAdmin ? <Navigate to="/users" replace /> : <Navigate to={`/users/${user?.sAMAccountName}`} replace />
        } />
        <Route path="/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
        <Route path="/users/:username" element={<UserEdit />} />
        <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
