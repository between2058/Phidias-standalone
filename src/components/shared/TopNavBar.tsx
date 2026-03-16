'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Settings,
  Unplug,
  ChevronDown,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopNavBarProps {
  className?: string;
}

export default function TopNavBar({ className }: TopNavBarProps) {
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const pathname = usePathname();
  const isRoot = pathname === '/';

  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 shrink-0',
        'border-b border-border-light',
        className
      )}
      style={{ height: 52, background: 'var(--bg-darkest)' }}
    >
      {/* Left Nav */}
      <div className="flex items-center gap-1">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-3 pl-1">
          <img
            src="/phidias_logo.jpg"
            className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px]"
          />
          <span
            className="font-bold text-[15px] animate-glow-pulse"
            style={{ letterSpacing: 2 }}
          >
            PHIDIAS
          </span>
        </div>

        {/* Divider */}
        <div className="w-px bg-border-light" style={{ height: 24 }} />

        <Link
          href="/workspace/model"
          className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          onClick={() => setWsDropdownOpen(false)}
        >
          3D Workspace
        </Link>

        {/* 3D Workspace Pill */}
        {/* <div className="relative ml-1">
                    <button
                        onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white text-xs font-medium"
                        style={{ background: '#2563eb' }}
                    >
                        <Box size={14} />
                        <span>3D Workspace</span>
                        <ChevronDown size={12} />
                    </button>

                    {wsDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 w-44 rounded-lg bg-bg-card border border-border-light shadow-xl z-50 py-1">
                            <Link
                                href="/workspace/model"
                                className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                                onClick={() => setWsDropdownOpen(false)}
                            >
                                3D Workspace
                            </Link>
                            <Link
                                href="/agent"
                                className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                                onClick={() => setWsDropdownOpen(false)}
                            >
                                Agent Canvas
                            </Link>
                        </div>
                    )}
                </div> */}

        {/* Nav Links */}
        <Link
          href="/"
          className={cn(
            'px-2 py-1 text-[13px] transition-colors',
            pathname === '/'
              ? 'text-white font-semibold'
              : 'text-text-secondary hover:text-text-primary font-normal'
          )}
        >
          Home
        </Link>
        {/* <Link
                    href="/assets"
                    className="px-2 py-1 text-[13px] text-text-secondary hover:text-text-primary transition-colors"
                >
                    Assets
                </Link>
                <Link
                    href="/affiliate"
                    className="px-2 py-1 text-[13px] text-text-secondary hover:text-text-primary transition-colors"
                >
                    Affiliate Program
                </Link> */}
      </div>

      {/* Right Nav */}
      <div className="flex items-center gap-2">
        {/* DCC Bridge */}
        {/* <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-text-secondary text-xs font-medium border border-border-light hover:text-text-primary hover:border-text-secondary transition-colors">
          <Unplug size={14} />
          <span>DCC Bridge</span>
        </button> */}

        {/* Credits */}
        {/* <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: '#13304F' }}
                >
                    <div
                        className="flex items-center justify-center rounded-lg shrink-0"
                        style={{ width: 16, height: 16, background: 'var(--accent-gold)' }}
                    >
                        <span className="text-[8px] font-normal" style={{ color: '#061525' }}>⚡</span>
                    </div>
                    <span className="text-white text-xs font-semibold">300</span>
                </div> */}

        {/* Upgrade Button */}
        {/* <button
                    className="flex items-center px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'var(--accent-gold)', color: '#0E243E' }}
                >
                    Upgrade
                </button> */}

        {/* Bell */}
        {isRoot && <button className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
          <Bell size={16} />
        </button>}

        {/* Settings */}
        {isRoot && <button className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
          <Settings size={16} />
        </button>}

        {/* User Avatar */}
        <div
          className="flex items-center justify-center rounded-full text-white text-[11px] font-semibold cursor-pointer select-none"
          style={{ width: 32, height: 32, background: '#7c5cfc' }}
        >
          JD
        </div>
      </div>
    </header>
  );
}
