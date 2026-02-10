import { Building2, MapPin, Layers, Building, Check } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Tree Node Components
// ─────────────────────────────────────────────────────────────────────────────

function TreeNode({
  icon: Icon,
  iconColor,
  code,
  name,
  meta,
  children,
  level = 0,
}: {
  icon: typeof Building2;
  iconColor: string;
  code: string;
  name: string;
  meta?: string;
  children?: React.ReactNode;
  level?: number;
}) {
  return (
    <div className={level > 0 ? 'ml-6 pl-3 border-l border-gray-200' : ''}>
      <div className="flex items-center gap-2 py-1.5">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{code}</span>
        <span className="text-sm text-gray-900">{name}</span>
        {meta && <span className="text-xs text-gray-500 ml-auto">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Stats Component
// ─────────────────────────────────────────────────────────────────────────────

function SummaryStats({
  stats,
}: {
  stats: { label: string; value: number | string; icon: typeof Building2 }[];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="bg-purple-50 border border-purple-100 rounded-lg p-4 text-center"
          >
            <Icon className="h-5 w-5 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-700">{stat.value}</p>
            <p className="text-xs text-purple-600 font-medium">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function StructureReview() {
  const {
    orgType,
    regions,
    subareas,
    companyCodeMode,
    globalCompanyCode,
    regionCompanyCodes,
  } = usePersonnelAreaV2Store();

  // Calculate stats
  const totalRegions = regions.length;
  const totalSubareas = subareas.length || regions.length; // Default 9999 for each region
  const uniqueCompanyCodes = companyCodeMode === 'same'
    ? 1
    : new Set(Object.values(regionCompanyCodes)).size;

  const stats = [
    { label: 'Personnel Areas', value: totalRegions, icon: MapPin },
    { label: 'Personnel Subareas', value: totalSubareas, icon: Layers },
    { label: 'Company Codes', value: uniqueCompanyCodes, icon: Building },
    { label: 'SAP Tables', value: 2, icon: Check },
  ];

  // Get company code for a region
  const getCompanyCode = (regionId: string): string => {
    if (companyCodeMode === 'same') {
      return globalCompanyCode;
    }
    return regionCompanyCodes[regionId] || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Review Your Structure
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Here's a summary of your Personnel Area and Subarea configuration.
        </p>
      </div>

      {/* Summary Stats */}
      <SummaryStats stats={stats} />

      {/* Structure Tree */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Organization Structure</h3>

        <TreeNode
          icon={Building2}
          iconColor="text-purple-600"
          code="ROOT"
          name={orgType === 'single' ? 'Single Location' : orgType === 'regional' ? 'Regional Structure' : 'Divisional Structure'}
        >
          {regions.map((region) => {
            const regionSubareas = subareas.filter((s) => s.regionId === region.id);
            const companyCode = getCompanyCode(region.id);

            return (
              <TreeNode
                key={region.id}
                icon={MapPin}
                iconColor="text-purple-500"
                code={region.code}
                name={region.name}
                meta={companyCode ? `CC: ${companyCode}` : undefined}
                level={1}
              >
                {regionSubareas.length > 0 ? (
                  regionSubareas.map((subarea) => (
                    <TreeNode
                      key={subarea.id}
                      icon={Layers}
                      iconColor="text-purple-400"
                      code={subarea.code}
                      name={subarea.description}
                      level={2}
                    />
                  ))
                ) : (
                  <TreeNode
                    icon={Layers}
                    iconColor="text-gray-400"
                    code="9999"
                    name="General"
                    meta="(default)"
                    level={2}
                  />
                )}
              </TreeNode>
            );
          })}
        </TreeNode>
      </div>

      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-green-900 mb-1">
              Configuration Complete
            </h4>
            <p className="text-sm text-green-800">
              Your Personnel Area structure is ready. Preview the SAP files below and download when ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
