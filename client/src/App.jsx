import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import GestorLayout from './components/GestorLayout.jsx'
import Spinner from './components/Spinner.jsx'
import LandingPage from './views/LandingPage.jsx' // eager: primera pintura

// Code-splitting por ruta: cada vista se carga bajo demanda para reducir el
// bundle inicial.
const ContactoPage = lazy(() => import('./views/ContactoPage.jsx'))
const FAQPage = lazy(() => import('./views/FAQPage.jsx'))
const TerminosPage = lazy(() => import('./views/legal/TerminosPage.jsx'))
const PrivacyPage = lazy(() => import('./views/legal/PrivacyPage.jsx'))
const RegistroPaciente = lazy(() => import('./views/RegistroPaciente.jsx'))
const RegistroProfesional = lazy(() => import('./views/RegistroProfesional.jsx'))
const LoginPaciente = lazy(() => import('./views/LoginPaciente.jsx'))
const LoginMedico = lazy(() => import('./views/LoginMedico.jsx'))
const DashboardCliente = lazy(() => import('./views/paciente/DashboardCliente.jsx'))
const NuevaCita = lazy(() => import('./views/paciente/NuevaCita.jsx'))
const Agenda = lazy(() => import('./views/gestor/Agenda.jsx'))
const Disponibilidad = lazy(() => import('./views/gestor/Disponibilidad.jsx'))
const Pacientes = lazy(() => import('./views/gestor/Pacientes.jsx'))

function Cargando() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Cargando />}>
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
        <Route path="/contacto" element={<ContactoPage />} />
        <Route path="/contact" element={<ContactoPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/ayuda" element={<FAQPage />} />
        <Route path="/registro-paciente" element={<RegistroPaciente />} />
        <Route path="/registro-profesional" element={<RegistroProfesional />} />
        <Route path="/registro-medico" element={<RegistroProfesional />} />
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
    </Suspense>
  )
}
