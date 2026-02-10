import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, AlertCircle, ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';
import type { Region, Subarea } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getSubareaErrors(
  subarea: Subarea,
  allSubareas: Subarea[]
): string[] {
  const errors: string[] = [];

  if (!subarea.code) {
    errors.push('Code is required');
  } else if (subarea.code.length !== 4) {
    errors.push('Code must be 4 characters');
  }

  if (!subarea.description) {
    errors.push('Description is required');
  } else if (subarea.description.length > 15) {
    errors.push('Description max 15 chars');
  }

  // Check for duplicate codes within same region
  const duplicates = allSubareas.filter(
    (s) => s.code === subarea.code && s.id !== subarea.id && s.regionId === subarea.regionId
  );
  if (duplicates.length > 0) {
    errors.push('Duplicate code');
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subarea Row Component
// ─────────────────────────────────────────────────────────────────────────────

function SubareaRow({
  subarea,
  allSubareas,
  onUpdate,
  onRemove,
  canRemove,
}: {
  subarea: Subarea;
  allSubareas: Subarea[];
  onUpdate: (updates: Partial<Omit<Subarea, 'id' | 'regionId'>>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const errors = getSubareaErrors(subarea, allSubareas);
  const hasErrors = errors.length > 0;

  return (
    <tr className={hasErrors ? 'bg-red-50' : ''}>
      {/* Code */}
      <td className="px-4 py-2">
        <input
          type="text"
          value={subarea.code}
          onChange={(e) => onUpdate({ code: e.target.value.toUpperCase().slice(0, 4) })}
          placeholder="CODE"
          maxLength={4}
          className={`
            w-20 px-2 py-1.5 border rounded font-mono text-sm uppercase
            focus:outline-none focus:ring-2
            ${hasErrors
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20'
            }
          `}
        />
      </td>

      {/* Description */}
      <td className="px-4 py-2">
        <input
          type="text"
          value={subarea.description}
          onChange={(e) => onUpdate({ description: e.target.value.slice(0, 15) })}
          placeholder="Description (max 15 chars)"
          maxLength={15}
          className={`
            w-full px-2 py-1.5 border rounded text-sm
            focus:outline-none focus:ring-2
            ${hasErrors
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20'
            }
          `}
        />
      </td>

      {/* Notes */}
      <td className="px-4 py-2">
        <input
          type="text"
          value={subarea.notes || ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Optional notes"
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:border-purple-500 focus:ring-purple-500/20"
        />
      </td>

      {/* Errors */}
      <td className="px-4 py-2 w-36">
        {hasErrors && (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{errors[0]}</span>
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-2 w-12 text-center">
        <button
          onClick={onRemove}
          disabled={!canRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Region Accordion Component
// ─────────────────────────────────────────────────────────────────────────────

function RegionAccordion({
  region,
  subareas,
  allSubareas,
  isExpanded,
  onToggle,
  onAddSubarea,
  onUpdateSubarea,
  onRemoveSubarea,
}: {
  region: Region;
  subareas: Subarea[];
  allSubareas: Subarea[];
  isExpanded: boolean;
  onToggle: () => void;
  onAddSubarea: () => void;
  onUpdateSubarea: (id: string, updates: Partial<Omit<Subarea, 'id' | 'regionId'>>) => void;
  onRemoveSubarea: (id: string) => void;
}) {
  // Check if any subarea has errors
  const hasErrors = subareas.some((s) => getSubareaErrors(s, allSubareas).length > 0);

  return (
    <div className={`border rounded-lg overflow-hidden ${hasErrors ? 'border-red-300' : 'border-gray-200'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-3 px-4 py-3 transition-colors text-left
          ${hasErrors ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'}
        `}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
        <MapPin className={`h-4 w-4 ${hasErrors ? 'text-red-500' : 'text-purple-500'}`} />
        <span className="font-mono text-sm bg-gray-200 px-1.5 py-0.5 rounded">{region.code}</span>
        <span className="font-medium text-gray-900">{region.name}</span>
        <span className="ml-auto text-sm text-gray-500">
          {subareas.length} subarea{subareas.length !== 1 ? 's' : ''}
        </span>
        {hasErrors && (
          <AlertCircle className="h-4 w-4 text-red-500" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Notes</th>
                  <th className="px-4 py-2 w-36">Status</th>
                  <th className="px-4 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subareas.map((subarea) => (
                  <SubareaRow
                    key={subarea.id}
                    subarea={subarea}
                    allSubareas={allSubareas}
                    onUpdate={(updates) => onUpdateSubarea(subarea.id, updates)}
                    onRemove={() => onRemoveSubarea(subarea.id)}
                    canRemove={subareas.length > 1}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Button */}
          <button
            onClick={onAddSubarea}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Subarea
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function SubareaEditor() {
  const {
    regions,
    subareas,
    addSubarea,
    updateSubarea,
    removeSubarea,
    goBack,
    goNext,
    canProceed,
  } = usePersonnelAreaV2Store();

  // Only show regions that need subareas
  const regionsWithSubareas = regions.filter((r) => r.needsSubareas);

  // Track expanded accordions
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(
    new Set(regionsWithSubareas.map((r) => r.id))
  );

  const toggleRegion = (regionId: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Define Personnel Subareas
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          For each region, add the subareas that represent different configurations.
        </p>
      </div>

      {/* Why This Matters */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-900 mb-1">Why this matters</h4>
        <p className="text-sm text-purple-800">
          Personnel Subareas (BTRTL in T001P) let you apply different pay scales, benefits, or
          tax settings within the same Personnel Area. Common examples: union vs. non-union,
          exempt vs. non-exempt, different office locations.
        </p>
      </div>

      {/* Region Accordions */}
      <div className="space-y-4">
        {regionsWithSubareas.map((region) => {
          const regionSubareas = subareas.filter((s) => s.regionId === region.id);

          return (
            <RegionAccordion
              key={region.id}
              region={region}
              subareas={regionSubareas}
              allSubareas={subareas}
              isExpanded={expandedRegions.has(region.id)}
              onToggle={() => toggleRegion(region.id)}
              onAddSubarea={() => addSubarea(region.id)}
              onUpdateSubarea={updateSubarea}
              onRemoveSubarea={removeSubarea}
            />
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={goNext}
          disabled={!canProceed()}
          className={`
            inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
            ${canProceed()
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
