/**
 * NodeDetails - Side panel showing details for selected file
 */

import { X, FileCode, ArrowRight, ArrowLeft, Code2 } from 'lucide-react';
import type { GraphNode, GraphEdge } from '../../types/graph';

// Color palette for file types (matching GraphCanvas)
const TYPE_COLORS: Record<string, string> = {
  page: '#8b5cf6',
  component: '#3b82f6',
  store: '#f59e0b',
  api: '#10b981',
  hook: '#ec4899',
  util: '#6b7280',
  type: '#06b6d4',
  agent: '#ef4444',
  route: '#22c55e',
  service: '#f97316',
  config: '#a855f7',
  other: '#9ca3af',
};

interface NodeDetailsProps {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
  onClose: () => void;
  onNodeClick: (nodeId: string) => void;
}

export function NodeDetails({
  node,
  edges,
  nodes,
  onClose,
  onNodeClick,
}: NodeDetailsProps) {
  // Find imports (edges where this node is the source)
  const imports = edges
    .filter((e) => e.source === node.id)
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n): n is GraphNode => n !== undefined);

  // Find importers (edges where this node is the target)
  const importedBy = edges
    .filter((e) => e.target === node.id)
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is GraphNode => n !== undefined);

  const typeColor = TYPE_COLORS[node.type] || TYPE_COLORS.other;

  return (
    <div className="w-80 shrink-0 bg-slate-800/80 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: typeColor }}
          >
            <FileCode className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-slate-100 truncate">{node.label}</h3>
            <p className="text-xs text-slate-400 truncate">{node.path}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Metadata */}
      <div className="p-4 border-b border-slate-700 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
          <p className="text-sm text-slate-200 capitalize">{node.type}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Language</p>
          <p className="text-sm text-slate-200 capitalize">{node.language}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Lines</p>
          <p className="text-sm text-slate-200">{node.loc || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Exports</p>
          <p className="text-sm text-slate-200">{node.exports.length}</p>
        </div>
      </div>

      {/* Exports (if any) */}
      {node.exports.length > 0 && (
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Exports ({node.exports.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {node.exports.slice(0, 10).map((exp, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-300 rounded"
              >
                {exp.name}
              </span>
            ))}
            {node.exports.length > 10 && (
              <span className="px-2 py-0.5 text-xs text-slate-500">
                +{node.exports.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dependencies */}
      <div className="flex-1 overflow-auto">
        {/* Imports */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="h-4 w-4 text-emerald-400" />
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Imports ({imports.length})
            </p>
          </div>
          {imports.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No imports</p>
          ) : (
            <div className="space-y-1">
              {imports.slice(0, 15).map((imp) => (
                <button
                  key={imp.id}
                  onClick={() => onNodeClick(imp.id)}
                  className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700/50 rounded transition-colors truncate flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[imp.type] || TYPE_COLORS.other }}
                  />
                  {imp.label}
                </button>
              ))}
              {imports.length > 15 && (
                <p className="text-xs text-slate-500 px-2">
                  +{imports.length - 15} more
                </p>
              )}
            </div>
          )}
        </div>

        {/* Imported By */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowLeft className="h-4 w-4 text-amber-400" />
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Imported By ({importedBy.length})
            </p>
          </div>
          {importedBy.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Not imported anywhere</p>
          ) : (
            <div className="space-y-1">
              {importedBy.slice(0, 15).map((imp) => (
                <button
                  key={imp.id}
                  onClick={() => onNodeClick(imp.id)}
                  className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700/50 rounded transition-colors truncate flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[imp.type] || TYPE_COLORS.other }}
                  />
                  {imp.label}
                </button>
              ))}
              {importedBy.length > 15 && (
                <p className="text-xs text-slate-500 px-2">
                  +{importedBy.length - 15} more
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
