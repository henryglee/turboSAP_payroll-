/**
 * GraphControls - Filter and search controls for the visualization
 */

import { Search, Filter, RotateCcw } from 'lucide-react';
import type { GraphDirectory, GraphFilters, FileType } from '../../types/graph';

interface GraphControlsProps {
  filters: GraphFilters;
  onFiltersChange: (filters: GraphFilters) => void;
  directories: GraphDirectory[];
  fileTypes: FileType[];
}

export function GraphControls({
  filters,
  onFiltersChange,
  directories,
  fileTypes,
}: GraphControlsProps) {
  const topLevelDirs = directories.filter((d) => !d.parent);

  return (
    <div className="shrink-0 flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search files..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {/* Language Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={filters.language}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              language: e.target.value as GraphFilters['language'],
            })
          }
          className="px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All Languages</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
        </select>
      </div>

      {/* File Type Filter */}
      <select
        value={filters.type}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            type: e.target.value as GraphFilters['type'],
          })
        }
        className="px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        <option value="all">All Types</option>
        {fileTypes.map((type) => (
          <option key={type} value={type}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </option>
        ))}
      </select>

      {/* Directory Filter */}
      <select
        value={filters.directory}
        onChange={(e) =>
          onFiltersChange({ ...filters, directory: e.target.value })
        }
        className="px-3 py-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        <option value="all">All Directories</option>
        {topLevelDirs.map((dir) => (
          <option key={dir.id} value={dir.id}>
            {dir.label} ({dir.fileCount})
          </option>
        ))}
      </select>

      {/* Reset Button */}
      <button
        onClick={() =>
          onFiltersChange({
            language: 'all',
            type: 'all',
            directory: 'all',
            search: '',
          })
        }
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-md transition-colors"
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </button>
    </div>
  );
}
