import { ChevronRight, Building2, MapPin, Layers } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Tree Node Components
// ─────────────────────────────────────────────────────────────────────────────

function TreeRoot({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <Building2 className="h-4 w-4 text-purple-600" />
        <span>{label}</span>
      </div>
      {children && (
        <div className="ml-4 pl-2 border-l border-gray-200 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

function TreeRegion({
  code,
  name,
  children,
  companyCode,
}: {
  code: string;
  name: string;
  children?: React.ReactNode;
  companyCode?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <ChevronRight className="h-3 w-3 text-gray-400" />
        <MapPin className="h-4 w-4 text-purple-500" />
        <span className="font-mono text-xs bg-gray-100 px-1 rounded">{code}</span>
        <span className="text-gray-700">{name || '(unnamed)'}</span>
        {companyCode && (
          <span className="text-xs text-gray-500 ml-auto">CC: {companyCode}</span>
        )}
      </div>
      {children && (
        <div className="ml-6 pl-2 border-l border-gray-200 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

function TreeSubarea({ code, description }: { code: string; description: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <ChevronRight className="h-3 w-3 text-gray-400" />
      <Layers className="h-3 w-3 text-purple-400" />
      <span className="font-mono text-xs bg-purple-50 px-1 rounded">{code}</span>
      <span className="text-gray-600">{description || '(no description)'}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function LivePreviewPanel() {
  const {
    orgType,
    regions,
    subareas,
    companyCodeMode,
    globalCompanyCode,
    regionCompanyCodes,
  } = usePersonnelAreaV2Store();

  // Generate summary stats
  const totalRegions = regions.length;
  const regionsWithSubareas = regions.filter((r) => r.needsSubareas).length;
  const totalSubareas = subareas.length;

  // Get company code for a region
  const getRegionCompanyCode = (regionId: string): string | undefined => {
    if (companyCodeMode === 'same') {
      return globalCompanyCode || undefined;
    }
    return regionCompanyCodes[regionId] || undefined;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Live Preview</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Your SAP structure
        </p>
      </div>

      {/* Tree View */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {regions.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">
            Add regions to see preview
          </div>
        ) : (
          <TreeRoot label={orgType === 'single' ? 'Organization' : 'Enterprise'}>
            {regions.map((region) => {
              const regionSubareas = subareas.filter((s) => s.regionId === region.id);
              const hasSubareas = region.needsSubareas && regionSubareas.length > 0;

              return (
                <TreeRegion
                  key={region.id}
                  code={region.code}
                  name={region.name}
                  companyCode={getRegionCompanyCode(region.id)}
                >
                  {hasSubareas ? (
                    regionSubareas.map((subarea) => (
                      <TreeSubarea
                        key={subarea.id}
                        code={subarea.code}
                        description={subarea.description}
                      />
                    ))
                  ) : (
                    <TreeSubarea code="9999" description="General" />
                  )}
                </TreeRegion>
              );
            })}
          </TreeRoot>
        )}
      </div>

      {/* Summary Stats */}
      {regions.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold text-purple-600">{totalRegions}</p>
              <p className="text-xs text-gray-500">Personnel Areas</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-purple-600">{regionsWithSubareas}</p>
              <p className="text-xs text-gray-500">With Subareas</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-purple-600">
                {totalSubareas || regions.length}
              </p>
              <p className="text-xs text-gray-500">Total Subareas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
