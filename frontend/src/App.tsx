import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { ActiveTab, Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { AddMedicationTab } from './components/AddMedicationTab';

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-50">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-sage-600 text-white flex items-center justify-center mx-auto animate-pulse font-bold">
            V
          </div>
          <p className="text-sm text-slate-500">Завантаження трекера...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-sage-50 flex flex-col">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' ? (
          <DashboardTab
            onNavigateToAdd={() => setActiveTab('add-medication')}
          />
        ) : (
          <AddMedicationTab
            onCreatedSuccess={() => setActiveTab('dashboard')}
          />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

export default App;
