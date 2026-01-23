/**
 * Types for codebase visualization graph data
 */

export type FileType =
  | 'component'
  | 'page'
  | 'store'
  | 'api'
  | 'util'
  | 'type'
  | 'hook'
  | 'agent'
  | 'route'
  | 'service'
  | 'config'
  | 'other';

export type Language = 'typescript' | 'python';

export type ExportKind = 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';

export interface GraphExport {
  name: string;
  kind: ExportKind;
}

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  type: FileType;
  language: Language;
  directory: string;
  exports: GraphExport[];
  loc?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  importType?: 'named' | 'default' | 'namespace' | 'side-effect' | 'relative' | 'package';
}

export interface GraphDirectory {
  id: string;
  label: string;
  parent: string | null;
  fileCount: number;
}

export interface GraphMetadata {
  generatedAt: string;
  commit: string;
  branch: string;
  totalFiles: number;
  totalEdges: number;
}

export interface GraphData {
  metadata: GraphMetadata;
  nodes: GraphNode[];
  edges: GraphEdge[];
  directories: GraphDirectory[];
}

export interface GraphFilters {
  language: 'all' | Language;
  type: 'all' | FileType;
  directory: string;
  search: string;
}
