export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface ProgressUpdate {
  percent: number;
  stage: string;
}

export interface GenerationParams {
  guidance_strength: number;
  sampling_steps: number;
}

// Qwen text-to-image params (matches /text2img endpoint)
export interface QwenText2ImgParams {
  prompt: string;
  negativePrompt: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  numSteps: number;
  cfgScale: number;
  seed: number;
  randomizeSeed: boolean;
}

export interface GenerateModelRequest {
  // Input mode
  inputMode: 'image' | 'multiview' | 'text' | 'batch';

  // Backend selection — ReconViaGen (async polling) vs TRELLIS.2 (sync inline)
  backend: 'reconviagen' | 'trellis2';

  // image mode
  image?: File;

  // multiview mode
  images?: File[];
  multiViewMode?: 'stochastic' | 'multidiffusion';

  // text mode (Qwen → 3D backend)
  qwen?: QwenText2ImgParams;

  // batch mode (multiple images → ReconViaGen queue — no TRELLIS.2 batch)
  batchImages?: File[];

  // Core params (shared)
  resolution: '512' | '1024' | '1536';
  seed: number;
  randomizeSeed: boolean;
  preprocessImage: boolean;

  // GLB export params
  decimationTarget: number;                                         // TRELLIS.2: absolute face count
  simplify?: number;                                                // ReconViaGen: 0-1 ratio
  textureSize: number;
  pipelineType?: '512' | '1024' | '1024_cascade' | '1536_cascade';  // TRELLIS.2-only
  remesh?: boolean;                                                 // TRELLIS.2-only

  // Stage 1: Sparse Structure Generation
  ss: GenerationParams;
  // Stage 2: Shape Generation
  shapSlat: GenerationParams;
  // Stage 3: Material Generation
  texSlat: GenerationParams;
}

// Texturing request (matches app_texturing.py / Trellis2TexturingPipeline)
// The mesh is always the currently loaded model — no upload needed.
export interface TextureRequest {
  mode: 'image' | 'text';

  // image mode: user provides reference image directly
  referenceImage?: File;

  // text mode: Qwen /edit pipeline
  //   1. capture render of current GLB (or use sourceImage if provided)
  //   2. POST to Qwen /edit with prompt → styled reference image
  //   3. feed into TRELLIS.2 texturing
  prompt?: string;
  qwenSteps?: number; // Qwen edit steps (default 40)
  cfgScale?: number; // Qwen CFG scale (default 4.0)

  // TRELLIS.2 params
  resolution: '512' | '1024' | '1536';
  seed: number;
  randomizeSeed: boolean;
  textureSize: number; // 1024 / 2048 / 3072 / 4096
  // Stage 3 only (tex_slat) — geometry is provided by current model
  texSlat: GenerationParams;
}

// Batch mode: per-item status
export interface BatchItem {
  id: string;
  fileName: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  progress?: number;
  modelUrl?: string;
  error?: string;
}

export interface GenerateModelResponse {
  modelUrl: string;
  faces: number;
  vertices: number;
  processingTimeMs: number;
  topology: string;
}

export interface GenerateImageRequest {
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  samples: 1 | 4 | 8 | 16;
  aiModel: string;
}

export interface GenerateImageResponse {
  images: string[]; // data URLs or paths
}

export interface SegmentResult {
  parts: { name: string; color: string; meshIndex: number }[];
  modelUrl: string;
}

export interface RetopologyRequest {
  modelUrl: string;
  topology: 'quad' | 'triangle';
  targetFaces: number;
  preserveUV: boolean;
}

export interface RetopologyResult {
  modelUrl: string;
  originalFaces: number;
  newFaces: number;
}

export interface TextureResult {
  modelUrl: string;
  textureUrls: { albedo: string; normal?: string; roughness?: string };
}

export interface SceneReconstructResult {
  pointCloudUrl: string;
  meshUrl: string;
  faces: number;
  pointCount: number;
}

export interface PhysicsMaterial {
  id: string;
  name: string;
  density: number;
  staticFriction: number;
  dynamicFriction: number;
  restitution: number;
  color: string;
}

export interface Joint {
  id: string;
  name: string;
  type: 'revolute' | 'prismatic' | 'fixed' | 'spherical' | '6dof';
  parentPart: string;
  childPart: string;
  axis: [number, number, number];
  limits?: { lower: number; upper: number };
}

export interface HierarchyItem {
  id: string;
  name: string;
  visible: boolean;
  children?: HierarchyItem[];
  meshIndex?: number;
}

export interface TransformData {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface PlacedObject {
  id: string;
  name: string;
  modelUrl: string;
  transform: TransformData;
}

export interface AnnotationPin {
  id: string;
  number: number;
  position: [number, number, number];
  title: string;
  description: string;
  color: string;
}

// ============================================================================
// ── Articulation export types (Physics tab, ported from old repo) ───────────
// Used by exportArticulationUsda / exportArticulationUsdz / downloadArticulationFile
// in src/lib/api/phidias.ts and by PhysicsExportButtons.tsx.
// ============================================================================

export interface ArticulationExportPart {
  id: string;
  name: string;
  type: 'link' | 'base' | 'tool' | 'joint';
  mass: number | null;
  density: number;
  collision_type: 'convexHull' | 'mesh' | 'convexDecomposition' | 'none';
  static_friction: number;
  dynamic_friction: number;
  restitution: number;
}

export interface ArticulationExportJoint {
  name: string;
  parent: string;
  child: string;
  type: 'fixed' | 'revolute' | 'prismatic';
  axis: [number, number, number];
  anchor: [number, number, number];
  lower_limit: number | null;
  upper_limit: number | null;
  drive_stiffness: number | null;
  drive_damping: number | null;
  drive_max_force: number | null;
  drive_type: 'position' | 'velocity' | 'none';
  disable_collision: boolean;
}

export interface ArticulationExportData {
  glb_file: File;
  model_name: string;
  parts: ArticulationExportPart[];
  joints: ArticulationExportJoint[];
}

export interface ArticulationExportResult {
  success: boolean;
  filename: string;
  download_url: string;
}
