/**
 * QuestionsTab - Questions overview tab for Configuration Management page
 *
 * OWNER: Wendy
 *
 * Features implemented:
 * - [x] Load and display questions for selected module
 * - [x] Inline editing of question text
 * - [x] Edit question options (label and description)
 * - [x] Add Question functionality
 * - [x] Delete question with confirmation
 * - [x] Save changes to backend (via API)
 * - [ ] Drag-and-drop reordering (future)
 *
 * API Endpoints:
 * - GET  /api/config/modules                       - List modules for dropdown
 * - GET  /api/config/modules/{slug}/questions      - Get questions for module
 * - PUT  /api/config/modules/{slug}/questions      - Save questions
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../api/utils';
import {
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  X,
  CheckCircle2,
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
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // State for editing
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [deletingQuestion, setDeletingQuestion] = useState<string | null>(null);

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
      setOriginalQuestions([]);
      setHasChanges(false);
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
    setSuccess(null);
    try {
      const data = await apiFetch<QuestionsConfig>(
        `/api/config/modules/${moduleSlug}/questions`
      );
      setQuestions(data.questions);
      setOriginalQuestions(JSON.parse(JSON.stringify(data.questions)));
      setHasChanges(false);
      setExpandedQuestions(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to load questions');
      setQuestions([]);
      setOriginalQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Toggle question expansion
  const toggleQuestion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  // Update question text
  const updateQuestionText = (questionId: string, newText: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, text: newText } : q))
    );
    setHasChanges(true);
    clearMessages();
  };

  // Update question option
  const updateOption = (
    questionId: string,
    optionId: string,
    field: 'label' | 'description',
    value: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId && q.options) {
          return {
            ...q,
            options: q.options.map((opt) =>
              opt.id === optionId ? { ...opt, [field]: value } : opt
            ),
          };
        }
        return q;
      })
    );
    setHasChanges(true);
    clearMessages();
  };

  // Add new question
  const addQuestion = () => {
    const newId = `q_${Date.now()}`;
    const newQuestion: Question = {
      id: newId,
      text: 'New Question',
      type: 'text',
    };
    setQuestions((prev) => [...prev, newQuestion]);
    setHasChanges(true);
    setExpandedQuestions((prev) => new Set([...prev, newId]));
    clearMessages();
  };

  // Delete question
  const deleteQuestion = (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });
    setHasChanges(true);
    setDeletingQuestion(null);
    clearMessages();
  };

  // Add option to question
  const addOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          const newOptionId = `opt_${Date.now()}`;
          const newOption: QuestionOption = {
            id: newOptionId,
            label: 'New Option',
          };
          return {
            ...q,
            options: [...(q.options || []), newOption],
          };
        }
        return q;
      })
    );
    setHasChanges(true);
    clearMessages();
  };

  // Delete option
  const deleteOption = (questionId: string, optionId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId && q.options) {
          return {
            ...q,
            options: q.options.filter((opt) => opt.id !== optionId),
          };
        }
        return q;
      })
    );
    setHasChanges(true);
    clearMessages();
  };

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedModule || !hasChanges) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        version: '1.0',
        questions: questions,
      };

      await apiFetch(`/api/config/modules/${selectedModule}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setSuccess('Questions saved successfully!');
      setOriginalQuestions(JSON.parse(JSON.stringify(questions)));
      setHasChanges(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save questions');
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    setQuestions(JSON.parse(JSON.stringify(originalQuestions)));
    setHasChanges(false);
    setExpandedQuestions(new Set());
    clearMessages();
  };

  // ============================================
  // Render
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
          {selectedModule && !loadingQuestions && (
            <span className="text-sm text-gray-500">
              ({questions.length} question{questions.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {/* Module Dropdown */}
        <div className="relative">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 cursor-pointer"
            disabled={saving}
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

      {/* Action Bar - Show when module is selected and questions loaded */}
      {selectedModule && !loadingQuestions && (
        <div className="flex items-center justify-between gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
          <button
            onClick={addQuestion}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </button>

          {hasChanges && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4" />
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="m-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-green-600 hover:text-green-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
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
          <div className="space-y-3">
            {questions.map((question, index) => {
              const isExpanded = expandedQuestions.has(question.id);
              const hasOptions =
                question.options && question.options.length > 0;

              return (
                <div
                  key={question.id}
                  className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow"
                >
                  {/* Question Header */}
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleQuestion(question.id)}
                  >
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono text-gray-400 w-6">
                        #{index + 1}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {question.text}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          Type: {question.type}
                        </span>
                        {hasOptions && (
                          <span className="text-xs text-gray-500">
                            • {question.options?.length} option
                            {question.options?.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          ID: {question.id}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingQuestion(question.id);
                      }}
                      disabled={saving}
                      className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-100 bg-gray-50">
                      {/* Question Text Editor */}
                      <div className="pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question Text
                        </label>
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) =>
                            updateQuestionText(question.id, e.target.value)
                          }
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="Enter question text"
                        />
                      </div>

                      {/* Question ID (read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question ID
                        </label>
                        <input
                          type="text"
                          value={question.id}
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Question ID cannot be changed
                        </p>
                      </div>

                      {/* Question Type (read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question Type
                        </label>
                        <input
                          type="text"
                          value={question.type}
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Question type cannot be changed
                        </p>
                      </div>

                      {/* Options Editor */}
                      {hasOptions && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Options
                            </label>
                            <button
                              onClick={() => addOption(question.id)}
                              disabled={saving}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-3 w-3" />
                              Add Option
                            </button>
                          </div>
                          <div className="space-y-2">
                            {question.options?.map((option, optIndex) => (
                              <div
                                key={option.id}
                                className="bg-white border border-gray-200 rounded-lg p-3"
                              >
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-xs font-mono text-gray-400 mt-2">
                                    {optIndex + 1}.
                                  </span>
                                  <div className="flex-1 space-y-2">
                                    <input
                                      type="text"
                                      value={option.label}
                                      onChange={(e) =>
                                        updateOption(
                                          question.id,
                                          option.id,
                                          'label',
                                          e.target.value
                                        )
                                      }
                                      disabled={saving}
                                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                      placeholder="Option label"
                                    />
                                    <input
                                      type="text"
                                      value={option.description || ''}
                                      onChange={(e) =>
                                        updateOption(
                                          question.id,
                                          option.id,
                                          'description',
                                          e.target.value
                                        )
                                      }
                                      disabled={saving}
                                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                      placeholder="Option description (optional)"
                                    />
                                    <p className="text-xs text-gray-400">
                                      ID: {option.id}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() =>
                                      deleteOption(question.id, option.id)
                                    }
                                    disabled={
                                      saving ||
                                      (question.options?.length || 0) <= 1
                                    }
                                    className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={
                                      (question.options?.length || 0) <= 1
                                        ? 'Cannot delete the last option'
                                        : 'Delete option'
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No questions */}
        {selectedModule && !loadingQuestions && questions.length === 0 && !error && (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No questions found for this module</p>
            <button
              onClick={addQuestion}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add First Question
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Delete Question
                </h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this question? This action
                  cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingQuestion(null)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteQuestion(deletingQuestion)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
              >
                Delete Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
