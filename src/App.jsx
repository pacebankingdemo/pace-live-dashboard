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
import ErrorBoundary from './components/ErrorBoundary';

// Clutch-specific components
import ClutchLayout from './components/clutch/ClutchLayout';
import ClutchProcessList from './components/clutch/ClutchProcessList';
import ClutchProcessDetails from './components/clutch/ClutchProcessDetails';
import ClutchAccuracyPanel from './components/clutch/AccuracyPanel';
import ClutchPeople from './components/clutch/People';
import ClutchKnowledgeBase from './components/clutch/KnowledgeBase';
import ClutchDataPage from './components/clutch/DataPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Standard dashboard for all orgs except Clutch */}
        <Route path="/done" element={<DashboardLayout />}>
          <Route index element={<Navigate to="processes" replace />} />
          <Route path="processes" element={<ProcessList />} />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="process/:runId" element={<ErrorBoundary><ProcessDetails /></ErrorBoundary>} />
          <Route path="data" element={<DataExplorer />} />
          <Route path="insights" element={<InsightsPanel />} />
          <Route path="accuracy" element={<AccuracyPanel />} />
          <Route path="people" element={<PeoplePage />} />
        </Route>

        {/* Clutch-specific dashboard */}
        <Route path="/clutch" element={<ClutchLayout />}>
          <Route index element={<Navigate to="batch-record-review" replace />} />
          <Route path="batch-record-review" element={<ClutchProcessList />} />
          <Route path="batch-record-review/process/:id" element={<ErrorBoundary><ClutchProcessDetails /></ErrorBoundary>} />
          <Route path="knowledge-base" element={<ClutchKnowledgeBase />} />
          <Route path="accuracy" element={<ClutchAccuracyPanel />} />
          <Route path="people" element={<ClutchPeople />} />
          <Route path="data" element={<ClutchDataPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatPanel />
    </BrowserRouter>
  );
}

export default App;
