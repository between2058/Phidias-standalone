import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CADJointControls } from './CADJointControls';
import type { JointSpec } from '@/lib/three/urdf/types';
import * as THREE from 'three';

const joints: JointSpec[] = [
  {
    name: 'hinge',
    type: 'revolute',
    parent: 'base',
    child: 'arm',
    axis: new THREE.Vector3(0, 0, 1),
    lower: -Math.PI / 2,
    upper: Math.PI / 2,
    origin: new THREE.Matrix4(),
  },
];

describe('CADJointControls', () => {
  it('renders a slider per movable joint and emits onChange', () => {
    const onChange = vi.fn();
    render(<CADJointControls joints={joints} pose={{}} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: /hinge/i });
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(onChange).toHaveBeenCalledWith({ hinge: 0.5 });
  });

  it('renders "No movable joints." when the joint list is empty', () => {
    render(<CADJointControls joints={[]} pose={{}} onChange={() => {}} />);
    expect(screen.getByText(/no movable joints/i)).toBeInTheDocument();
  });

  it('filters out fixed joints', () => {
    const mixed: JointSpec[] = [
      ...joints,
      {
        name: 'weld',
        type: 'fixed',
        parent: 'base',
        child: 'plate',
        axis: new THREE.Vector3(1, 0, 0),
        lower: 0,
        upper: 0,
        origin: new THREE.Matrix4(),
      },
    ];
    render(<CADJointControls joints={mixed} pose={{}} onChange={() => {}} />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
  });
});
