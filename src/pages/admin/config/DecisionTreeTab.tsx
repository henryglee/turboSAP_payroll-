/**
 * DecisionTreeTab - Decision tree editor for Configuration Management page
 *
 * OWNER: TBD (Future development)
 *
 * Features to implement:
 * - [ ] Visual graph editor for question routing
 * - [ ] Show question nodes with connections
 * - [ ] Edit showIf conditions visually
 * - [ ] Preview question flow
 *
 * Recommended libraries:
 * - @xyflow/react (formerly reactflow) - Best for node-based editors
 * - elkjs - For automatic layout
 *
 * This will need significant backend changes to support:
 * - Storing routing rules separately from questions
 * - Supporting complex conditional logic (AND/OR)
 */

import { GitBranch, FileText } from 'lucide-react';

export function DecisionTreeTab() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
          <GitBranch className="h-8 w-8 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Decision Tree Editor</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          Visual editor for configuring question routing and conditional logic.
          Define which questions appear based on previous answers.
        </p>
        <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
          <FileText className="h-4 w-4 mr-2" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
