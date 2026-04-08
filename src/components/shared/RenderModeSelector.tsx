'use client';

import { cn } from '@/lib/utils';
import type { RenderMode } from '@/components/shared/ThreeViewport';
import { Box, Grid3x3, Eye, Layers, Hexagon } from 'lucide-react';

/** Icon and tooltip for each render mode */
const MODE_META: Record<RenderMode, { icon: React.ElementType; label: string }> = {
  textured: { icon: Eye, label: 'Textured' },
  solid: { icon: Box, label: 'Solid' },
  wireframe: { icon: Grid3x3, label: 'Wireframe' },
  normal: { icon: Hexagon, label: 'Normal' },
  matcap: { icon: Layers, label: 'Matcap' },
};

interface RenderModeSelectorProps {
  availableModes: RenderMode[];
  current: RenderMode;
  onChange: (mode: RenderMode) => void;
  className?: string;
}

export default function RenderModeSelector({
  availableModes,
  current,
  onChange,
  className,
}: RenderModeSelectorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg p-0.5',
        className,
      )}
      style={{ background: 'rgba(20, 20, 40, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      {availableModes.map((mode) => {
        const { icon: Icon, label } = MODE_META[mode];
        const isActive = mode === current;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            title={label}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md transition-colors',
              isActive
                ? 'bg-accent-purple text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
