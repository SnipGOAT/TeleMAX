import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { Messenger } from '@/components/Messenger';
import { setOnlineStatus } from '@/lib/chat';
import { Loader2 } from 'lucide-react';
import { TelemaxLogo } from '@/components/TelemaxLogo';

function AppContent() {
  const { session, profile, loading } = useAuth();

  // Update online status on mount/unmount
  useEffect(() => {
    if (session?.user && profile) {
      setOnlineStatus(session.user.id, true);

      const handleVisibility = () => {
        setOnlineStatus(session.user.id, !document.hidden);
      };

      const handleBeforeUnload = () => {
        setOnlineStatus(session.user.id, false);
      };

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        setOnlineStatus(session.user.id, false);
      };
    }
  }, [session, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 z-10">
        <TelemaxLogo size={64} />
        <Loader2 size={24} className="animate-spin text-primary-400" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <Messenger />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
