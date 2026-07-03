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
import AdminCopropietaires from './pages/admin/AdminCopropietaires';
import AdminCotisations from './pages/admin/AdminCotisations';
import AdminTickets from './pages/admin/AdminTickets';
import AdminBudgets from './pages/admin/AdminBudgets';
import AdminCommunications from './pages/admin/AdminCommunications';

// Gestionnaire pages
import GestDashboard from './pages/gestionnaire/GestDashboard';
import Copropietaires from './pages/gestionnaire/Copropietaires';
import Finances from './pages/gestionnaire/Finances';
import Messages from './pages/gestionnaire/Messages';
import GestTickets from './pages/gestionnaire/Tickets';
import Budget from './pages/gestionnaire/Budget';
import Cotisations from './pages/gestionnaire/Cotisations';
import Lots from './pages/gestionnaire/Lots';
import Fournisseurs from './pages/gestionnaire/Fournisseurs';

// Copropriétaire pages
import MonProfil from './pages/copropietaire/MonProfil';
import MaResidence from './pages/copropietaire/MaResidence';
import MesCotisations from './pages/copropietaire/MesCotisations';
import MesTickets from './pages/copropietaire/MesTickets';
import MesMessages from './pages/copropietaire/MesMessages';

// Membre bureau pages
import MembreBureauLayout from './components/MembreBureauLayout';
import MBDashboard from './pages/membre_bureau/MBDashboard';
import MBFinances from './pages/membre_bureau/MBFinances';
import MBBudget from './pages/membre_bureau/MBBudget';
import MBCotisations from './pages/membre_bureau/MBCotisations';

// Admin: membres bureau
import MembresBureau from './pages/admin/MembresBureau';

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
  if (user.role === 'membre_bureau') return <Navigate to="/membre-bureau" replace />;
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
        <Route path="copropietaires" element={<AdminCopropietaires />} />
        <Route path="cotisations" element={<AdminCotisations />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="budgets" element={<AdminBudgets />} />
        <Route path="communications" element={<AdminCommunications />} />
        <Route path="membres-bureau" element={<MembresBureau />} />
      </Route>

      {/* Gestionnaire */}
      <Route path="/gestionnaire" element={<GestionnaireLayout />}>
        <Route index element={<GestDashboard />} />
        <Route path="copropietaires" element={<Copropietaires />} />
        <Route path="cotisations" element={<Cotisations />} />
        <Route path="finances" element={<Finances />} />
        <Route path="budget" element={<Budget />} />
        <Route path="messages" element={<Messages />} />
        <Route path="tickets" element={<GestTickets />} />
        <Route path="lots" element={<Lots />} />
        <Route path="fournisseurs" element={<Fournisseurs />} />
      </Route>

      {/* Membre bureau syndical */}
      <Route path="/membre-bureau" element={<MembreBureauLayout />}>
        <Route index element={<MBDashboard />} />
        <Route path="finances" element={<MBFinances />} />
        <Route path="budget" element={<MBBudget />} />
        <Route path="cotisations" element={<MBCotisations />} />
      </Route>

      {/* Copropriétaire */}
      <Route path="/copropietaire" element={<CopropietaireLayout />}>
        <Route index element={<MonProfil />} />
        <Route path="residence" element={<MaResidence />} />
        <Route path="cotisations" element={<MesCotisations />} />
        <Route path="tickets" element={<MesTickets />} />
        <Route path="messages" element={<MesMessages />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
