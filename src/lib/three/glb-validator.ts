/**
 * GLB File Validator
 *
 * Lightweight validation for GLB files on upload:
 * - L1: Magic bytes check (first 4 bytes = "glTF" = 0x46546C67)
 * - L2: Basic chunk structure validation (JSON chunk length)
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a GLB file by checking magic bytes and basic structure.
 *
 * @param file - The file to validate
 * @returns Promise<ValidationResult> - { valid: true } or { valid: false, error: '...' }
 */
export async function validateGLBFile(file: File): Promise<ValidationResult> {
  // Read first 512 bytes to validate header and JSON chunk
  const slice = file.slice(0, 512);
  const buffer = await slice.arrayBuffer();

  if (buffer.byteLength < 12) {
    return { valid: false, error: 'File too small to be a valid GLB' };
  }

  const view = new DataView(buffer);

  // L1: Check GLB magic bytes ("glTF" = 0x46546C67 in little-endian)
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) {
    return { valid: false, error: 'Invalid file format: not a valid GLB file' };
  }

  // L2: Validate chunk structure
  // GLB format:
  // - Bytes 0-3: magic ("glTF")
  // - Bytes 4-7: version (should be 2)
  // - Bytes 8-11: length (total file length)
  // - Bytes 12-15: chunk1 length
  // - Bytes 16-19: chunk1 type (0x4E4F534A = "JSON")
  // - Bytes 20+: chunk1 data (JSON)

  const version = view.getUint32(4, true);
  if (version !== 2) {
    return { valid: false, error: 'Unsupported GLB version (only v2 supported)' };
  }

  const jsonChunkLength = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);

  // Check JSON chunk type (should be "JSON" = 0x4E4F534A)
  if (jsonChunkType !== 0x4e4f534a) {
    return { valid: false, error: 'Invalid GLB structure: missing JSON chunk' };
  }

  // Sanity check JSON chunk length
  if (jsonChunkLength < 1 || jsonChunkLength > 50 * 1024 * 1024) {
    return { valid: false, error: 'Invalid GLB structure: corrupted JSON chunk' };
  }

  return { valid: true };
}