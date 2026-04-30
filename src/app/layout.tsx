import type { Metadata } from 'next';
import './globals.css';
import { ConfigProvider, createConfigStandalone } from '@/config';
import { WorkspaceProvider } from '@/lib/workspace-context';
import { AgentLiveProvider } from '@/components/agent/AgentLiveProvider';

export const metadata: Metadata = {
  title: 'Phidias — AI-native 3D Workspace',
  description: 'Describe it. Scan it. Build with it.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className="antialiased h-full font-sans"
        style={{ background: '#1a1a2e', color: '#ffffff' }}
      >
        <ConfigProvider config={createConfigStandalone()}>
          <WorkspaceProvider>
            <AgentLiveProvider>
              {children}
            </AgentLiveProvider>
          </WorkspaceProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
