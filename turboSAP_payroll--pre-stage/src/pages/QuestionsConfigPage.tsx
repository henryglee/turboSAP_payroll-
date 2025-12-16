import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../api/utils';
import { useAuthStore } from '../store/auth';
import { AdminLayout } from '../components/layout/AdminLayout';

type Question = {
  id: string;
  text: string;
  type?: string;
  choices?: string[];
  [key: string]: any;
};

type QuestionsConfig = {
  questions: Question[];
};

/**
 * Questions configuration page for admins.
 * 
 * Note: UI focus is on client users, not admin. Admins can also:
 * - Edit JSON files directly: backend/app/config/questions_current.json
 * - Use API endpoints: PUT /api/config/questions/current
 * This UI is functional but admin can accept direct file editing.
 */
export function QuestionsConfigPage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<QuestionsConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <AdminLayout title="Questions Configuration" description="Access denied">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">This page is only available to administrators.</p>
        </div>
      </AdminLayout>
    );
  }

  const loadCurrent = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<QuestionsConfig>('/api/config/questions/current');
      setConfig(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrent();
  }, []);

  // Check scroll position and show/hide scroll buttons
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollUp(scrollTop > 50);
    setShowScrollDown(scrollTop < scrollHeight - clientHeight - 50);
  };

  // Scroll functions
  const scrollUp = () => {
    scrollContainerRef.current?.scrollBy({ top: -300, behavior: 'smooth' });
  };

  const scrollDown = () => {
    scrollContainerRef.current?.scrollBy({ top: 300, behavior: 'smooth' });
  };

  // Check scroll position on mount and when config changes
  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      return () => container.removeEventListener('scroll', checkScrollPosition);
    }
  }, [config]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const json = JSON.parse(text);
        setError(null);
        setMessage(null);

        await apiFetch('/api/config/questions/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        });

        setMessage('Uploaded new questions configuration.');
        await loadCurrent();
      } catch (err: any) {
        setError(err.message ?? 'Invalid JSON or upload failed');
      }
    };
    reader.readAsText(file);
  };

  const handleAddQuestion = () => {
    if (!config) return;
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      text: 'New question',
      type: 'text',
    };
    setConfig({
      ...config,
      questions: [...config.questions, newQuestion],
    });
  };

  const handleDeleteQuestion = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      questions: config.questions.filter(q => q.id !== id),
    });
  };

  const handleQuestionChange = (
    index: number,
    field: keyof Question,
    value: any,
  ) => {
    if (!config) return;
    const updated = [...config.questions];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, questions: updated });
  };

  const handleOptionChange = (
  questionIndex: number,
  optionIndex: number,
  field: 'id' | 'label' | 'description',
  value: string,
  ) => {
    if (!config) return;
    const questions = [...config.questions];
    const q = { ...questions[questionIndex] };
    const options = Array.isArray(q.options) ? [...q.options] : [];
    const opt = { ...(options[optionIndex] ?? {}) };

    opt[field] = value;
    options[optionIndex] = opt;
    q.options = options;
    questions[questionIndex] = q;
    setConfig({ ...config, questions });
  };

  const handleAddOption = (questionIndex: number) => {
    if (!config) return;
    const questions = [...config.questions];
    const q = { ...questions[questionIndex] };
    const options = Array.isArray(q.options) ? [...q.options] : [];
    const id = `opt_${Date.now()}`;
    options.push({ id, label: '', description: '' });
    q.options = options;
    questions[questionIndex] = q;
    setConfig({ ...config, questions });
  };

  const handleDeleteOption = (questionIndex: number, optionIndex: number) => {
    if (!config) return;
    const questions = [...config.questions];
    const q = { ...questions[questionIndex] };
    const options = Array.isArray(q.options) ? [...q.options] : [];
    options.splice(optionIndex, 1);
    q.options = options;
    questions[questionIndex] = q;
    setConfig({ ...config, questions });
  };

  const handleAddQuarterlyWithFollowups = (questionIndex: number) => {
    if (!config) return;
    const questions = [...config.questions];

    // 1. Update q1_frequencies with quarterly option
    const freqQuestion = { ...questions[questionIndex] };
    const options = Array.isArray(freqQuestion.options)
      ? [...freqQuestion.options]
      : [];
    const quarterlyId = 'quarterly';

    // Avoid duplicate quarterly
    if (!options.some(o => o.id === quarterlyId)) {
      options.push({
        id: quarterlyId,
        label: 'Quarterly',
        description: 'Employees paid quarterly',
      });
    }
    freqQuestion.options = options;
    questions[questionIndex] = freqQuestion;

    // 2. Create two new follow-up questions
    const timestamp = Date.now();
    const qPatternId = `q1_quarterly_pattern_${timestamp}`;
    const qPaydayId = `q1_quarterly_payday_${timestamp}`;

    const quarterlyPatternQuestion = {
      id: qPatternId,
      text: 'For QUARTERLY payroll, what is the pay period?',
      type: 'multiple_choice',
      showIf: {
        questionId: 'q1_frequencies',
        answerId: quarterlyId,
      },
      options: [],
    };

    const quarterlyPaydayQuestion = {
      id: qPaydayId,
      text: 'For QUARTERLY payroll, what day do employees get paid?',
      type: 'multiple_choice',
      showIf: {
        questionId: 'q1_frequencies',
        answerId: quarterlyId,
      },
      options: [],
    };

    questions.push(quarterlyPatternQuestion, quarterlyPaydayQuestion);
    setConfig({ ...config, questions });
  };

  const handleSave = async () => {
    if (!config) return;
    // simple validation
    for (const q of config.questions) {
      if (q.type === 'multiple_choice') {
        const opts = q.options;
        if (!Array.isArray(opts) || opts.length === 0) {
          setError(`Multiple choice question "${q.id}" must have at least one option.`);
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/config/questions/current', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setMessage('Saved current questions configuration.');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/config/questions/restore', {
        method: 'POST',
      });
      setMessage('Restored from original questions.');
      await loadCurrent();
    } catch (e: any) {
      setError(e.message ?? 'Failed to restore original');
    }
  };

  return (
    <AdminLayout
      title="Questions Configuration"
      description="Upload, edit, and manage the questions JSON used by the chat flow"
    >
      <div className="space-y-6">
        {/* Actions Panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Import questions JSON
              </label>
              <input 
                type="file" 
                accept="application/json" 
                onChange={handleFileChange}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleAddQuestion}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                Add Question
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving || !config}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Current'}
              </button>
            </div>
            
            <button 
              onClick={handleRestore} 
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Restore Original
            </button>
          </div>

          {loading && (
            <div className="text-center py-4 text-gray-500">
              Loading questions…
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}
        </div>

        {/* Questions List Panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Questions List</h2>
            {config && (
              <p className="text-sm text-gray-500">
                {config.questions.length} question{config.questions.length !== 1 ? 's' : ''} configured
              </p>
            )}
          </div>
          {!config && !loading && (
            <div className="p-12 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
              <p className="text-base font-medium text-gray-600 mb-2">
                No questions loaded
              </p>
              <p className="text-sm text-gray-500">
                Please import a questions JSON file or wait for questions to load.
              </p>
            </div>
          )}
          {config && (
            <div style={{ 
              position: 'relative',
              flex: 1,
              minHeight: 0,
              maxHeight: '70vh', // Limit max height to 70% of viewport height
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }}>
              {/* Scroll Up Button */}
              {showScrollUp && (
                <button
                  onClick={scrollUp}
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                >
                  ↑ Scroll Up
                </button>
              )}

              {/* Scroll Down Button */}
              {showScrollDown && (
                <button
                  onClick={scrollDown}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:translate-y-0.5"
                >
                  ↓ Scroll Down
                </button>
              )}

              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden border-2 border-gray-200 rounded-xl p-6 bg-gray-50 min-h-0 max-h-full flex flex-col gap-6"
              >
              {config.questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="mb-6 p-6 bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200"
                  >
                    <div className="space-y-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question ID:
                        </label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                          value={q.id}
                          onChange={e => handleQuestionChange(index, 'id', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question Text:
                        </label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                          value={q.text}
                          onChange={e => handleQuestionChange(index, 'text', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Type:
                        </label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                          value={q.type ?? ''}
                          onChange={e => handleQuestionChange(index, 'type', e.target.value)}
                        />
                      </div>
                    </div>


                    {(q.type === 'multiple_choice' || q.type === 'multiple_select') && (
                      <div className="mt-6 p-6 bg-gray-50 rounded-lg border-2 border-gray-200">
                        <strong className="block mb-4 text-gray-800 text-sm font-bold">
                          Options
                        </strong>
                        {Array.isArray(q.options) && q.options.length > 0 ? (
                          q.options.map((opt: any, optIndex: number) => (
                            <div key={opt.id ?? optIndex} className="mb-4 p-5 bg-white rounded-lg border-2 border-gray-200 shadow-sm">
                              <div className="space-y-3 mb-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Option ID:</label>
                                  <input
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    value={opt.id ?? ''}
                                    onChange={e =>
                                      handleOptionChange(index, optIndex, 'id', e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Label:</label>
                                  <input
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    value={opt.label ?? ''}
                                    onChange={e =>
                                      handleOptionChange(index, optIndex, 'label', e.target.value)
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Description:</label>
                                  <input
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                                    value={opt.description ?? ''}
                                    onChange={e =>
                                      handleOptionChange(
                                        index,
                                        optIndex,
                                        'description',
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                                onClick={() => handleDeleteOption(index, optIndex)}
                              >
                                Delete Option
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No options yet.
                          </p>
                        )}

                        <button 
                          type="button" 
                          className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                          onClick={() => handleAddOption(index)}
                        >
                          Add Option
                        </button>
                      </div>
                    )}
                    {q.id === 'q1_frequencies' && (
                      <div className="mt-3">
                        <button
                          type="button"
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                          onClick={() => handleAddQuarterlyWithFollowups(index)}
                        >
                          Add Quarterly Option + Follow-up Questions
                        </button>
                      </div>
                    )}
                    <div className="mt-3">
                      <button 
                        type="button" 
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        Delete Question
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
