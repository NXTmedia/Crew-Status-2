import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CrewDashboard } from './pages/CrewDashboard';
import { StationDashboard } from './pages/StationDashboard';

// Helper component to handle initial redirect based on LS
const InitialRedirect: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const isLaView = localStorage.getItem('RNLI_LA_VIEW') === 'true';
    if (isLaView && window.location.hash === '#/') {
       navigate('/station', { replace: true });
    }
  }, [navigate]);
  return null;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <InitialRedirect />
      <Layout>
        <Routes>
          <Route path="/" element={<CrewDashboard />} />
          <Route path="/station" element={<StationDashboard />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;