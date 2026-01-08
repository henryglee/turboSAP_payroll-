/**
 * QuestionsTab - Questions overview tab for Configuration Management page
 *
 * OWNER: Wendy
 *
 * Features to implement:
 * - [x] Load and displayquestions for selected module
 * - [ ] Inline editing of question text (with style of NEW UI, not the old crowded one)
 * - [ ] Drag-and-drop reordering [but do "Add Module" ordering first]
 * - [ ] Add Question functionality (name, help text, order)
 * - [ ] Save changes to backend (via API)
 *
 * API Endpoints (already exist - just use them):
 * - GET  /api/config/modules                       - List modules for dropdown
 * - GET  /api/config/modules/{slug}/questions      - Get questions for module
 * - PUT  /api/config/modules/{slug}/questions      - Save questions
 *
 * Reference files for patterns:
 * - src/pages/admin/PaymentMethodConfigPage.tsx    - OLD question editing UI
 * 
 *  Primary Files:
 *  | File                                    | Purpose                                |
 * |-----------------------------------------|----------------------------------------|
 * | src/pages/admin/config/QuestionsTab.tsx | Your main file - all questions UI code |
 * | backend/app/routes/module_config.py     | Existing endpoints to reuse            |
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../api/utils';
import {
  HelpCircle,
  FileText,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// ============================================
// Types - Wendy, you can add more as needed
// ============================================

interface ModuleOption {
  slug: string;
  name: string;
}

interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

interface Question {
  id: string;
  text: string;
  type: string;
  options?: QuestionOption[];
  showIf?: {
    questionId: string;
    answerId: string;
  };
}

interface QuestionsConfig {
  version: string;
  questions: Question[];
}

// ============================================
// Component
// ============================================

export function QuestionsTab() {
  // State for module selection
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [loadingModules, setLoadingModules] = useState(true);

  // State for questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load modules on mount
  useEffect(() => {
    loadModules();
  }, []);

  // Load questions when module changes
  useEffect(() => {
    if (selectedModule) {
      loadQuestions(selectedModule);
    } else {
      setQuestions([]);
    }
  }, [selectedModule]);

  const loadModules = async () => {
    setLoadingModules(true);
    try {
      const data = await apiFetch<{ modules: ModuleOption[] }>('/api/config/modules');
      setModules(data.modules);
      // Auto-select first module if available
      if (data.modules.length > 0) {
        setSelectedModule(data.modules[0].slug);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load modules');
    } finally {
      setLoadingModules(false);
    }
  };

  const loadQuestions = async (moduleSlug: string) => {
    setLoadingQuestions(true);
    setError(null);
    try {
      const data = await apiFetch<QuestionsConfig>(
        `/api/config/modules/${moduleSlug}/questions`
      );
      setQuestions(data.questions);
    } catch (err: any) {
      setError(err.message || 'Failed to load questions');
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // TODO: Wendy - Implement save functionality
  // const handleSave = async () => {
  //   if (!selectedModule) return;
  //   // Use PUT /api/config/modules/{selectedModule}/questions
  //   // See PaymentMethodConfigPage.tsx for the pattern
  //   console.log('Save questions for:', selectedModule);
  // };

  // ============================================
  // Render - Wendy, build your UI below!
  // ============================================

  // Show loading state while fetching modules
  if (loadingModules) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <span className="ml-3 text-gray-600">Loading modules...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header with Module Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
        </div>

        {/* Module Dropdown */}
        <div className="relative">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 cursor-pointer"
          >
            <option value="">Select a module...</option>
            {modules.map((module) => (
              <option key={module.slug} value={module.slug}>
                {module.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content Area */}
      <div className="p-6">
        {/* No module selected */}
        {!selectedModule && (
          <div className="text-center py-8">
            <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Select a module to view its questions</p>
          </div>
        )}

        {/* Loading questions */}
        {selectedModule && loadingQuestions && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span className="ml-3 text-gray-600">Loading questions...</span>
          </div>
        )}

        {/* Questions list */}
        {selectedModule && !loadingQuestions && questions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              {questions.length} question{questions.length !== 1 ? 's' : ''} in this module
            </p>

            {/* TODO: Wendy - Replace this with your question editing UI */}
            {/* Reference: PaymentMethodConfigPage.tsx for the expandable card pattern */}
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-gray-400 mt-1">
                    #{index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{question.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Type: {question.type} | ID: {question.id}
                    </p>
                    {question.options && (
                      <p className="text-xs text-gray-500">
                        {question.options.length} options
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No questions */}
        {selectedModule && !loadingQuestions && questions.length === 0 && !error && (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No questions found for this module</p>
          </div>
        )}
      </div>
    </div>
  );
}
