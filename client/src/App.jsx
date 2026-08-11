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
const HistoriaPage = lazy(() => import('./views/HistoriaPage.jsx'))
const TerminosPage = lazy(() => import('./views/legal/TerminosPage.jsx'))
const PrivacyPage = lazy(() => import('./views/legal/PrivacyPage.jsx'))
const RegistroPaciente = lazy(() => import('./views/RegistroPaciente.jsx'))
const RegistroProfesional = lazy(() => import('./views/RegistroProfesional.jsx'))
const LoginPaciente = lazy(() => import('./views/LoginPaciente.jsx'))
const LoginMedico = lazy(() => import('./views/LoginMedico.jsx'))
const ActivarCuenta = lazy(() => import('./views/ActivarCuenta.jsx'))
const DashboardCliente = lazy(() => import('./views/paciente/DashboardCliente.jsx'))
const NuevaCita = lazy(() => import('./views/paciente/NuevaCita.jsx'))
const Agenda = lazy(() => import('./views/gestor/Agenda.jsx'))
const Disponibilidad = lazy(() => import('./views/gestor/Disponibilidad.jsx'))
const Pacientes = lazy(() => import('./views/gestor/Pacientes.jsx'))
const Equipo = lazy(() => import('./views/gestor/Equipo.jsx'))
const ActualizarPro = lazy(() => import('./views/gestor/ActualizarPro.jsx'))

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
        <Route path="/historia" element={<HistoriaPage />} />
        <Route path="/nuestra-historia" element={<HistoriaPage />} />
        {/* Rutas canónicas SIN terminología médica. Las variantes con términos de
            salud (-medico, -paciente) se mantienen como REDIRECCIÓN silenciosa para
            no romper enlaces guardados/compartidos; nunca dan error, solo redirigen. */}
        {/* Registro de cliente vinculado a un profesional por su enlace propio.
            El profesionalId viaja implícito en el slug de la URL. */}
        <Route path="/reservar/:slug" element={<RegistroPaciente />} />
        {/* Rutas genéricas (sin slug): ya no permiten crear clientes huérfanos;
            muestran un aviso pidiendo el enlace del profesional. */}
        <Route path="/registro-cliente" element={<RegistroPaciente />} />
        <Route path="/registro-paciente" element={<Navigate to="/registro-cliente" replace />} />
        <Route path="/registro-profesional" element={<RegistroProfesional />} />
        <Route path="/registro-medico" element={<Navigate to="/registro-profesional" replace />} />
        <Route path="/login-cliente" element={<LoginPaciente />} />
        <Route path="/login-paciente" element={<Navigate to="/login-cliente" replace />} />
        <Route path="/login-profesional" element={<LoginMedico />} />
        <Route path="/login-medico" element={<Navigate to="/login-profesional" replace />} />
        <Route path="/activar-cuenta" element={<ActivarCuenta />} />

        {/* Cliente (rutas canónicas). Las /paciente/* redirigen a /cliente/*. */}
        <Route
          path="/cliente/citas"
          element={
            <ProtectedRoute rol="PACIENTE">
              <DashboardCliente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cliente/nueva-cita"
          element={
            <ProtectedRoute rol="PACIENTE">
              <NuevaCita />
            </ProtectedRoute>
          }
        />
        <Route path="/paciente/citas" element={<Navigate to="/cliente/citas" replace />} />
        <Route path="/paciente/nueva-cita" element={<Navigate to="/cliente/nueva-cita" replace />} />

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
          <Route path="clientes" element={<Pacientes />} />
          {/* /gestor/pacientes: alias con término de salud → redirige a /gestor/clientes. */}
          <Route path="pacientes" element={<Navigate to="/gestor/clientes" replace />} />
          {/* "Actualizar a Pro": solo llegan aquí cuentas Básicas desde el menú.
              La propia vista redirige a "equipo" si ya es Pro. */}
          <Route path="pro" element={<ActualizarPro />} />
          {/* Equipo: solo tiene sentido en cuentas Pro; el backend protege sus
              endpoints con 403 y el nav solo muestra el enlace si esNegocioPro. */}
          <Route path="equipo" element={<Equipo />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
