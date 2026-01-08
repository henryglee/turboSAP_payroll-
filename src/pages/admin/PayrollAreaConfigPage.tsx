/**
 * PayrollAreaConfigPage - Admin page for editing payroll area questions
 *
 * Shows two sections:
 * 1. Static Questions (editable) - loaded from questions_current.json
 * 2. Dynamic Questions (read-only) - generated at runtime based on user answers
 *
 * Dynamic questions cannot be edited because they're generated programmatically
 * from calendar combinations (frequency × pattern × payday).
 */

import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiFetch } from '../../api/utils';
import {
  Save,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  List,
  HelpCircle,
  RotateCcw,
  Loader2,
  Lock,
  Zap,
  Info,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';

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
  placeholder?: string;
}

interface QuestionsConfig {
  version: string;
  questions: Question[];
  _meta?: {
    module: string;
    moduleName: string;
    moduleDescription: string;
    hasBackup: boolean;
    hasOriginal: boolean;
  };
}

interface ModuleMetadata {
  slug: string;
  name: string;
  description: string;
  icon: string;
  status: string;
}

// Dynamic question templates - these are generated at runtime in Python
const DYNAMIC_QUESTION_TEMPLATES = [
  {
    id: 'business_{calendar}',
    text: 'Does {Calendar Label} need to be separated by business unit?',
    type: 'choice',
    description: 'Asked for each calendar combination to determine if different business units need separate payroll areas.',
    options: [
      { id: 'yes', label: 'Yes', description: 'This calendar needs separate areas per business unit' },
      { id: 'no', label: 'No', description: 'All business units can share this calendar' },
    ],
  },
  {
    id: 'business_names_{calendar}',
    text: 'What business units use {Calendar Label}?',
    type: 'text',
    description: 'If business unit separation is needed, collects the names of business units.',
    placeholder: 'e.g., Construction, Services, Corporate (comma-separated)',
  },
  {
    id: 'geographic_{calendar}',
    text: 'Does {Calendar Label} need to be separated by geographic region?',
    type: 'choice',
    description: 'Asked to determine if geographic separation is needed (Hawaii, Puerto Rico, Alaska).',
    options: [
      { id: 'mainland_only', label: 'Mainland US only', description: 'All employees in contiguous US states' },
      { id: 'multiple', label: 'Multiple regions', description: 'Employees in Hawaii, Puerto Rico, Alaska, etc.' },
    ],
  },
  {
    id: 'regions_{calendar}',
    text: 'Which regions have employees on {Calendar Label}?',
    type: 'multiple_select',
    description: 'If geographic separation is needed, collects which regions have employees.',
    options: [
      { id: 'mainland', label: 'Mainland US', description: 'Contiguous 48 states' },
      { id: 'hawaii', label: 'Hawaii', description: 'Hawaii time zone' },
      { id: 'puerto_rico', label: 'Puerto Rico', description: 'Atlantic time zone' },
      { id: 'alaska', label: 'Alaska', description: 'Alaska time zone' },
    ],
  },
];

