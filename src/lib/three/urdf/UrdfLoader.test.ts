// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { UrdfLoader } from './UrdfLoader';

// Read sample URDF from fixture file
const sampleUrdf = fs.readFileSync(
  path.resolve(__dirname, '../../../components/cad/__fixtures__/sample-urdf.xml'),
  'utf-8',
);

describe('UrdfLoader', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: unknown) => {
      if (typeof url === 'string' && url.endsWith('.urdf')) {
        return Promise.resolve({ ok: true, text: async () => sampleUrdf } as Response);
      }
      // Mesh requests — return empty ArrayBuffer (won't be triggered for primitive-only URDF)
      return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as Response);
    });
  });

  it('parses a minimal URDF and exposes its joints', async () => {
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    const robot = await loader.load('model.urdf');
    expect(robot.joints).toHaveLength(1);
    expect(robot.joints[0].name).toBe('hinge');
    expect(robot.joints[0].type).toBe('revolute');
  });

  it('exposes the correct joint limits', async () => {
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    const robot = await loader.load('model.urdf');
    expect(robot.joints[0].lower).toBeCloseTo(-1.57, 2);
    expect(robot.joints[0].upper).toBeCloseTo(1.57, 2);
  });

  it('exposes the link list', async () => {
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    const robot = await loader.load('model.urdf');
    expect(robot.links).toHaveLength(2);
    const linkNames = robot.links.map((l) => l.name);
    expect(linkNames).toContain('base');
    expect(linkNames).toContain('arm');
  });

  it('produces a non-null THREE.Group root', async () => {
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    const robot = await loader.load('model.urdf');
    expect(robot.root).toBeTruthy();
    expect(robot.root.name).toBe('robot:test');
  });

  it('setJointAngle mutates the motion node\'s quaternion', async () => {
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    const robot = await loader.load('model.urdf');
    const motionNode = robot.root.getObjectByName('joint-motion:hinge');
    expect(motionNode).toBeTruthy();
    const before = motionNode!.quaternion.clone();
    robot.setJointAngle('hinge', Math.PI / 4);
    const after = motionNode!.quaternion;
    // Rotation must actually have happened — the quaternion is no longer the pre-call value.
    expect(after.equals(before)).toBe(false);
    // And rotating by 0 must return the node to its origin pose (within float epsilon).
    robot.setJointAngle('hinge', 0);
    expect(motionNode!.quaternion.angleTo(before)).toBeLessThan(1e-6);
  });

  it('throws when URDF fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' } as Response);
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    await expect(loader.load('model.urdf')).rejects.toThrow('Failed to fetch URDF');
  });

  it('dispose() does not throw', async () => {
    const loader = new UrdfLoader({ baseUrl: '/api/library/records/rec_x' });
    const robot = await loader.load('model.urdf');
    expect(() => robot.dispose()).not.toThrow();
  });
});
