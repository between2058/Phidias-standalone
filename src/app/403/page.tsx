export default function ForbiddenPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1a1a2e',
        color: '#ef4444',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '4rem', margin: 0 }}>403</h1>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>
        This page is not accessible in the current mode.
      </p>
    </div>
  );
}