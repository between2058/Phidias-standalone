'use client';

import React from 'react';
import { Download } from 'lucide-react';

/**
 * Stub export buttons for USDA / USDZ.
 * Full implementation in Task 15.
 */
export default function PhysicsExportButtons() {
  return (
    <div className="flex items-center gap-1">
      <button
        disabled
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[#3d3d5c] cursor-not-allowed transition-colors"
        title="Export USDA (coming soon)"
      >
        <Download size={12} />
        USDA
      </button>
      <button
        disabled
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[#3d3d5c] cursor-not-allowed transition-colors"
        title="Export USDZ (coming soon)"
      >
        <Download size={12} />
        USDZ
      </button>
    </div>
  );
}
