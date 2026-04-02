import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProcessList from './components/ProcessList';
import ProcessDetails from './components/ProcessDetails';
import KnowledgeBase from './components/KnowledgeBase';
import ChatPanel from './components/ChatPanel';
import Login from './components/Login';
import DataExplorer from './components/DataExplorer';
import InsightsPanel from './components/InsightsPanel';
import AccuracyPanel from './components/AccuracyPanel';
import PeoplePage from './components/People';
import TasksView from './components/TasksView';
import HomePage from './components/HomePage';
import SettingsPage from './components/SettingsPage';
import ErrorBoundary from './components/ErrorBoundary';

import { useNavigate as useNav } from 'react-router-dom';
const KnowledgeBasePage = () => {
  const nav = useNav();
  return <KnowledgeBase embedded onClose={() => nav('/done/tasks')} />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/done" element={<DashboardLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="processes" element={<ProcessList />} />
          <Route path="knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="process/:runId" element={<ErrorBoundary><ProcessDetails /></ErrorBoundary>} />
          <Route path="data" element={<DataExplorer />} />
          <Route path="insights" element={<InsightsPanel />} />
          <Route path="accuracy" element={<AccuracyPanel />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="tasks" element={<TasksView />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatPanel />
    </BrowserRouter>
  );
}

export default App;
