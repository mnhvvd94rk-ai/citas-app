import { Component } from 'react'

// Red de seguridad: captura cualquier error de render inesperado en el árbol y
// muestra una pantalla amigable con opción de recargar, en vez de una pantalla
// en blanco silenciosa. Es un componente de clase porque los error boundaries
// solo pueden implementarse así en React.
//
// Va por ENCIMA de los providers/router (sin acceso a i18n), por eso el texto es
// estático y sencillo.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log para diagnóstico (visible en la consola del navegador).
    console.error('[ErrorBoundary] Error de render capturado:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Inter',system-ui,sans-serif",
          background: '#f1f5f9',
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: '100%',
            background: '#fff',
            borderRadius: 16,
            padding: 28,
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15,23,42,.08)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1e3a5f', margin: '0 0 8px' }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
            Ocurrió un problema al mostrar la página. Vuelve a cargarla para continuar.
            <br />
            <span style={{ color: '#94a3b8' }}>Something went wrong. Please reload the page.</span>
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%',
              background: '#1e3a5f',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 0',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recargar / Reload
          </button>
        </div>
      </div>
    )
  }
}
