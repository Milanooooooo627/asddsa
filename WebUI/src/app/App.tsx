import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { router } from './routes';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <div className="w-screen h-screen bg-[#0a0a0a] flex items-center justify-center p-0 m-0 overflow-hidden">
        <div className="w-[720px] h-[420px] shrink-0 grow-0 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-[#1a1a1a]">
          {isLoading ? <LoadingScreen /> : <RouterProvider router={router} />}
        </div>
      </div>
    </AuthProvider>
  );
}