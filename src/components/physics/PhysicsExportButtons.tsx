'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { usePhysicsStore } from '@/store/physics-store';
import type { PhysicsPart, PhysicsJoint } from '@/store/physics-store';
import { useWorkspace } from '@/lib/workspace-context';
import {
  exportArticulationUsda,
  exportArticulationUsdz,
  downloadArticulationFile,
} from '@/lib/api/phidias';
import type {
  ArticulationExportPart,
  ArticulationExportJoint,
} from '@/lib/api/types';

// ─── Validation ──────────────────────────────────────────────────────────────

interface ValidationError {
  level: 'error' | 'warning';
  message: string;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function validatePhysicsData(
  parts: PhysicsPart[],
  joints: PhysicsJoint[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have at least one base part
  const hasBase = parts.some((p) => p.type === 'base');
  if (!hasBase) {
    errors.push({
      level: 'error',
      message: 'At least one part must have type "base".',
    });
  }

  // Joint completeness: parentPartId and childPartId must reference existing parts
  const partIds = new Set(parts.map((p) => p.id));
  for (const joint of joints) {
    if (!partIds.has(joint.parentPartId)) {
      errors.push({
        level: 'error',
        message: `Joint "${joint.name}" references non-existent parent part "${joint.parentPartId}".`,
      });
    }
    if (!partIds.has(joint.childPartId)) {
      errors.push({
        level: 'error',
        message: `Joint "${joint.name}" references non-existent child part "${joint.childPartId}".`,
      });
    }
  }

  // No orphan links: all 'link' type parts must be referenced by at least one joint
  const referencedByJoints = new Set<string>();
  for (const joint of joints) {
    referencedByJoints.add(joint.parentPartId);
    referencedByJoints.add(joint.childPartId);
  }
  for (const part of parts) {
    if (part.type === 'link' && !referencedByJoints.has(part.id)) {
      errors.push({
        level: 'error',
        message: `Link part "${part.name}" is not referenced by any joint.`,
      });
    }
  }

  // Anchor sanity: warn if anchor is [0,0,0]
  for (const joint of joints) {
    if (
      joint.anchor[0] === 0 &&
      joint.anchor[1] === 0 &&
      joint.anchor[2] === 0
    ) {
      errors.push({
        level: 'warning',
        message: `Joint "${joint.name}" has anchor at origin [0,0,0].`,
      });
    }
  }

  // Name conflicts: all part names must be unique after sanitization
  const nameMap = new Map<string, string[]>();
  for (const part of parts) {
    const sanitized = sanitizeName(part.name);
    const existing = nameMap.get(sanitized) || [];
    existing.push(part.name);
    nameMap.set(sanitized, existing);
  }
  for (const [sanitized, names] of nameMap) {
    if (names.length > 1) {
      errors.push({
        level: 'error',
        message: `Name conflict: parts [${names.join(', ')}] all sanitize to "${sanitized}".`,
      });
    }
  }

  return errors;
}

// ─── Data conversion ─────────────────────────────────────────────────────────

function buildExportParts(parts: PhysicsPart[]): ArticulationExportPart[] {
  return parts.map((p) => ({
    id: p.id,
    name: sanitizeName(p.name),
    type: p.type,
    mass: p.mass,
    density: p.density,
    collision_type: p.collisionType,
    static_friction: p.staticFriction,
    dynamic_friction: p.dynamicFriction,
    restitution: p.restitution,
  }));
}

function mapJointType(
  type: PhysicsJoint['type'],
): ArticulationExportJoint['type'] {
  switch (type) {
    case 'Revolute':
      return 'revolute';
    case 'Prismatic':
      return 'prismatic';
    case 'Fixed':
    case 'Spherical':
    case '6-DOF':
    default:
      return 'fixed';
  }
}

function buildExportJoints(joints: PhysicsJoint[]): ArticulationExportJoint[] {
  return joints.map((j) => ({
    name: sanitizeName(j.name),
    parent: j.parentPartId,
    child: j.childPartId,
    type: mapJointType(j.type),
    axis: j.axis,
    anchor: j.anchor,
    lower_limit: j.limitsEnabled ? j.limitLower : null,
    upper_limit: j.limitsEnabled ? j.limitUpper : null,
    drive_stiffness: j.driveType !== 'none' ? j.driveStiffness : null,
    drive_damping: j.driveType !== 'none' ? j.driveDamping : null,
    drive_max_force: j.driveType !== 'none' ? j.driveMaxForce : null,
    drive_type: j.driveType,
    disable_collision: j.disableCollision,
  }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhysicsExportButtons() {
  const parts = usePhysicsStore((s) => s.parts);
  const joints = usePhysicsStore((s) => s.joints);
  const { assets, activeAssetId } = useWorkspace();
  const activeAsset = assets.find((a) => a.id === activeAssetId) ?? null;
  const modelUrl = activeAsset?.modelUrl ?? null;

  const [exporting, setExporting] = useState(false);

  const disabled = !modelUrl || parts.length === 0 || exporting;

  const handleExport = useCallback(
    async (format: 'usda' | 'usdz') => {
      if (!modelUrl || parts.length === 0) return;

      // Validate
      const errors = validatePhysicsData(parts, joints);
      const blockingErrors = errors.filter((e) => e.level === 'error');
      const warnings = errors.filter((e) => e.level === 'warning');

      // Log warnings
      for (const w of warnings) {
        console.warn('[Physics Export] Warning:', w.message);
      }

      if (blockingErrors.length > 0) {
        console.error(
          '[Physics Export] Validation failed:',
          blockingErrors.map((e) => e.message),
        );
        return;
      }

      setExporting(true);
      try {
        // Fetch GLB blob and create File object
        const response = await fetch(modelUrl);
        const blob = await response.blob();
        const baseName =
          activeAsset?.name.replace(/\.[^/.]+$/, '') ?? 'model';
        const glbFile = new File([blob], `${baseName}.glb`, {
          type: 'model/gltf-binary',
        });

        // Build export data
        const exportParts = buildExportParts(parts);
        const exportJoints = buildExportJoints(joints);
        const exportData = {
          glb_file: glbFile,
          model_name: baseName,
          parts: exportParts,
          joints: exportJoints,
        };

        // Call the appropriate API
        const exportFn =
          format === 'usda'
            ? exportArticulationUsda
            : exportArticulationUsdz;
        const result = await exportFn(exportData);

        if (result.success && result.filename) {
          // Download the resulting file
          const fileBlob = await downloadArticulationFile(result.filename);
          const url = URL.createObjectURL(fileBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } else {
          console.error(
            '[Physics Export] Export returned unsuccessful result:',
            result,
          );
        }
      } catch (err) {
        console.error(`[Physics Export] ${format} export failed:`, err);
      } finally {
        setExporting(false);
      }
    },
    [modelUrl, parts, joints, activeAsset?.name],
  );

  // Listen for CustomEvent from ExportDropdown (Task 17)
  useEffect(() => {
    const handler = (e: Event) => {
      const format = (e as CustomEvent).detail as 'usda' | 'usdz';
      handleExport(format);
    };
    window.addEventListener('physics-export', handler);
    return () => window.removeEventListener('physics-export', handler);
  }, [handleExport]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleExport('usda')}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
          disabled
            ? 'text-[#3d3d5c] cursor-not-allowed'
            : 'text-[#f5a623] hover:bg-[#f5a623]/10 cursor-pointer'
        }`}
        title={disabled ? 'No model or parts loaded' : 'Export USDA (Physics)'}
      >
        <Download size={12} />
        {exporting ? 'Exporting...' : 'USDA'}
      </button>
      <button
        onClick={() => handleExport('usdz')}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
          disabled
            ? 'text-[#3d3d5c] cursor-not-allowed'
            : 'text-[#f5a623] hover:bg-[#f5a623]/10 cursor-pointer'
        }`}
        title={disabled ? 'No model or parts loaded' : 'Export USDZ (Physics)'}
      >
        <Download size={12} />
        {exporting ? 'Exporting...' : 'USDZ'}
      </button>
    </div>
  );
}
