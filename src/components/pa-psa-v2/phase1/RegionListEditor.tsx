import { Plus, Trash2, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getRegionErrors(
  region: { id: string; code: string; name: string },
  allRegions: { id: string; code: string; name: string }[]
): string[] {
  const errors: string[] = [];

  if (!region.code) {
    errors.push('Code is required');
  } else if (region.code.length !== 4) {
    errors.push('Code must be 4 characters');
  }

  if (!region.name) {
    errors.push('Name is required');
  }

  // Check for duplicate codes
  const duplicates = allRegions.filter(
    (r) => r.code === region.code && r.id !== region.id
  );
  if (duplicates.length > 0) {
    errors.push('Duplicate code');
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Region Row Component
// ─────────────────────────────────────────────────────────────────────────────

function RegionRow({
  region,
  allRegions,
  onUpdate,
  onRemove,
  canRemove,
}: {
  region: { id: string; code: string; name: string };
  allRegions: { id: string; code: string; name: string }[];
  onUpdate: (updates: { code?: string; name?: string }) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const errors = getRegionErrors(region, allRegions);
  const hasErrors = errors.length > 0;

  return (
    <tr className={hasErrors ? 'bg-red-50' : ''}>
      {/* Code */}
      <td className="px-4 py-3">
        <input
          type="text"
          value={region.code}
          onChange={(e) => onUpdate({ code: e.target.value.toUpperCase().slice(0, 4) })}
          placeholder="1000"
          maxLength={4}
          className={`
            w-24 px-3 py-2 border rounded-lg font-mono text-sm uppercase
            focus:outline-none focus:ring-2
            ${hasErrors
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20'
            }
          `}
        />
      </td>

      {/* Name */}
      <td className="px-4 py-3">
        <input
          type="text"
          value={region.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g., Southwest, Corporate HQ"
          className={`
            w-full px-3 py-2 border rounded-lg text-sm
            focus:outline-none focus:ring-2
            ${hasErrors
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20'
            }
          `}
        />
      </td>

      {/* Errors */}
      <td className="px-4 py-3 w-48">
        {hasErrors && (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span>{errors[0]}</span>
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-16 text-center">
        <button
          onClick={onRemove}
          disabled={!canRemove}
          className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function RegionListEditor() {
  const {
    orgType,
    regions,
    addRegion,
    updateRegion,
    removeRegion,
    goBack,
    goNext,
    canProceed,
  } = usePersonnelAreaV2Store();

  const isRegional = orgType === 'regional';
  const termSingular = isRegional ? 'region' : 'division';
  const termPlural = isRegional ? 'regions' : 'divisions';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Define your {termPlural}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Add each {termSingular} that needs its own Personnel Area in SAP.
        </p>
      </div>

      {/* Why This Matters */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-900 mb-1">Why this matters</h4>
        <p className="text-sm text-purple-800">
          Each {termSingular} becomes a Personnel Area (PERSA) in SAP. The 4-character code
          is used in SAP tables (T500P). Choose codes that are meaningful to your organization.
        </p>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Code (4 chars)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {isRegional ? 'Region' : 'Division'} Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {regions.map((region) => (
              <RegionRow
                key={region.id}
                region={region}
                allRegions={regions}
                onUpdate={(updates) => updateRegion(region.id, updates)}
                onRemove={() => removeRegion(region.id)}
                canRemove={regions.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Button */}
      <button
        onClick={addRegion}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add {termSingular}
      </button>

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
