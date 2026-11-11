/** Pantalla mínima si un error de render rompe toda la app (Sentry.ErrorBoundary). */
export function AppErrorFallback() {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '1.5rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Algo salió mal</h1>
      <p style={{ margin: 0 }}>Ocurrió un error inesperado. Probá recargar la página.</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        Recargar
      </button>
    </div>
  );
}