export function PayrollAreaConfigPage() {
  const [config, setConfig] = useState<QuestionsConfig | null>(null);
  const [moduleMetadata, setModuleMetadata] = useState<ModuleMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasMetadataChanges, setHasMetadataChanges] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [showDynamic, setShowDynamic] = useState(true);
  const [showModuleSettings, setShowModuleSettings] = useState(false);

  // Load questions and metadata on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [questionsData, metadataData] = await Promise.all([
        apiFetch<QuestionsConfig>('/api/config/modules/payroll-area/questions'),
        apiFetch<ModuleMetadata>('/api/config/modules/payroll-area'),
      ]);
      setConfig(questionsData);
      setModuleMetadata(metadataData);
      setHasChanges(false);
      setHasMetadataChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!moduleMetadata) return;

    setSavingMetadata(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch('/api/config/modules/payroll-area', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: moduleMetadata.name,
          description: moduleMetadata.description,
        }),
      });
      setSuccess('Module settings saved');
      setHasMetadataChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save module settings');
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    // Validate before saving
    const validationError = validateConfig(config);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Remove _meta before sending (backend adds it)
      const payload = {
        version: config.version,
        questions: config.questions,
      };

      const result = await apiFetch<{ status: string; message: string; questionCount: number }>(
        '/api/config/modules/payroll-area/questions',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      setSuccess(result.message || 'Configuration saved successfully');
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (source: 'backup' | 'original') => {
    const message = source === 'original'
      ? 'Restore to original defaults? This will undo all customizations.'
      : 'Restore from backup? This will undo changes since the last save.';

    if (!confirm(message)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch(`/api/config/modules/payroll-area/questions/restore?source=${source}`, {
        method: 'POST',
      });
      await loadData();
      setSuccess(`Configuration restored from ${source}`);
    } catch (err: any) {
      setError(err.message || 'Failed to restore');
      setLoading(false);
    }
  };

  const validateConfig = (cfg: QuestionsConfig): string | null => {
    for (const q of cfg.questions) {
      if (!q.text.trim()) {
        return `Question "${q.id}" has empty text`;
      }
      if (q.options) {
        for (const opt of q.options) {
          if (!opt.label.trim()) {
            return `Question "${q.id}" has an option with empty label`;
          }
        }
      }
    }
    return null;
  };

  const updateQuestionText = (questionId: string, newText: string) => {
    if (!config) return;
    setConfig({
      ...config,
      questions: config.questions.map((q) =>
        q.id === questionId ? { ...q, text: newText } : q
      ),
    });
    setHasChanges(true);
  };

  const updateOptionLabel = (questionId: string, optionId: string, newLabel: string) => {
    if (!config) return;
    setConfig({
      ...config,
      questions: config.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options?.map((opt) =>
                opt.id === optionId ? { ...opt, label: newLabel } : opt
              ),
            }
          : q
      ),
    });
    setHasChanges(true);
  };

  const updateOptionDescription = (questionId: string, optionId: string, newDesc: string) => {
    if (!config) return;
    setConfig({
      ...config,
      questions: config.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options?.map((opt) =>
                opt.id === optionId ? { ...opt, description: newDesc } : opt
              ),
            }
          : q
      ),
    });
    setHasChanges(true);
  };

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (config) {
      const allIds = new Set([
        ...config.questions.map((q) => q.id),
        ...DYNAMIC_QUESTION_TEMPLATES.map((q) => q.id),
      ]);
      setExpandedQuestions(allIds);
    }
  };

  const collapseAll = () => {
    setExpandedQuestions(new Set());
  };

  const getQuestionLabel = (questionId: string): string => {
    const question = config?.questions.find((q) => q.id === questionId);
    return question?.text?.substring(0, 50) || questionId;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple_choice':
      case 'choice':
        return <List className="h-4 w-4" />;
      case 'multiple_select':
        return <List className="h-4 w-4" />;
      case 'free_text':
      case 'text':
        return <FileText className="h-4 w-4" />;
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice':
        return 'Multiple Choice';
      case 'choice':
        return 'Single Choice';
      case 'multiple_select':
        return 'Multi-Select';
      case 'free_text':
      case 'text':
        return 'Free Text';
      default:
        return type;
    }
  };

  return (
    <AdminLayout
      title={moduleMetadata?.name || "Payroll Area Configuration"}
      description="Edit module settings and questions"
    >
      {/* Back Link */}
      <div className="mb-4">
        <Link
          to="/admin/config"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Configuration
        </Link>
      </div>

      {/* Module Settings Section */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => setShowModuleSettings(!showModuleSettings)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-gray-400" />
            <div>
              <h3 className="font-medium text-gray-900">Module Settings</h3>
              <p className="text-sm text-gray-500">Edit module name and description</p>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform ${
              showModuleSettings ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showModuleSettings && moduleMetadata && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Module Name
                </label>
                <input
                  type="text"
                  value={moduleMetadata.name}
                  onChange={(e) => {
                    setModuleMetadata({ ...moduleMetadata, name: e.target.value });
                    setHasMetadataChanges(true);
                  }}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={moduleMetadata.description}
                  onChange={(e) => {
                    setModuleMetadata({ ...moduleMetadata, description: e.target.value });
                    setHasMetadataChanges(true);
                  }}
                  placeholder="Brief description of this module"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                />
              </div>
            </div>
            {hasMetadataChanges && (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    loadData();
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMetadata}
                  disabled={savingMetadata}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  {savingMetadata ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Settings
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Collapse All
          </button>
        </div>

        <div className="flex items-center gap-3">
          {config?._meta?.hasOriginal && (
            <button
              onClick={() => handleRestore('original')}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 font-medium rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </button>
          )}
          {config?._meta?.hasBackup && (
            <button
              onClick={() => handleRestore('backup')}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 font-medium rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Restore Backup
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-700">You have unsaved changes</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4 text-red-500 hover:text-red-700" />
          </button>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="h-4 w-4 text-green-500 hover:text-green-700" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <span className="ml-3 text-gray-600">Loading questions...</span>
        </div>
      )}

      {/* Static Questions List */}
      {!loading && config && (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              Static Questions
              <span className="text-sm font-normal text-gray-500">
                ({config.questions.length} questions)
              </span>
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              These questions are defined in configuration and can be edited.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {config.questions.map((question, index) => {
              const isExpanded = expandedQuestions.has(question.id);

              return (
                <div
                  key={question.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  {/* Question Header */}
                  <button
                    onClick={() => toggleQuestion(question.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {question.id}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {getTypeIcon(question.type)}
                          {getTypeLabel(question.type)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {question.text}
                      </p>
                      {question.showIf && (
                        <p className="text-xs text-gray-500 mt-1">
                          Shows when "{getQuestionLabel(question.showIf.questionId)}" includes "{question.showIf.answerId}"
                        </p>
                      )}
                    </div>

                    {question.options && (
                      <span className="text-xs text-gray-400">
                        {question.options.length} options
                      </span>
                    )}
                  </button>

                  {/* Question Details (Expanded) */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {/* Question Text */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question Text
                        </label>
                        <textarea
                          value={question.text}
                          onChange={(e) => updateQuestionText(question.id, e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
                        />
                      </div>

                      {/* Options (for choice questions) */}
                      {question.options && question.options.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Options
                          </label>
                          <div className="space-y-3">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={option.id}
                                className="bg-white border border-gray-200 rounded-lg p-3"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-mono text-gray-400">
                                    {optIndex + 1}.
                                  </span>
                                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                    id: {option.id}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                      Label
                                    </label>
                                    <input
                                      type="text"
                                      value={option.label}
                                      onChange={(e) =>
                                        updateOptionLabel(question.id, option.id, e.target.value)
                                      }
                                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">
                                      Description (optional)
                                    </label>
                                    <input
                                      type="text"
                                      value={option.description || ''}
                                      onChange={(e) =>
                                        updateOptionDescription(question.id, option.id, e.target.value)
                                      }
                                      placeholder="Optional description..."
                                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Read-only info */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-400">
                          ID and type cannot be changed to prevent breaking the configuration flow.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dynamic Questions Section */}
          <div className="mb-6">
            <button
              onClick={() => setShowDynamic(!showDynamic)}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-2 hover:text-amber-600 transition-colors"
            >
              {showDynamic ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
              <Zap className="h-5 w-5 text-purple-500" />
              Dynamic Questions
              <span className="text-sm font-normal text-gray-500">
                ({DYNAMIC_QUESTION_TEMPLATES.length} templates)
              </span>
              <Lock className="h-4 w-4 text-gray-400 ml-2" />
            </button>
            <p className="text-sm text-gray-600 mb-4 ml-7">
              These questions are generated at runtime based on the user's calendar selections.
              They cannot be edited here because they're created dynamically.
            </p>
          </div>

          {showDynamic && (
            <>
              {/* Explanation Card */}
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-purple-800">
                    <p className="font-medium mb-1">How Dynamic Questions Work</p>
                    <p className="text-purple-700">
                      When a user selects pay frequencies (Weekly, Bi-weekly, etc.) and their patterns/paydays,
                      the system generates calendar combinations like "Weekly Mon-Sun Friday".
                      For each calendar, these questions are asked to determine business unit and geographic separation.
                    </p>
                    <p className="text-purple-700 mt-2">
                      The <code className="bg-purple-100 px-1 rounded">{'{calendar}'}</code> placeholder is replaced
                      with the actual calendar key at runtime.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {DYNAMIC_QUESTION_TEMPLATES.map((template, _index) => {
                  const isExpanded = expandedQuestions.has(template.id);

                  return (
                    <div
                      key={template.id}
                      className="bg-white border border-purple-200 rounded-xl overflow-hidden opacity-75"
                    >
                      {/* Question Header */}
                      <button
                        onClick={() => toggleQuestion(template.id)}
                        className="w-full flex items-center gap-4 p-4 text-left hover:bg-purple-50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-purple-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-purple-400 flex-shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Lock className="h-3 w-3 text-purple-400" />
                            <span className="text-xs font-mono text-purple-400 bg-purple-100 px-2 py-0.5 rounded">
                              {template.id}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded">
                              {getTypeIcon(template.type)}
                              {getTypeLabel(template.type)}
                            </span>
                            <span className="text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded">
                              Dynamic
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {template.text}
                          </p>
                        </div>

                        {template.options && (
                          <span className="text-xs text-purple-400">
                            {template.options.length} options
                          </span>
                        )}
                      </button>

                      {/* Template Details (Expanded) */}
                      {isExpanded && (
                        <div className="border-t border-purple-200 p-4 bg-purple-50/50">
                          {/* Description */}
                          <div className="mb-4 p-3 bg-white rounded-lg border border-purple-100">
                            <p className="text-sm text-gray-600">
                              {template.description}
                            </p>
                          </div>

                          {/* Question Text (read-only) */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-500 mb-2">
                              Question Template (Read-only)
                            </label>
                            <div className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 text-sm">
                              {template.text}
                            </div>
                          </div>

                          {/* Options (read-only) */}
                          {template.options && template.options.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-500 mb-2">
                                Options (Read-only)
                              </label>
                              <div className="space-y-2">
                                {template.options.map((option, optIndex) => (
                                  <div
                                    key={option.id}
                                    className="bg-white border border-gray-200 rounded-lg p-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-mono text-gray-400">
                                        {optIndex + 1}.
                                      </span>
                                      <span className="text-sm font-medium text-gray-700">
                                        {option.label}
                                      </span>
                                      {option.description && (
                                        <span className="text-xs text-gray-500">
                                          — {option.description}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Placeholder for text type */}
                          {template.type === 'text' && template.placeholder && (
                            <div>
                              <label className="block text-sm font-medium text-gray-500 mb-2">
                                Placeholder (Read-only)
                              </label>
                              <div className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 text-sm italic">
                                {template.placeholder}
                              </div>
                            </div>
                          )}

                          {/* Info footer */}
                          <div className="mt-4 pt-4 border-t border-purple-200">
                            <p className="text-xs text-purple-600 flex items-center gap-2">
                              <Lock className="h-3 w-3" />
                              This question is generated dynamically and cannot be edited through this interface.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && config && config.questions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No static questions found</p>
        </div>
      )}
    </AdminLayout>
  );
}
