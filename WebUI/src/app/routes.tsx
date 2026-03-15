import { createBrowserRouter, Navigate } from 'react-router';
import type { PropsWithChildren } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { DashboardLayout } from './components/DashboardLayout';
import { Library } from './pages/Library';
import { ProductConfig } from './pages/ProductConfig';
import { ProductDetail } from './pages/ProductDetail';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { OwnerPanel } from './pages/OwnerPanel';
import { useAuth } from './context/AuthContext';

function GuestOnly() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/library" replace />;
  }
  return <LoginScreen />;
}

function RequireAuth({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function RequireOwner() {
  const { isOwner } = useAuth();
  if (!isOwner) {
    return <Navigate to="/library" replace />;
  }
  return <OwnerPanel />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <GuestOnly />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: 'library',
        element: <Library />,
      },
      {
        path: 'library/:productId',
        element: <ProductDetail />,
      },
      {
        path: 'library/:productId/config',
        element: <ProductConfig />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'profile',
        element: <Profile />,
      },
      {
        path: 'owner',
        element: <RequireOwner />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);