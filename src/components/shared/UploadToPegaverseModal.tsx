import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown } from 'lucide-react';
import { FaRegFolder, FaRegFolderOpen } from 'react-icons/fa';
import { Asset } from '@/lib/workspace-context';
import { PHIDIAS_EVENTS } from '@pegaverse/phidias-sdk';
import { Switch } from '@/components/ui/switch';

interface UploadToPegaverseModalProps {
  asset: Asset;
  onClose: () => void;
}

interface TreeNode {
  id: number;
  parent: number | null;
  name: string;
  path: string;
  type: 'category' | 'folder' | 'asset';
  children: number[];
}

// ── Path helpers (mirrors uploadAssetUtils.js logic) ─────────────────────────

const KNOWN_EXTENSIONS = ['.glb', '.obj', '.fbx', '.stl', '.usdz', '.usdc', '.usda', '.usd'];

function getFileExtension(name: string): string {
  const lower = name.toLowerCase();
  for (const ext of KNOWN_EXTENSIONS) {
    if (lower.endsWith(ext)) return ext;
  }
  return '.glb';
}

/** Strip the known extension from a filename, leaving the base name. */
function getBaseName(name: string): string {
  const lower = name.toLowerCase();
  for (const ext of KNOWN_EXTENSIONS) {
    if (lower.endsWith(ext)) return name.slice(0, -ext.length);
  }
  return name;
}

/**
 * Build the Nucleus upload path from the selected folder and user-supplied name.
 * Mirrors buildEntryPath() in uploadAssetUtils.js:
 *   nucleusDir      = selectedNode.path + customName + '/'  (asset-specific subfolder)
 *   nucleusFileName = customName + ext
 *   nucleusFilePath = nucleusDir + nucleusFileName           (preview label)
 *
 * The asset-specific subfolder ensures each asset gets a unique nucleus_upload_path
 * so the 409-conflict check on the server won't block re-uploads to the same parent.
 */
