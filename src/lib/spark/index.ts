/**
 * SparkJS Integration Placeholder
 *
 * TODO: Replace with actual NVIDIA SparkJS SDK when available.
 *
 * Research conducted Feb 2026 confirmed that SparkJS is not yet publicly
 * documented or released as a standalone npm package. NVIDIA's public
 * physics offerings are PhysX SDK (C++/GPU) and Isaac Sim (Omniverse).
 *
 * This placeholder uses the same interface design that a real SparkJS SDK
 * would likely expose, so wiring up the real SDK will be a drop-in swap.
 *
 * For physics preview, use cannon-es or @dimforge/rapier3d-compat as
 * temporary substitutes (not included here to keep this file pure interface).
 */

export interface SparkConfig {
  gravity: [number, number, number];
  timeStep: number;
  iterations: number;
}

export interface SparkBody {
  id: string;
  mass: number;
  position: [number, number, number];
  shape: 'box' | 'sphere' | 'mesh' | 'capsule';
  material?: {
    friction: number;
    restitution: number;
  };
}

export interface SparkJoint {
  id: string;
  type: 'revolute' | 'prismatic' | 'fixed' | 'spherical' | '6dof';
  bodyA: string;
  bodyB: string;
  pivotA: [number, number, number];
  pivotB: [number, number, number];
  axis?: [number, number, number];
}

export interface SparkBodyTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export class SparkScene {
  private config: SparkConfig;

  private bodies: Map<string, SparkBody> = new Map();

  private joints: SparkJoint[] = [];

  constructor(config: Partial<SparkConfig> = {}) {
    this.config = {
      gravity: [0, -9.81, 0],
      timeStep: 1 / 60,
      iterations: 10,
      ...config,
    };
    // Only warn once per scene creation
    if (typeof console !== 'undefined') {
      console.warn(
        '[SparkJS] Using placeholder implementation. ' +
          'Replace with NVIDIA SparkJS SDK when available.',
      );
    }
  }

  addBody(body: SparkBody): void {
    this.bodies.set(body.id, body);
  }

  removeBody(id: string): void {
    this.bodies.delete(id);
  }

  addJoint(joint: SparkJoint): void {
    this.joints.push(joint);
  }

  removeJoint(id: string): void {
    this.joints = this.joints.filter((j) => j.id !== id);
  }

  getBody(id: string): SparkBody | undefined {
    return this.bodies.get(id);
  }

  getAllBodies(): SparkBody[] {
    return Array.from(this.bodies.values());
  }

  getAllJoints(): SparkJoint[] {
    return [...this.joints];
  }

  /**
   * Advance the simulation by one time step.
   * TODO: Implement physics step with real SparkJS or cannon-es.
   */
  step(): void {
    // Placeholder: no-op
    // Real implementation would advance the PhysX simulation and
    // update body transform cache.
  }

  /**
   * Get the current transform of a physics body.
   * TODO: Return actual physics transforms from SparkJS.
   */
  getBodyTransform(id: string): SparkBodyTransform {
    const body = this.bodies.get(id);
    if (!body) {
      return { position: [0, 0, 0], rotation: [0, 0, 0] };
    }
    // Placeholder: return the initial position, no simulation applied
    return {
      position: [...body.position],
      rotation: [0, 0, 0],
    };
  }

  /**
   * Export the scene as a USD string for Isaac Sim ingestion.
   * TODO: Implement actual USD serialization via SparkJS.
   */
  exportToUSD(): string {
    const lines: string[] = [
      '#usda 1.0',
      '# SparkJS USD Export — Placeholder',
      '# TODO: Replace with real SparkJS exportToUSD() output',
      `# Bodies: ${this.bodies.size}`,
      `# Joints: ${this.joints.length}`,
      `# Gravity: ${this.config.gravity.join(', ')}`,
      '',
      'def Xform "World" {',
    ];

    this.bodies.forEach((body) => {
      lines.push(
        `    def RigidBody "${body.id}" {`,
        `        double3 xformOp:translate = (${body.position.join(', ')})`,
        `        double mass = ${body.mass}`,
        `    }`,
      );
    });

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Reset all body transforms back to their initial positions.
   */
  reset(): void {
    // TODO: Reset SparkJS simulation state
  }

  dispose(): void {
    this.bodies.clear();
    this.joints = [];
  }
}

// ─── Convenience Factory ──────────────────────────────────────────────────────

/**
 * Create a SparkScene with optional config overrides.
 */
export function createSparkScene(config?: Partial<SparkConfig>): SparkScene {
  return new SparkScene(config);
}

/**
 * Check whether the real SparkJS runtime is loaded in the current environment.
 * Returns false until the real SDK is integrated.
 */
export function isSparkAvailable(): boolean {
  // TODO: Check for window.SparkJS or the real npm package export
  // e.g. return typeof window !== 'undefined' && 'SparkJS' in window;
  return false;
}

/**
 * Joint type labels for UI display.
 */
export const JOINT_TYPE_LABELS: Record<SparkJoint['type'], string> = {
  revolute: 'Revolute (Hinge)',
  prismatic: 'Prismatic (Slider)',
  fixed: 'Fixed',
  spherical: 'Spherical (Ball)',
  '6dof': '6-DOF',
};
