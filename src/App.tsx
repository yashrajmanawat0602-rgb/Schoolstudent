import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LoginView } from './components/LoginView.tsx';
import { VoiceAssistantWidget } from './components/VoiceAssistantWidget.tsx';
import { ToastProvider } from './components/ui/ToastAndModal.tsx';
import { DashboardLayout } from './layouts/DashboardLayout.tsx';

const RootRouter: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm">
        Loading Macro Vision Academy Burhanpur...
      </div>
    );
  }

  return (
    <>
      {user ? <DashboardLayout /> : <LoginView />}
      <VoiceAssistantWidget />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <RootRouter />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
