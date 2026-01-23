/**
 * CodebaseVizPage - Interactive codebase dependency visualization
 *
 * Features:
 * - Cytoscape.js graph with compound nodes for directories
 * - Filter by language, file type, directory
 * - Search by file name
 * - Click node to see details
 * - Zoom/pan controls
 */

import { useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { GraphCanvas, GraphControls, NodeDetails } from '../components/viz';
import { useGraphData } from '../hooks/useGraphData';
import type { GraphNode, GraphFilters, FileType } from '../types/graph';
import { Loader2, AlertCircle, GitBranch, Clock, FileCode2, Network } from 'lucide-react';

export function CodebaseVizPage() {
  const { data, loading, error, refetch } = useGraphData();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filters, setFilters] = useState<GraphFilters>({
    language: 'all',
    type: 'all',
    directory: 'all',
    search: '',
  });

  // Get unique file types from data
  const fileTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set(data.nodes.map((n) => n.type));
    return Array.from(types) as FileType[];
  }, [data]);

  // Filter nodes based on current filters
  const filteredData = useMemo(() => {
    if (!data) return null;

    let nodes = data.nodes;
    let edges = data.edges;

    // Filter by language
    if (filters.language !== 'all') {
      nodes = nodes.filter((n) => n.language === filters.language);
    }

    // Filter by type
    if (filters.type !== 'all') {
      nodes = nodes.filter((n) => n.type === filters.type);
    }

    // Filter by directory
    if (filters.directory !== 'all') {
      nodes = nodes.filter((n) => n.directory.startsWith(filters.directory));
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(searchLower) ||
          n.path.toLowerCase().includes(searchLower)
      );
    }

    // Filter edges to only include visible nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    // Filter directories to only include those with visible nodes
    const visibleDirs = new Set<string>();
    nodes.forEach((n) => {
      const parts = n.directory.split('/');
      for (let i = 1; i <= parts.length; i++) {
        visibleDirs.add(parts.slice(0, i).join('/'));
      }
    });
    const directories = data.directories.filter((d) => visibleDirs.has(d.id));

    return {
      ...data,
      nodes,
      edges,
      directories,
    };
  }, [data, filters]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (!nodeId) {
        setSelectedNode(null);
        return;
      }
      const node = data?.nodes.find((n) => n.id === nodeId) || null;
      setSelectedNode(node);
    },
    [data]
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <DashboardLayout title="Codebase Visualization" currentPath="/viz">
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Loading dependency graph...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout title="Codebase Visualization" currentPath="/viz">
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <div>
              <p className="text-lg font-medium text-slate-200">
                Failed to load graph
              </p>
              <p className="text-sm text-slate-400 mt-1">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data || !filteredData) return null;

  return (
    <DashboardLayout title="Codebase Visualization" currentPath="/viz">
      <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
        {/* Metadata Header */}
        <div className="shrink-0 flex flex-wrap items-center gap-6 px-4 py-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-3">
            <Network className="h-5 w-5 text-violet-400" />
            <span className="text-sm font-medium text-slate-200">
              Architecture Map
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <GitBranch className="h-4 w-4" />
            <span>{data.metadata.branch}</span>
            <code className="px-1.5 py-0.5 bg-slate-700/50 rounded text-xs text-slate-300">
              {data.metadata.commit}
            </code>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="h-4 w-4" />
            <span>
              {new Date(data.metadata.generatedAt).toLocaleDateString()}{' '}
              {new Date(data.metadata.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <FileCode2 className="h-4 w-4" />
            <span>
              {filteredData.nodes.length} / {data.metadata.totalFiles} files
            </span>
          </div>
        </div>

        {/* Controls */}
        <GraphControls
          filters={filters}
          onFiltersChange={setFilters}
          directories={data.directories}
          fileTypes={fileTypes}
        />

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Graph Canvas */}
          <div className="flex-1 overflow-hidden rounded-lg border border-slate-700">
            <GraphCanvas
              nodes={filteredData.nodes}
              edges={filteredData.edges}
              directories={filteredData.directories}
              selectedNode={selectedNode?.id}
              onNodeClick={handleNodeClick}
            />
          </div>

          {/* Details Panel */}
          {selectedNode && (
            <NodeDetails
              node={selectedNode}
              edges={data.edges}
              nodes={data.nodes}
              onClose={handleCloseDetails}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>

        {/* Legend */}
        <div className="shrink-0 flex flex-wrap items-center gap-4 px-4 py-2 text-xs text-slate-400">
          <span className="font-medium">Legend:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>Component</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-violet-500" />
            <span>Page</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-amber-500" />
            <span>Store</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-500" />
            <span>API</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span>Agent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>Route</span>
          </div>
          <span className="mx-2 text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-sm border border-slate-500" />
            <span>TypeScript</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rotate-45 border border-slate-500" />
            <span>Python</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
