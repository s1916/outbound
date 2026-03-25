import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RecordList from './pages/RecordList';
import RecordForm from './pages/RecordForm';
import AdminLogs from './pages/AdminLogs';

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">加载中...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Wait until user is fully loaded before checking role
  if (!user) {
     return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">获取用户信息中...</div>;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Login Route Component
const LoginRoute = () => {
  const { token, user, isLoading } = useAuth();
  
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">加载中...</div>;
  
  // If already logged in, redirect to dashboard
  if (token && user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Login />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="records" element={<RecordList />} />
        <Route path="records/new" element={<RecordForm />} />
        <Route path="records/:id/edit" element={<RecordForm />} />
        
        {/* Admin only routes */}
        <Route path="admin/logs" element={
          <ProtectedRoute requireAdmin={true}>
            <AdminLogs />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;