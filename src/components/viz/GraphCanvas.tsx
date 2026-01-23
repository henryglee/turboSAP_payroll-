/**
 * GraphCanvas - Cytoscape.js wrapper for dependency graph visualization
 *
 * Features:
 * - Compound nodes for directory grouping
 * - Color coding by file type
 * - Shape coding by language (rectangle=TS, diamond=Python)
 * - Interactive pan/zoom
 * - Node selection highlighting
 */

import { useRef, useEffect, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { GraphNode, GraphEdge, GraphDirectory } from '../../types/graph';

// Color palette for file types
const TYPE_COLORS: Record<string, string> = {
  page: '#8b5cf6',      // violet
  component: '#3b82f6', // blue
  store: '#f59e0b',     // amber
  api: '#10b981',       // emerald
  hook: '#ec4899',      // pink
  util: '#6b7280',      // gray
  type: '#06b6d4',      // cyan
  agent: '#ef4444',     // red
  route: '#22c55e',     // green
  service: '#f97316',   // orange
  config: '#a855f7',    // purple
  other: '#9ca3af',     // gray-400
};

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directories: GraphDirectory[];
  selectedNode?: string;
  onNodeClick: (nodeId: string) => void;
}

export function GraphCanvas({
  nodes,
  edges,
  directories,
  selectedNode,
  onNodeClick,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Build Cytoscape elements
  const buildElements = useCallback(() => {
    const elements: cytoscape.ElementDefinition[] = [];

    // Add directory (compound) nodes
    directories.forEach((dir) => {
      elements.push({
        data: {
          id: `dir:${dir.id}`,
          label: dir.label,
          parent: dir.parent ? `dir:${dir.parent}` : undefined,
          isDirectory: true,
        },
        classes: 'directory',
      });
    });

    // Add file nodes
    nodes.forEach((node) => {
      elements.push({
        data: {
          id: node.id,
          label: node.label,
          parent: node.directory ? `dir:${node.directory}` : undefined,
          fileType: node.type,
          language: node.language,
          loc: node.loc,
          exportCount: node.exports.length,
        },
        classes: `file ${node.language} ${node.type}`,
      });
    });

    // Add edges
    edges.forEach((edge) => {
      // Only add edge if both source and target exist
      const hasSource = nodes.some((n) => n.id === edge.source);
      const hasTarget = nodes.some((n) => n.id === edge.target);
      if (hasSource && hasTarget) {
        elements.push({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
          },
          classes: 'dependency',
        });
      }
    });

    return elements;
  }, [nodes, edges, directories]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(),

      style: [
        // Directory (compound) nodes
        {
          selector: '.directory',
          style: {
            'background-color': '#1e293b',
            'background-opacity': 0.3,
            'border-width': 1,
            'border-color': '#334155',
            label: 'data(label)',
            'text-valign': 'top',
            'text-halign': 'center',
            'font-size': '11px',
            color: '#94a3b8',
            'padding': '25px',
            shape: 'round-rectangle',
          },
        },

        // File nodes - base style
        {
          selector: '.file',
          style: {
            width: 35,
            height: 35,
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '9px',
            color: '#e2e8f0',
            'text-margin-y': 6,
            'text-wrap': 'ellipsis',
            'text-max-width': '70px',
            'border-width': 2,
            'border-color': '#1e293b',
          },
        },

        // File type colors
        ...Object.entries(TYPE_COLORS).map(([type, color]) => ({
          selector: `.file.${type}`,
          style: {
            'background-color': color,
          },
        })),

        // Language shapes
        {
          selector: '.file.typescript',
          style: {
            shape: 'round-rectangle' as const,
          },
        },
        {
          selector: '.file.python',
          style: {
            shape: 'diamond' as const,
          },
        },

        // Selected node
        {
          selector: '.file:selected',
          style: {
            'border-width': 3,
            'border-color': '#fbbf24',
            width: 45,
            height: 45,
          },
        },

        // Hovered node
        {
          selector: '.file:active',
          style: {
            'border-color': '#60a5fa',
          },
        },

        // Edges
        {
          selector: '.dependency',
          style: {
            width: 1,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.7,
            opacity: 0.5,
          },
        },

        // Highlighted edges (when node selected)
        {
          selector: '.dependency.highlighted',
          style: {
            width: 2,
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24',
            opacity: 1,
            'z-index': 100,
          },
        },
      ],

      layout: {
        name: 'cose',
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 5000,
        idealEdgeLength: () => 80,
        edgeElasticity: () => 0.1,
        nestingFactor: 0.5,
        gravity: 0.3,
        numIter: 300,
        animate: false,
      },

      minZoom: 0.1,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    });

    // Event handlers
    cy.on('tap', 'node.file', (event) => {
      const nodeId = event.target.id();
      onNodeClick(nodeId);
    });

    // Clear selection when clicking background
    cy.on('tap', (event) => {
      if (event.target === cy) {
        onNodeClick('');
      }
    });

    // Store reference
    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [buildElements, onNodeClick]);

  // Update selection highlighting
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Clear previous highlights
    cy.elements().removeClass('highlighted');
    cy.$(':selected').unselect();

    if (selectedNode) {
      // Select the node
      const node = cy.$(`#${CSS.escape(selectedNode)}`);
      if (node.length > 0) {
        node.select();
        // Highlight connected edges
        node.connectedEdges().addClass('highlighted');
      }
    }
  }, [selectedNode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-900 rounded-lg"
      style={{ minHeight: '500px' }}
    />
  );
}
