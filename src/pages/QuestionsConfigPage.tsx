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
      <AdminLayout
        title="Access Denied"
        description="This page is only available to administrators"
      >
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500">This page is only available to administrators.</p>
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
      title="Module Configuration"
      description="Upload, edit, and manage the configuration modules used by the guided flow"
    >
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Import module JSON
              </label>
              <input 
                type="file" 
                accept="application/json" 
                onChange={handleFileChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleAddQuestion}
                className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
              >
                Add Question
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving || !config}
                className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Current'}
              </button>
            </div>
            
            <button 
              onClick={handleRestore}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
            >
              Restore Original
            </button>

            {loading && (
              <div className="text-center py-4 text-gray-500 text-sm">
                Loading questions…
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Modules</h2>
            {config && (
              <p className="text-sm text-gray-500 mt-1">
                {config.questions.length} module{config.questions.length !== 1 ? 's' : ''} configured
              </p>
            )}
          </div>
          {!config && !loading && (
            <div className="py-12 text-center bg-gray-50 border border-dashed border-gray-300 rounded-lg">
              <p className="text-base font-medium text-gray-900 mb-1">
                No questions loaded
              </p>
              <p className="text-sm text-gray-500">
                Please import a questions JSON file or wait for questions to load.
              </p>
            </div>
          )}
          {config && (
            <div className="relative">
              {showScrollUp && (
                <button
                  onClick={scrollUp}
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-full shadow-lg hover:bg-amber-600 transition-all"
                >
                  ↑ Scroll Up
                </button>
              )}

              {showScrollDown && (
                <button
                  onClick={scrollDown}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-full shadow-lg hover:bg-amber-600 transition-all"
                >
                  ↓ Scroll Down
                </button>
              )}

              <div
                ref={scrollContainerRef}
                className="max-h-[70vh] overflow-y-auto overflow-x-hidden border border-gray-200 rounded-lg p-6 bg-gray-50 space-y-4"
              >
              {config.questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                  >
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Question ID:
                        </label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          value={q.id}
                          onChange={e => handleQuestionChange(index, 'id', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Question Text:
                        </label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          value={q.text}
                          onChange={e => handleQuestionChange(index, 'text', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Type:
                        </label>
                        <input
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          value={q.type ?? ''}
                          onChange={e => handleQuestionChange(index, 'type', e.target.value)}
                        />
                      </div>


                    {(q.type === 'multiple_choice' || q.type === 'multiple_select') && (
                      <div className="mt-6 p-6 bg-gray-100 rounded-lg border border-gray-200">
                        <strong className="block mb-4 text-gray-900 text-sm font-bold">
                          Options
                        </strong>
                        {Array.isArray(q.options) && q.options.length > 0 ? (
                          q.options.map((opt: any, optIndex: number) => (
                            <div key={opt.id ?? optIndex} className="mb-4 p-5 bg-white rounded-lg border border-gray-200 shadow-sm space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Option ID:</label>
                                <input
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                  value={opt.id ?? ''}
                                  onChange={e =>
                                    handleOptionChange(index, optIndex, 'id', e.target.value)
                                  }
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Label:</label>
                                <input
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                  value={opt.label ?? ''}
                                  onChange={e =>
                                    handleOptionChange(index, optIndex, 'label', e.target.value)
                                  }
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Description:</label>
                                <input
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                              <button
                                type="button"
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
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
                          className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
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
                          className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                          onClick={() => handleAddQuarterlyWithFollowups(index)}
                        >
                          Add Quarterly Option + Follow-up Questions
                        </button>
                      </div>
                    )}
                    <div className="mt-3">
                      <button 
                        type="button" 
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        Delete Question
                      </button>
                    </div>
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
