import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown } from 'lucide-react';
import { FaRegFolder, FaRegFolderOpen } from 'react-icons/fa';
import { Asset } from '@/lib/workspace-context';

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

  useEffect(() => {
    const fetchTree = () => {
      const event = new CustomEvent('phidias-api-request', {
        bubbles: true,
        composed: true,
        detail: {
          action: 'getAssets',
          onSuccess: (data: { assets_hierarchy?: TreeNode[] }) => {
            const hierarchy = data?.assets_hierarchy || [];
            setTreeData(hierarchy);
            // Auto-expand root
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
      });
      console.log(event);
      document.dispatchEvent(event);
    };
    fetchTree();
  }, []);

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpload = async () => {
    if (selectedId === null) return;
    const selectedNode = treeData.find((n) => n.id === selectedId);
    if (!selectedNode || selectedNode.type === 'asset') return;

    setIsUploading(true);

    try {
      // Fetch the blob from asset.modelUrl
      const response = await fetch(asset.modelUrl);
      const blob = await response.blob();

      // Assume .glb if no standard 3d extension
      let ext = '.glb';
      if (asset.name.toLowerCase().endsWith('.obj')) ext = '.obj';
      if (asset.name.toLowerCase().endsWith('.fbx')) ext = '.fbx';
      if (asset.name.toLowerCase().endsWith('.stl')) ext = '.stl';

      const fileName = asset.name.endsWith(ext)
        ? asset.name
        : `${asset.name}${ext}`;
      const file = new File([blob], fileName, {
        type: blob.type || 'model/gltf-binary',
      });

      const event = new CustomEvent('phidias-api-request', {
        bubbles: true,
        composed: true,
        detail: {
          action: 'uploadAssets',
          payload: {
            files: [file],
            nucleusDir: selectedNode.path,
            nucleusFileName: asset.name,
            entryFileName: fileName,
            onProgress: (progress: number) => {
              setUploadProgress(progress * 100);
            },
          },
          onSuccess: () => {
            setIsUploading(false);
            onClose();
          },
          onError: (err: unknown) => {
            console.error('Upload failed:', err);
            setIsUploading(false);
          },
        },
      });
      document.dispatchEvent(event);
    } catch (err) {
      console.error('Failed to create file for upload', err);
      setIsUploading(false);
    }
  };

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
          maxHeight: '80vh',
        }}
      >
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

        <div
          className="flex-1 overflow-y-auto p-2"
          style={{ background: '#141428', minHeight: '300px' }}
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

        <div
          className="p-4 border-t flex flex-col gap-3"
          style={{ borderColor: '#2d2d4a', background: '#1a1a2e' }}
        >
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
              disabled={selectedId === null || isUploading}
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
