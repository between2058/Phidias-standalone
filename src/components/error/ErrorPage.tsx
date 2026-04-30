import React from 'react';

interface ErrorPageProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

/**
 * ErrorPage Component
 *
 * Displays a full-screen error state for the Phidias Web Component.
 * Used by ErrorBoundary when React render errors occur.
 */
export function ErrorPage({
  title = 'Phidias 載入失敗',
  message = '初始化時發生錯誤，請重新整理頁面或聯絡管理員',
  icon = '⚠️',
}: ErrorPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#1a1a2e',
        color: '#94a3b8',
        fontSize: 13,
        flexDirection: 'column',
        gap: 8,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48 }}>{icon}</div>
      <span style={{ color: '#ef4444', fontWeight: 600 }}>{title}</span>
      <span style={{ color: '#94a3b8' }}>{message}</span>
    </div>
  );
}

export default ErrorPage;
