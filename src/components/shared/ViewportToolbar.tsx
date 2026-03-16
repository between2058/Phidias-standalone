'use client';



import { cn } from '@/lib/utils';

interface ViewportToolbarProps {
    onEnvironmentChange?: (hdriPath: string) => void;
    gridVisible?: boolean;
    className?: string;
}

export default function ViewportToolbar({
    className,
}: ViewportToolbarProps) {
    return (
        <div className={cn('flex flex-col items-center gap-2', className)}>
            {/* XYZ Axis Gizmo */}
            <div
                className="relative rounded-full flex items-center justify-center"
                style={{
                    width: 56,
                    height: 56,
                    background: 'rgba(6, 21, 37, 0.5)',
                    border: '1px solid rgba(26, 58, 90, 0.6)',
                }}
            >
                {/* Center dot */}
                <div
                    className="absolute rounded-full"
                    style={{
                        width: 8,
                        height: 8,
                        background: 'rgba(77, 110, 138, 0.8)',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                />
                {/* X axis */}
                <div
                    className="absolute"
                    style={{
                        width: 18,
                        height: 2,
                        background: '#ef4444',
                        left: '50%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        borderRadius: 1,
                    }}
                />
                {/* Y axis */}
                <div
                    className="absolute"
                    style={{
                        width: 2,
                        height: 18,
                        background: '#22c55e',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -100%)',
                        borderRadius: 1,
                    }}
                />
                {/* Z axis */}
                <div
                    className="absolute"
                    style={{
                        width: 14,
                        height: 2,
                        background: '#3b82f6',
                        left: '30%',
                        top: '65%',
                        transform: 'rotate(-45deg)',
                        borderRadius: 1,
                    }}
                />
                {/* Labels */}
                <span
                    className="absolute text-[9px] font-bold text-[#ef4444]"
                    style={{ right: 4, top: '50%', transform: 'translateY(-50%)' }}
                >
                    X
                </span>
                <span
                    className="absolute text-[9px] font-bold text-[#22c55e]"
                    style={{ left: '50%', top: 2, transform: 'translateX(-50%)' }}
                >
                    Y
                </span>
                <span
                    className="absolute text-[9px] font-bold text-[#3b82f6]"
                    style={{ left: 3, bottom: 6 }}
                >
                    Z
                </span>
            </div>

            {/* Main Tool Pill */}
            {/* <div
        className="relative flex flex-col items-center rounded-full py-1.5"
        style={{
          width: 52,
          background: 'rgba(6, 21, 37, 0.87)',
          border: '1px solid rgba(26, 58, 90, 0.5)',
        }}
      >

        <button
          className="flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ width: 40, height: 40 }}
          onClick={() => setEnvPopoverOpen(!envPopoverOpen)}
          title="Environment Settings"
        >
          <Sun size={20} className="text-text-secondary" />
        </button>


        <div className="w-7 h-px" style={{ background: 'rgba(26, 58, 90, 0.6)' }} />


        <button
          className="flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ width: 40, height: 40 }}
          onClick={onResetCamera}
          title="Reset Camera"
        >
          <RotateCcw size={20} className="text-text-secondary" />
        </button>


        <div className="w-7 h-px" style={{ background: 'rgba(26, 58, 90, 0.6)' }} />


        <button
          className="flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ width: 40, height: 40 }}
          onClick={handleToggleGrid}
          title="Toggle Grid"
        >
          <Grid3x3
            size={20}
            style={{ color: localGridVisible ? 'var(--accent-gold)' : 'var(--text-secondary)' }}
          />
        </button>


        {envPopoverOpen && (
          <div
            className="absolute right-full mr-3 top-0 w-56 rounded-xl p-4 z-50 shadow-2xl"
            style={{
              background: 'rgba(13, 13, 24, 0.97)',
              border: '1px solid var(--border)',
            }}
          >
            <h4 className="text-text-primary text-sm font-semibold mb-3">Environment</h4>

            <div className="space-y-3">
              <div>
                <label className="text-text-tertiary text-xs mb-1.5 block">HDRI Map</label>
                <select
                  className="w-full bg-bg-card border border-phidias-border rounded-md px-2 py-1.5 text-xs text-text-primary"
                >
                  <option>Moonrise Puresky</option>
                  <option>Studio Soft</option>
                  <option>Outdoor Sunny</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-text-tertiary text-xs">Intensity</label>
                  <span className="text-text-secondary text-xs">1.0</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  defaultValue="1"
                  className="w-full h-1 rounded-full accent-yellow-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-text-tertiary text-xs">Rotation</label>
                  <span className="text-text-secondary text-xs">0°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  defaultValue="0"
                  className="w-full h-1 rounded-full accent-yellow-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-tertiary text-xs">Show Background</span>
                <button className="w-8 h-4 rounded-full transition-colors" style={{ background: 'var(--toggle-off)' }}>
                  <div className="w-3 h-3 bg-white rounded-full ml-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div> */}

            {/* Help Button */}
            {/* <button
        className="flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
        style={{
          width: 44,
          height: 44,
          background: 'rgba(6, 21, 37, 0.87)',
          border: '1px solid rgba(26, 58, 90, 0.5)',
        }}
        title="Help"
      >
        <CircleHelp size={20} className="text-text-secondary" />
      </button> */}
        </div>
    );
}