function buildNucleusPath(
  parentPath: string,
  customName: string,
  ext: string,
): { nucleusDir: string; nucleusFileName: string; nucleusFilePath: string } {
  const trimmed = customName.trim();
  const nucleusDir = `${parentPath}${trimmed}/`;
  const nucleusFileName = `${trimmed}${ext}`;
  const nucleusFilePath = `${nucleusDir}${nucleusFileName}`;
  return { nucleusDir, nucleusFileName, nucleusFilePath };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UploadToPegaverseModal({
  asset,
  onClose,
}: UploadToPegaverseModalProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // User-editable filename (without extension). Mirrors the entry_file_name
  // field in UploadAssetForm — the user can rename before uploading.
  const [customName, setCustomName] = useState<string>(() => getBaseName(asset.name));

  // Upload settings — mirrors the toggles in UploadAssetForm
  const [instanceable, setInstanceable] = useState(true);
  const [enableM2M, setEnableM2M] = useState(false);
  const [isShared, setIsShared] = useState(false);

  const ext = getFileExtension(asset.name);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedNode = selectedId !== null
    ? treeData.find((n) => n.id === selectedId) ?? null
    : null;

  const { nucleusDir, nucleusFileName, nucleusFilePath } = selectedNode
    ? buildNucleusPath(selectedNode.path, customName, ext)
    : { nucleusDir: '', nucleusFileName: '', nucleusFilePath: '' };

  const showPathPreview =
    selectedNode !== null && customName.trim().length > 0;

  const canUpload =
    selectedId !== null &&
    customName.trim().length > 0 &&
    !isUploading;

  // ── Fetch folder tree ───────────────────────────────────────────────────────

  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent(PHIDIAS_EVENTS.GET_ASSETS, {
        bubbles: true,
        composed: true,
        detail: {
          onSuccess: (data: { assets_hierarchy?: TreeNode[] }) => {
            const hierarchy = data?.assets_hierarchy || [];
            setTreeData(hierarchy);
            const root = hierarchy.find((n: TreeNode) => n.id === 0);
            if (root) {
              setExpandedIds(new Set([0, ...(root.children || [])]));
            }
            setLoadingTree(false);
          },
          onError: (err: unknown) => {
            console.error('Failed to get assets hierarchy:', err);
            setLoadingTree(false);
          },
        },
      }),
    );
  }, []);

  // ── Tree interaction ────────────────────────────────────────────────────────

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!canUpload || !selectedNode) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const response = await fetch(asset.modelUrl);
      const blob = await response.blob();

      const file = new File([blob], nucleusFileName, {
        type: blob.type || 'model/gltf-binary',
      });

      document.dispatchEvent(
        new CustomEvent(PHIDIAS_EVENTS.UPLOAD_ASSETS, {
          bubbles: true,
          composed: true,
          detail: {
            files: [file],
            nucleusDir,
            nucleusFileName,
            entryFileName: nucleusFileName,
            // Upload settings forwarded to PhidiasRoute for extraMetadata construction
            instanceable,
            enableM2M,
            isShared,
            onProgress: (progress: number) => {
              setUploadProgress(progress * 100);
            },
            onSuccess: () => {
              setIsUploading(false);
              onClose();
            },
            onError: (err: unknown) => {
              console.error('Upload failed:', err);
              setIsUploading(false);
              // Resolve HTTP status from either axios error (err.response.status)
              // or a plain {status} object shape
              const httpStatus =
                (err && typeof err === 'object' && 'response' in err &&
                  (err as { response?: { status?: number } }).response?.status) ||
                (err && typeof err === 'object' && 'status' in err &&
                  (err as { status?: number }).status) ||
                null;
              if (httpStatus === 409) {
                setErrorMessage(
                  'This asset path already exists in PEGAVERSE. Please rename the file or choose a different folder.',
                );
              } else if (httpStatus === 403) {
                setErrorMessage(
                  'You do not have permission to overwrite this asset.',
                );
              } else {
                const msg = err instanceof Error ? err.message : String(err);
                setErrorMessage(`Upload failed: ${msg || 'Unknown error'}`);
              }
            },
          },
        }),
      );
    } catch (err) {
      console.error('Failed to create file for upload', err);
      setIsUploading(false);
      setErrorMessage('Failed to fetch the model file for upload.');
    }
  };

  // ── Tree rendering ──────────────────────────────────────────────────────────

  const renderTree = (parentId: number | null, level = 1) => {
    const nodes = treeData.filter(
      (n) => n.parent === parentId && n.type !== 'asset',
    );
    return nodes.map((node) => {
      const isExpanded = expandedIds.has(node.id);
      const isSelected = selectedId === node.id;
      const hasChildren =
        node.children &&
        node.children.some((childId) => {
          const child = treeData.find((n) => n.id === childId);
          return child && child.type !== 'asset';
        });

      return (
        <div key={node.id}>
          <div style={{ paddingLeft: 20 * (level - 1) }}>
            <div
              className={`flex flex-row gap-2 w-full items-center py-1.5 px-2 cursor-pointer transition-colors ${isSelected ? 'bg-slate-600' : 'hover:bg-slate-500'}`}
              onClick={() => setSelectedId(node.id)}
              onDoubleClick={(e) => {
                if (hasChildren) toggleExpand(node.id, e);
              }}
            >
              <div
                className="w-4 h-4 flex items-center justify-center -ml-1 opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) toggleExpand(node.id, e);
                }}
              >
                {hasChildren ? (
                  isExpanded ? (
                    <ChevronDown size={14} className="text-[#94a3b8]" />
                  ) : (
                    <ChevronRight size={14} className="text-[#94a3b8]" />
                  )
                ) : (
                  <div className="w-[14px] h-[14px]" />
                )}
              </div>

              {isExpanded ? (
                <FaRegFolderOpen
                  color="#e8a87c"
                  size={16}
                  className="icon flex-shrink-0"
                />
              ) : (
                <FaRegFolder
                  color="#e8a87c"
                  size={16}
                  className="icon flex-shrink-0"
                />
              )}

              <span
                className={`text-sm font-medium truncate select-none ${isSelected ? 'text-white' : 'text-[#e2e8f0]'}`}
              >
                {node.name}
              </span>
            </div>
          </div>
          {isExpanded && hasChildren && renderTree(node.id, level + 1)}
        </div>
      );
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{
        background: 'rgba(10, 10, 20, 0.8)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: '#1a1a2e',
          border: '1px solid #2d2d4a',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#2d2d4a' }}
        >
          <div>
            <h3 className="text-sm font-semibold text-white">
              Upload to PEGAVERSE
            </h3>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Select a destination folder for &quot;{asset.name}&quot;
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Folder tree */}
        <div
          className="flex-1 overflow-y-auto p-2"
          style={{ background: '#141428', minHeight: '200px' }}
        >
          {loadingTree ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin" />
            </div>
          ) : treeData.length > 0 ? (
            <div className="py-2">{renderTree(null)}</div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#64748b] text-xs">
              <FaRegFolder
                size={24}
                className="mb-2 opacity-50 text-[#e8a87c]"
              />
              <p>No folders available</p>
            </div>
          )}
        </div>

        {/* Filename input + settings + path preview + actions */}
        <div
          className="p-4 border-t flex flex-col gap-3"
          style={{ borderColor: '#2d2d4a', background: '#1a1a2e' }}
        >
          {/* Filename input — mirrors entry_file_name in UploadAssetForm */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#94a3b8]">
              Filename
            </label>
            <div className="flex items-center gap-0">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                disabled={isUploading}
                className="flex-1 bg-[#141428] border border-[#2d2d4a] rounded-l-lg px-3 py-1.5 text-xs text-white placeholder-[#4a5568] focus:outline-none focus:border-[#7c3aed] disabled:opacity-50"
                placeholder="Enter filename"
              />
              <span
                className="px-3 py-1.5 text-xs text-[#94a3b8] border border-l-0 border-[#2d2d4a] rounded-r-lg"
                style={{ background: '#1e1e36' }}
              >
                {ext}
              </span>
            </div>
          </div>

          {/* Upload settings — mirrors toggles in UploadAssetForm */}
          <div
            className="px-3 py-2.5 rounded-lg"
            style={{ background: '#141428', border: '1px solid #2d2d4a' }}
          >
            <span className="block text-[10px] font-medium text-[#64748b] uppercase tracking-wider mb-2.5">
              Upload Settings
            </span>
            {/* Grid layout: label left-aligns, switches right-align */}
            <div className="grid grid-cols-[1fr_auto] gap-y-2.5 gap-x-4">
              <label className="text-xs text-[#94a3b8] self-center">Instanceable</label>
              <Switch
                checked={instanceable}
                onCheckedChange={setInstanceable}
                disabled={isUploading}
              />

              <label className="text-xs text-[#94a3b8] self-center">M2M Simulation Configuration</label>
              <Switch
                checked={enableM2M}
                onCheckedChange={setEnableM2M}
                disabled={isUploading}
              />

              <label className="text-xs text-[#94a3b8] self-center">Share Permissions</label>
              <Switch
                checked={isShared}
                onCheckedChange={setIsShared}
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Upload path preview — mirrors nucleusFilePath in UploadAssetForm */}
          {showPathPreview && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-[#64748b]">Upload path</span>
              <p
                className="text-[11px] text-[#94a3b8] break-all font-mono"
                style={{
                  background: '#141428',
                  border: '1px solid #2d2d4a',
                  borderRadius: 6,
                  padding: '4px 8px',
                }}
              >
                {nucleusFilePath}
              </p>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div
              className="text-xs rounded-lg px-3 py-2"
              style={{
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.4)',
                color: '#fca5a5',
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Progress bar */}
          {isUploading && (
            <div className="w-full">
              <div className="flex items-center justify-between text-xs text-[#94a3b8] mb-1.5">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: '#2d2d4a' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ background: '#7c3aed', width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#94a3b8] hover:bg-[#252542] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!canUpload}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload Asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
