/**
 * PayrollAreaPage - New UI for Payroll Area Configuration
 * Uses DashboardLayout with stacked layout:
 * - Chat interface on top (in a card)
 * - Results table below (collapsible, appears when areas generated)
 *
 * Keeps existing ChatInterface functionality but with new styling
 */

import { useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ChatCard } from '../components/chat/ChatCard';
import { PayrollResultsCard } from '../components/PayrollResultsCard';
import { useConfigStore } from '../store';
import type { GeneratedPayrollArea } from '../types/chat';
import type { PayrollArea, PayFrequencyType } from '../types';

export function PayrollAreaPage() {
  const { profile, payrollAreas } = useConfigStore();
  const [isComplete, setIsComplete] = useState(false);

  /**
   * Convert chat-generated areas to store format and update the store
   */
  const handleChatComplete = (generatedAreas: GeneratedPayrollArea[]) => {
    // Convert GeneratedPayrollArea to PayrollArea format
    const areas: PayrollArea[] = generatedAreas.map(area => ({
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
    useConfigStore.setState({
      payrollAreas: areas,
      validation: {
        isValid: true,
        employeesCovered: areas.reduce((sum, a) => sum + a.employeeCount, 0),
        totalEmployees: profile.totalEmployees,
        warnings: [],
        errors: [],
      },
    });

    setIsComplete(true);
  };

  return (
    <DashboardLayout
      title="Payroll Area Configuration"
      description="Answer questions to generate your optimal payroll area setup"
      currentPath="/payroll-area"
      statusIndicators={{
        payrollAreas: isComplete ? 'complete' : payrollAreas.length > 0 ? 'in-progress' : 'not-started',
      }}
    >
      <div className="space-y-6">
        {/* Chat Interface Card */}
        <ChatCard onComplete={handleChatComplete} />

        {/* Results Card - Shows when areas are generated */}
        {(payrollAreas.length > 0 || isComplete) && (
          <PayrollResultsCard />
        )}
      </div>
    </DashboardLayout>
  );
}
