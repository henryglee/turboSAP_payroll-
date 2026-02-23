import { DollarSign, Heart, Calendar, Clock, FileText, Shield, ArrowLeft, ArrowRight } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DifferenceFactor {
  id: string;
  icon: typeof DollarSign;
  title: string;
  description: string;
  example: string;
}

const FACTORS: DifferenceFactor[] = [
  {
    id: 'pay',
    icon: DollarSign,
    title: 'Pay Structure',
    description: 'Different pay scales, rates, or wage types',
    example: 'California has different minimum wage than Texas',
  },
  {
    id: 'benefits',
    icon: Heart,
    title: 'Benefits',
    description: 'Different health plans, 401k, or perks',
    example: 'HQ employees get gym membership, remote don\'t',
  },
  {
    id: 'pto',
    icon: Calendar,
    title: 'PTO / Leave',
    description: 'Different vacation accrual or leave policies',
    example: 'California mandates sick leave differently',
  },
  {
    id: 'schedules',
    icon: Clock,
    title: 'Work Schedules',
    description: 'Different shift patterns or work weeks',
    example: 'Manufacturing runs 24/7, office is 9-5',
  },
  {
    id: 'tax',
    icon: FileText,
    title: 'Tax Requirements',
    description: 'Different state or local tax withholding',
    example: 'NY has city tax, FL has no state income tax',
  },
  {
    id: 'compliance',
    icon: Shield,
    title: 'Compliance Rules',
    description: 'Different regulatory or union requirements',
    example: 'Certain locations have union contracts',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Factor Checkbox Component
// ─────────────────────────────────────────────────────────────────────────────

function FactorCheckbox({
  factor,
  isChecked,
  onToggle,
}: {
  factor: DifferenceFactor;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const Icon = factor.icon;

  return (
    <button
      onClick={onToggle}
      className={`
        flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left w-full
        ${isChecked
          ? 'border-purple-500 bg-purple-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      {/* Checkbox */}
      <div className={`
        w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
        ${isChecked
          ? 'border-purple-500 bg-purple-500'
          : 'border-gray-300'
        }
      `}>
        {isChecked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <div className={`
        w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
        ${isChecked ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}
      `}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={`font-medium ${isChecked ? 'text-purple-900' : 'text-gray-900'}`}>
          {factor.title}
        </h4>
        <p className="text-sm text-gray-600 mt-0.5">
          {factor.description}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          <span className="font-medium">Example:</span> {factor.example}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function DifferenceFactors() {
  const {
    differenceFactors,
    toggleDifferenceFactor,
    goBack,
    goNext,
  } = usePersonnelAreaV2Store();

  const selectedCount = differenceFactors.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          What varies between your regions?
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Select all the factors that differ across your locations. This determines if you need Personnel Subareas.
        </p>
      </div>

      {/* Why This Matters */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-900 mb-1">Why this matters</h4>
        <p className="text-sm text-purple-800">
          Personnel Subareas (BTRTL) let you have different configurations within the same Personnel Area.
          If all your regions have the same policies, you may not need subareas at all.
        </p>
      </div>

      {/* Factor Checkboxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FACTORS.map((factor) => (
          <FactorCheckbox
            key={factor.id}
            factor={factor}
            isChecked={differenceFactors.includes(factor.id)}
            onToggle={() => toggleDifferenceFactor(factor.id)}
          />
        ))}
      </div>

      {/* Selection Summary */}
      <div className={`
        p-4 rounded-lg border
        ${selectedCount === 0
          ? 'bg-gray-50 border-gray-200'
          : 'bg-purple-50 border-purple-200'
        }
      `}>
        {selectedCount === 0 ? (
          <p className="text-sm text-gray-600">
            <span className="font-medium">No differences selected.</span> You can proceed without subareas,
            and we'll create a default "9999 General" subarea for each region.
          </p>
        ) : (
          <p className="text-sm text-purple-800">
            <span className="font-medium">{selectedCount} factor{selectedCount > 1 ? 's' : ''} selected.</span> Next,
            you'll specify which regions need Personnel Subareas to handle these differences.
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
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
