// Type stubs for PlayCanvas built-in script files (no .d.ts shipped)
declare module 'playcanvas/scripts/esm/camera-controls.mjs' {
  import { Script } from 'playcanvas';

  export class CameraControls extends Script {
    static scriptName: string;

    enableFly: boolean;

    enableOrbit: boolean;

    moveSpeed: number;

    moveFastSpeed: number;

    moveSlowSpeed: number;

    zoomSpeed: number;

    rotateSpeed: number;
  }
}

declare module 'playcanvas/scripts/esm/first-person-controller.mjs' {
  import { Script } from 'playcanvas';

  export class FirstPersonController extends Script {
    static scriptName: string;
  }
}
