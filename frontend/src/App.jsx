import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Public
import Login from './pages/Login';

// Layouts
import AdminLayout from './components/AdminLayout';
import GestionnaireLayout from './components/GestionnaireLayout';
import CopropietaireLayout from './components/CopropietaireLayout';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import Residences from './pages/admin/Residences';
import Gestionnaires from './pages/admin/Gestionnaires';

// Gestionnaire pages
import GestDashboard from './pages/gestionnaire/GestDashboard';
import Copropietaires from './pages/gestionnaire/Copropietaires';
import Finances from './pages/gestionnaire/Finances';
import Messages from './pages/gestionnaire/Messages';
import GestTickets from './pages/gestionnaire/Tickets';

// Copropriétaire pages
import MonProfil from './pages/copropietaire/MonProfil';
import MaResidence from './pages/copropietaire/MaResidence';
import MesCotisations from './pages/copropietaire/MesCotisations';
import MesTickets from './pages/copropietaire/MesTickets';

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'gestionnaire') return <Navigate to="/gestionnaire" replace />;
  return <Navigate to="/copropietaire" replace />;
}

function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Admin */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="residences" element={<Residences />} />
        <Route path="gestionnaires" element={<Gestionnaires />} />
      </Route>

      {/* Gestionnaire */}
      <Route path="/gestionnaire" element={<GestionnaireLayout />}>
        <Route index element={<GestDashboard />} />
        <Route path="copropietaires" element={<Copropietaires />} />
        <Route path="finances" element={<Finances />} />
        <Route path="messages" element={<Messages />} />
        <Route path="tickets" element={<GestTickets />} />
      </Route>

      {/* Copropriétaire */}
      <Route path="/copropietaire" element={<CopropietaireLayout />}>
        <Route index element={<MonProfil />} />
        <Route path="residence" element={<MaResidence />} />
        <Route path="cotisations" element={<MesCotisations />} />
        <Route path="tickets" element={<MesTickets />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
