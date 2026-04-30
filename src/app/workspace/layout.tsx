'use client';

import TopNavBar from '@/components/shared/TopNavBar';
import LeftIconSidebar from '@/components/shared/LeftIconSidebar';
import AssetsPanel from '@/components/shared/AssetsPanel';
import { ImageOverlay } from '@/components/shared/ImageOverlay';
import { usePhidiasStore } from '@/store/phidias-store';
import { useJobPolling } from '@/hooks/useJobManager';
import { useMcpBridge } from '@/hooks/useMcpBridge';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  function getHostApp() {
    const { hostApp } = usePhidiasStore.getState();
    return hostApp;
  }
  const hostApp = getHostApp();

  // Start job polling for the entire workspace
  useJobPolling();

  // Connect to MCP bridge server for Claude Code integration
  useMcpBridge();

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
        {hostApp === 'standalone' && <TopNavBar />}
        <div className="flex flex-1 overflow-hidden">
          <LeftIconSidebar />
          <main className="flex-1 overflow-hidden">{children}</main>
          <AssetsPanel />
        </div>
      </div>
      {/* Full-screen image overlay — shared across all workspace pages */}
      <ImageOverlay />
    </>
  );
}
