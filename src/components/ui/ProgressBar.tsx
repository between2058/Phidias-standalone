'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  percent: number;
  stage: string;
  className?: string;
  color?: 'gold' | 'green' | 'purple' | 'blue';
}

export function ProgressBar({
  percent,
  stage,
  className,
  color = 'gold',
}: ProgressBarProps) {
  const gradients: Record<string, string> = {
    gold: 'from-[#f5a623] to-[#22c55e]',
    green: 'from-[#22c55e] to-[#84cc16]',
    purple: 'from-[#7c3aed] to-[#3b82f6]',
    blue: 'from-[#3b82f6] to-[#06b6d4]',
  };

  return (
    <div
      className={cn(
        'space-y-2 p-4 bg-[#252542] rounded-xl border border-[#333355]',
        className,
      )}
    >
      <div className="flex justify-between text-sm">
        <span className="text-[#94a3b8] text-xs truncate">{stage}</span>
        <span className="text-white font-mono text-xs ml-2 shrink-0">
          {percent}%
        </span>
      </div>
      <div className="h-2 bg-[#333355] rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full bg-gradient-to-r rounded-full transition-all duration-300',
            gradients[color],
          )}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
  infoIcon?: boolean;
  crown?: boolean;
  badge?: string;
  id?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  sublabel,
  infoIcon,
  crown,
  badge,
  id,
}: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
        {crown && <span className="text-[#f5a623] text-xs shrink-0">👑</span>}
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm text-[#e2e8f0]">{label}</span>
            {badge && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-500/20 text-pink-400">
                {badge}
              </span>
            )}
          </div>
          {sublabel && (
            <p className="text-xs text-[#64748b] leading-tight">{sublabel}</p>
          )}
        </div>
        {infoIcon && (
          <span
            className="text-[#64748b] text-xs cursor-help shrink-0 ml-1"
            title="Learn more"
          >
            ⓘ
          </span>
        )}
      </div>
      <button
        data-testid={id}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 transition-colors"
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? '#3b82f6' : '#4b5563',
        }}
      >
        <div
          className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200"
          style={{ left: checked ? 21 : 3 }}
        />
      </button>
    </div>
  );
}

interface PillGroupProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function PillGroup({
  options,
  value,
  onChange,
  className,
}: PillGroupProps) {
  return (
    <div className={cn('flex bg-[#252542] rounded-lg p-1 gap-1', className)}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 py-1.5 text-xs rounded-md transition-colors font-medium',
            value === opt
              ? 'bg-[#7c3aed] text-white'
              : 'text-[#94a3b8] hover:text-white hover:bg-[#333355]',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  crown?: boolean;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  crown,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-[#333355]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2.5 text-sm font-medium text-white text-left"
      >
        <span className="flex items-center gap-1">
          {crown && <span className="text-[#f5a623] text-xs">👑</span>}
          {title}
        </span>
        <span
          className="text-[#64748b] transition-transform duration-200 text-xs inline-block"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}
