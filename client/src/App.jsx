import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import GestorLayout from './components/GestorLayout.jsx'

import LandingPage from './views/LandingPage.jsx'
import TerminosPage from './views/legal/TerminosPage.jsx'
import PrivacyPage from './views/legal/PrivacyPage.jsx'
import RegistroPaciente from './views/RegistroPaciente.jsx'
import LoginPaciente from './views/LoginPaciente.jsx'
import LoginMedico from './views/LoginMedico.jsx'

import DashboardCliente from './views/paciente/DashboardCliente.jsx'
import NuevaCita from './views/paciente/NuevaCita.jsx'

import Agenda from './views/gestor/Agenda.jsx'
import Disponibilidad from './views/gestor/Disponibilidad.jsx'
import Pacientes from './views/gestor/Pacientes.jsx'

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />

      {/* Legal (con alias multi-idioma) */}
      <Route path="/terminos" element={<TerminosPage />} />
      <Route path="/terms" element={<TerminosPage />} />
      <Route path="/conditions" element={<TerminosPage />} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/politique-confidentialite" element={<PrivacyPage />} />
      <Route path="/registro-paciente" element={<RegistroPaciente />} />
      <Route path="/login-paciente" element={<LoginPaciente />} />
      <Route path="/login-medico" element={<LoginMedico />} />

      {/* Paciente */}
      <Route
        path="/paciente/citas"
        element={
          <ProtectedRoute rol="PACIENTE">
            <DashboardCliente />
          </ProtectedRoute>
        }
      />
      <Route
        path="/paciente/nueva-cita"
        element={
          <ProtectedRoute rol="PACIENTE">
            <NuevaCita />
          </ProtectedRoute>
        }
      />

      {/* Gestor (layout con pestañas) */}
      <Route
        path="/gestor"
        element={
          <ProtectedRoute rol="MEDICO">
            <GestorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="agenda" replace />} />
        <Route path="agenda" element={<Agenda />} />
        {/* /gestor/citas-pendientes se integró en la agenda (calendario) */}
        <Route path="citas-pendientes" element={<Navigate to="/gestor/agenda" replace />} />
        <Route path="disponibilidad" element={<Disponibilidad />} />
        <Route path="pacientes" element={<Pacientes />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
