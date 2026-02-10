import { MapPin, Layers, ArrowLeft, ArrowRight } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Region Toggle Card Component
// ─────────────────────────────────────────────────────────────────────────────

function RegionToggleCard({
  region,
  onToggle,
}: {
  region: { id: string; code: string; name: string; needsSubareas: boolean };
  onToggle: (needsSubareas: boolean) => void;
}) {
  const { needsSubareas } = region;

  return (
    <div className={`
      p-4 rounded-lg border-2 transition-all
      ${needsSubareas
        ? 'border-purple-500 bg-purple-50'
        : 'border-gray-200 bg-white'
      }
    `}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${needsSubareas ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}
        `}>
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <p className="font-mono text-sm text-gray-500">{region.code}</p>
          <h4 className="font-medium text-gray-900">{region.name}</h4>
        </div>
      </div>

      {/* Toggle Options */}
      <div className="space-y-2">
        <button
          onClick={() => onToggle(false)}
          className={`
            w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left
            ${!needsSubareas
              ? 'border-purple-500 bg-white ring-2 ring-purple-500/20'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className={`
            w-4 h-4 rounded-full border-2 flex items-center justify-center
            ${!needsSubareas ? 'border-purple-500' : 'border-gray-300'}
          `}>
            {!needsSubareas && <div className="w-2 h-2 rounded-full bg-purple-500" />}
          </div>
          <div>
            <p className={`font-medium ${!needsSubareas ? 'text-purple-900' : 'text-gray-700'}`}>
              Same configuration
            </p>
            <p className="text-sm text-gray-500">
              Auto-creates "9999 General" subarea
            </p>
          </div>
        </button>

        <button
          onClick={() => onToggle(true)}
          className={`
            w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left
            ${needsSubareas
              ? 'border-purple-500 bg-white ring-2 ring-purple-500/20'
              : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <div className={`
            w-4 h-4 rounded-full border-2 flex items-center justify-center
            ${needsSubareas ? 'border-purple-500' : 'border-gray-300'}
          `}>
            {needsSubareas && <div className="w-2 h-2 rounded-full bg-purple-500" />}
          </div>
          <div>
            <p className={`font-medium ${needsSubareas ? 'text-purple-900' : 'text-gray-700'}`}>
              Needs subareas
            </p>
            <p className="text-sm text-gray-500">
              Define custom subareas in next step
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function RegionSubareaToggle() {
  const {
    regions,
    differenceFactors,
    setRegionNeedsSubareas,
    goBack,
    goNext,
    canProceed,
  } = usePersonnelAreaV2Store();

  const regionsNeedingSubareas = regions.filter((r) => r.needsSubareas);

  // Get factor labels for display
  const FACTOR_LABELS: Record<string, string> = {
    pay: 'Pay Structure',
    benefits: 'Benefits',
    pto: 'PTO / Leave',
    schedules: 'Work Schedules',
    tax: 'Tax Requirements',
    compliance: 'Compliance Rules',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Which regions need subareas?
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          For each region, decide if you need custom Personnel Subareas to handle your configuration differences.
        </p>
      </div>

      {/* Selected Factors Reminder */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Layers className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-purple-900 mb-1">
              You selected these difference factors:
            </h4>
            <div className="flex flex-wrap gap-2">
              {differenceFactors.map((factor) => (
                <span
                  key={factor}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded"
                >
                  {FACTOR_LABELS[factor] || factor}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Region Toggle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {regions.map((region) => (
          <RegionToggleCard
            key={region.id}
            region={region}
            onToggle={(needsSubareas) => setRegionNeedsSubareas(region.id, needsSubareas)}
          />
        ))}
      </div>

      {/* Summary */}
      <div className={`
        p-4 rounded-lg border
        ${regionsNeedingSubareas.length > 0
          ? 'bg-purple-50 border-purple-200'
          : 'bg-yellow-50 border-yellow-200'
        }
      `}>
        {regionsNeedingSubareas.length > 0 ? (
          <p className="text-sm text-purple-800">
            <span className="font-medium">{regionsNeedingSubareas.length} region{regionsNeedingSubareas.length > 1 ? 's' : ''}</span> will
            have custom subareas. You'll define them in the next step.
          </p>
        ) : (
          <p className="text-sm text-yellow-800">
            <span className="font-medium">No regions selected for subareas.</span> Please select at least one region
            that needs custom subareas, or go back and remove the difference factors.
          </p>
        )}
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
