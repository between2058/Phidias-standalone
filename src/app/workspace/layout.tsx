'use client';

import TopNavBar from '@/components/shared/TopNavBar';
import LeftIconSidebar from '@/components/shared/LeftIconSidebar';
import AssetsPanel from '@/components/shared/AssetsPanel';
import { WorkspaceProvider } from '@/lib/workspace-context';
import { ImageOverlay } from '@/components/shared';
import { usePhidiasStore } from '@/store/phidias-store';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  function getHostApp() {
    const { hostApp } = usePhidiasStore.getState();
    return hostApp;
  }
  const hostApp = getHostApp();

  return (
    <WorkspaceProvider>
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
    </WorkspaceProvider>
  );
}
