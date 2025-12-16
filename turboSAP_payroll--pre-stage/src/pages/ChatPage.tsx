/**
 * ChatPage - Chat-based configuration interface.
 *
 * Layout: Chat on left, PayrollAreasPanel on right
 * Uses the same PayrollAreasPanel as the ConfigPage for consistency.
 */

import { ChatInterface } from '../components/chat';
import { PayrollAreasPanel } from '../PayrollAreasPanel';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useConfigStore } from '../store';
import type { GeneratedPayrollArea } from '../types/chat';
import type { PayrollArea, PayFrequencyType } from '../types';

export function ChatPage() {
  const { profile } = useConfigStore();

  /**
   * Convert chat-generated areas to store format and update the store
   */
  const handleChatComplete = (generatedAreas: GeneratedPayrollArea[]) => {
    // Convert GeneratedPayrollArea to PayrollArea format
    const payrollAreas: PayrollArea[] = generatedAreas.map(area => ({
      code: area.code,
      description: area.description,
      frequency: area.frequency as PayFrequencyType,
      calendarId: area.calendarId,
      businessUnit: area.businessUnit,
      timeZone: undefined,
      union: undefined,
      employeeCount: area.employeeCount,
      generatedBy: 'system' as const,
      reasoning: area.reasoning,
      // Include backend-specific fields
      periodPattern: area.periodPattern,
      payDay: area.payDay,
      region: area.region,
    }));

    // Update the store with generated areas
    // We need to access the store directly since we're setting computed values
    useConfigStore.setState({
      payrollAreas,
      validation: {
        isValid: true,
        employeesCovered: payrollAreas.reduce((sum, a) => sum + a.employeeCount, 0),
        totalEmployees: profile.totalEmployees,
        warnings: [],
        errors: [],
      },
    });
  };

  return (
    <DashboardLayout
      title="Chat Configuration"
      description="Configure payroll areas through interactive chat"
      currentPath="/chat"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side: Chat Interface */}
        <div className="bg-card border border-border rounded-lg p-6">
          <ChatInterface onComplete={handleChatComplete} />
        </div>

        {/* Right side: Same PayrollAreasPanel as ConfigPage */}
        <div className="bg-card border border-border rounded-lg p-6">
          <PayrollAreasPanel />
        </div>
      </div>
    </DashboardLayout>
  );
}
