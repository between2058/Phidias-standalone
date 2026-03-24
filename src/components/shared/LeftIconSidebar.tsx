'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, Sparkles, Scissors, Paintbrush, Bell, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarTab {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const tabs: SidebarTab[] = [
  { icon: <Camera size={20} />, label: 'Image', href: '/workspace/image' },
  { icon: <Sparkles size={20} />, label: 'Model', href: '/workspace/model' },
  {
    icon: <Scissors size={20} />,
    label: 'Segment',
    href: '/workspace/segment',
  },
  {
    icon: <Paintbrush size={20} />,
    label: 'Texture',
    href: '/workspace/texture',
  },
  //   { icon: <Atom size={20} />, label: 'Physics', href: '/workspace/physics' },
  //   { icon: <Clapperboard size={20} />, label: 'Scene', href: '/workspace/scene' },
  //   { icon: <Globe size={20} />, label: '3D World', href: '/workspace/world' },
];

export default function LeftIconSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col items-center bg-bg-darkest border-r border-[#333355] shrink-0 py-4 gap-1 h-full"
      style={{ width: 56 }}
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname?.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 w-full py-2 transition-colors group',
              isActive
                ? 'text-white'
                : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {/* Active gold underline indicator */}
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                style={{
                  height: '70%',
                  background: 'var(--accent-gold)',
                }}
              />
            )}

            <span
              className={cn(
                'transition-colors',
                isActive
                  ? 'text-white'
                  : 'text-text-tertiary group-hover:text-text-secondary',
              )}
            >
              {tab.icon}
            </span>
            <span
              className={cn(
                'text-[9px] font-medium leading-none transition-colors text-center',
                isActive
                  ? 'text-white'
                  : 'text-text-tertiary group-hover:text-text-secondary',
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}

      <div className="flex-1" />

      {/* Bell */}
      <button className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors mt-2 my-2">
        <Bell size={16} />
      </button>

      {/* Settings */}
      <button className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
        <Settings size={16} />
      </button>
    </aside>
  );
}
