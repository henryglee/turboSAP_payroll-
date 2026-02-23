import { Check, Building2, MapPin, Settings, ListChecks, Building, FileDown } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../stores/usePersonnelAreaV2Store';
import type { WizardScreen } from '../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StepConfig {
  id: WizardScreen;
  phase: number;
  label: string;
  shortLabel: string;
  icon: typeof Building2;
}

const ALL_STEPS: StepConfig[] = [
  { id: '1.1', phase: 1, label: 'Organization Type', shortLabel: 'Type', icon: Building2 },
  { id: '1.2', phase: 1, label: 'Define Regions', shortLabel: 'Regions', icon: MapPin },
  { id: '2.1', phase: 2, label: 'Difference Factors', shortLabel: 'Factors', icon: Settings },
  { id: '2.2', phase: 2, label: 'Region Subareas', shortLabel: 'Subareas', icon: ListChecks },
  { id: '3.1', phase: 3, label: 'Edit Subareas', shortLabel: 'Details', icon: ListChecks },
  { id: '3.2', phase: 3, label: 'Company Codes', shortLabel: 'Codes', icon: Building },
  { id: '4.1', phase: 4, label: 'Review & Export', shortLabel: 'Export', icon: FileDown },
];

// ─────────────────────────────────────────────────────────────────────────────
// Get Visible Steps Based on State
// ─────────────────────────────────────────────────────────────────────────────

function getVisibleSteps(
  orgType: 'single' | 'regional' | 'divisional' | null,
  differenceFactors: string[]
): StepConfig[] {
  // Always show 1.1
  if (orgType === null) {
    return ALL_STEPS.filter((s) => s.id === '1.1');
  }

  // Single org: 1.1 -> 3.2 -> 4.1
  if (orgType === 'single') {
    return ALL_STEPS.filter((s) => ['1.1', '3.2', '4.1'].includes(s.id));
  }

  // Regional/Divisional with no factors: 1.1 -> 1.2 -> 2.1 -> 3.2 -> 4.1
  if (differenceFactors.length === 0) {
    return ALL_STEPS.filter((s) => ['1.1', '1.2', '2.1', '3.2', '4.1'].includes(s.id));
  }

  // Full flow: all steps
  return ALL_STEPS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Indicator Component
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({
  step,
  index,
  currentIndex,
  onClick,
}: {
  step: StepConfig;
  index: number;
  currentIndex: number;
  onClick: () => void;
}) {
  const isCompleted = index < currentIndex;
  const isCurrent = index === currentIndex;
  const isClickable = index <= currentIndex;

  const Icon = step.icon;

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`
        flex items-center gap-2 transition-all
        ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
      `}
    >
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
          ${isCompleted
            ? 'bg-purple-600 text-white'
            : isCurrent
              ? 'bg-purple-600 text-white ring-4 ring-purple-100'
              : 'bg-gray-200 text-gray-500'
          }
        `}
      >
        {isCompleted ? (
          <Check className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <span
        className={`
          hidden md:inline text-sm font-medium
          ${isCurrent ? 'text-purple-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
        `}
      >
        {step.shortLabel}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Connector
// ─────────────────────────────────────────────────────────────────────────────

function StepConnector({ isCompleted }: { isCompleted: boolean }) {
  return (
    <div
      className={`
        hidden md:block flex-1 h-0.5 mx-2
        ${isCompleted ? 'bg-purple-600' : 'bg-gray-200'}
      `}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function WizardShell() {
  const { currentScreen, orgType, differenceFactors, setScreen } = usePersonnelAreaV2Store();

  const visibleSteps = getVisibleSteps(orgType, differenceFactors);
  const currentIndex = visibleSteps.findIndex((s) => s.id === currentScreen);

  // Get phase info for header
  const currentStep = visibleSteps[currentIndex];
  const phaseNames: Record<number, string> = {
    1: 'Organization Structure',
    2: 'Configuration Differences',
    3: 'Detail Configuration',
    4: 'Review & Export',
  };

  return (
    <div className="space-y-4">
      {/* Phase Header */}
      {currentStep && (
        <div className="text-center">
          <p className="text-sm text-gray-500 font-medium">
            Phase {currentStep.phase}: {phaseNames[currentStep.phase]}
          </p>
          <h2 className="text-xl font-semibold text-gray-900 mt-1">
            {currentStep.label}
          </h2>
        </div>
      )}

      {/* Step Progress Indicator */}
      <div className="flex items-center justify-center">
        {visibleSteps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none max-w-[180px]">
            <StepIndicator
              step={step}
              index={index}
              currentIndex={currentIndex}
              onClick={() => {
                if (index <= currentIndex) {
                  setScreen(step.id);
                }
              }}
            />
            {index < visibleSteps.length - 1 && (
              <StepConnector isCompleted={index < currentIndex} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
