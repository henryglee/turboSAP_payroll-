import { Building2, MapPin, GitBranch, ArrowRight } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';
import type { OrgType } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OrgTypeOption {
  id: OrgType;
  icon: typeof Building2;
  title: string;
  description: string;
  details: string[];
  example: string;
}

const OPTIONS: OrgTypeOption[] = [
  {
    id: 'single',
    icon: Building2,
    title: 'Single Location',
    description: 'One location, consistent policies across the organization',
    details: [
      'One personnel area',
      'Same pay rules for everyone',
      'Fastest to configure',
    ],
    example: 'Small business, single office',
  },
  {
    id: 'regional',
    icon: MapPin,
    title: 'Regional Structure',
    description: 'Multiple geographic regions with different requirements',
    details: [
      'Multiple personnel areas by location',
      'Different tax, benefits, or pay by region',
      'Most common structure',
    ],
    example: 'Offices in TX, CA, NY with state-specific rules',
  },
  {
    id: 'divisional',
    icon: GitBranch,
    title: 'Divisional Structure',
    description: 'Business units or divisions with different configurations',
    details: [
      'Multiple personnel areas by division',
      'Different pay scales or benefits by unit',
      'For complex organizations',
    ],
    example: 'Retail vs. Corporate vs. Manufacturing',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Selection Card Component
// ─────────────────────────────────────────────────────────────────────────────

function OrgTypeCard({
  option,
  isSelected,
  onSelect,
}: {
  option: OrgTypeOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;

  return (
    <button
      onClick={onSelect}
      className={`
        relative flex flex-col items-start text-left p-6 rounded-xl border-2 transition-all w-full
        ${isSelected
          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Icon */}
      <div className={`
        w-12 h-12 rounded-lg flex items-center justify-center mb-4
        ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}
      `}>
        <Icon className="h-6 w-6" />
      </div>

      {/* Title & Description */}
      <h3 className={`text-lg font-semibold mb-2 ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
        {option.title}
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {option.description}
      </p>

      {/* Details */}
      <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
        {option.details.map((detail, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-purple-500' : 'bg-gray-400'}`} />
            <span>{detail}</span>
          </li>
        ))}
      </ul>

      {/* Example */}
      <div className="mt-auto pt-3 border-t border-gray-200 w-full">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Example:</span> {option.example}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function OrgTypeSelector() {
  const { orgType, setOrgType, goNext, canProceed } = usePersonnelAreaV2Store();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          How is your organization structured?
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          This determines how we'll set up your Personnel Areas in SAP.
        </p>
      </div>

      {/* Why This Matters */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-900 mb-1">Why this matters</h4>
        <p className="text-sm text-purple-800">
          Personnel Areas (PERSA) group employees by location or division. They control which pay rules,
          benefits, and tax settings apply. Getting this right ensures accurate payroll processing.
        </p>
      </div>

      {/* Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {OPTIONS.map((option) => (
          <OrgTypeCard
            key={option.id}
            option={option}
            isSelected={orgType === option.id}
            onSelect={() => setOrgType(option.id)}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
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
