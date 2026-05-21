import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Coproprietes from './pages/Coproprietes';
import Charges from './pages/Charges';
import Assemblees from './pages/Assemblees';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/coproprietes" element={<Coproprietes />} />
        <Route path="/charges" element={<Charges />} />
        <Route path="/assemblees" element={<Assemblees />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
