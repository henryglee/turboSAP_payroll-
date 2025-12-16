import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../api/utils';
import { useAuthStore } from '../store/auth';
import { AdminLayout } from '../components/layout/AdminLayout';
import { AlertCircle, CheckCircle2, Plus, Save, RotateCcw, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

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
      <AdminLayout title="Module Configuration" description="Manage configuration modules">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">This page is only available to administrators.</p>
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
    <AdminLayout title="Module Configuration" description="Upload, edit, and manage the configuration modules used by the guided flow">
      <div className="max-w-6xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Actions</h2>
            <p className="text-sm text-muted-foreground">
              Manage your configuration modules
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Import module JSON
              </label>
              <input 
                type="file" 
                accept="application/json" 
                onChange={handleFileChange}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-foreground hover:file:bg-secondary/80"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleAddQuestion}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving || !config}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            
            <button 
              onClick={handleRestore}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg transition-colors text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Restore Original
            </button>

            {/* Modules List - Moved below Restore Original */}
            <div className="border-t border-border pt-6 mt-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground">Modules</h2>
                {config && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {config.questions.length} module{config.questions.length !== 1 ? 's' : ''} configured
                  </p>
                )}
              </div>
              
              {loading && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading questions…
                </div>
              )}
              
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
              
              {message && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{message}</span>
                </div>
              )}
              
              {!config && !loading && (
                <div className="p-12 text-center bg-secondary rounded-lg border-2 border-dashed border-border">
                  <p className="text-base font-medium text-foreground mb-2">
                    No questions loaded
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please import a questions JSON file or wait for questions to load.
                  </p>
                </div>
              )}
              
              {config && (
                <div className="relative max-h-[70vh]">
                  {/* Scroll Up Button */}
                  {showScrollUp && (
                    <button
                      onClick={scrollUp}
                      className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-full text-sm shadow-lg transition-all"
                    >
                      <ChevronUp className="h-4 w-4 inline mr-1" />
                      Scroll Up
                    </button>
                  )}

                  {/* Scroll Down Button */}
                  {showScrollDown && (
                    <button
                      onClick={scrollDown}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-full text-sm shadow-lg transition-all"
                    >
                      <ChevronDown className="h-4 w-4 inline mr-1" />
                      Scroll Down
                    </button>
                  )}

                  <div
                    ref={scrollContainerRef}
                    className="overflow-y-auto overflow-x-hidden border border-border rounded-lg p-6 bg-background max-h-[70vh]"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: '1.5rem',
                      alignContent: 'start',
                    }}
                  >
                    {config.questions.map((q, index) => (
                      <div
                        key={q.id}
                        className="p-6 bg-card border border-border rounded-lg hover:shadow-md transition-all"
                      >
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Question ID:
                            </label>
                            <input
                              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                              value={q.id}
                              onChange={e => handleQuestionChange(index, 'id', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Question Text:
                            </label>
                            <input
                              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                              value={q.text}
                              onChange={e => handleQuestionChange(index, 'text', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Type:
                            </label>
                            <input
                              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                              value={q.type ?? ''}
                              onChange={e => handleQuestionChange(index, 'type', e.target.value)}
                            />
                          </div>


                          {(q.type === 'multiple_choice' || q.type === 'multiple_select') && (
                            <div className="mt-4 p-4 bg-secondary rounded-lg border border-border">
                              <strong className="block mb-4 text-sm font-semibold text-foreground">
                                Options
                              </strong>
                              {Array.isArray(q.options) && q.options.length > 0 ? (
                                <div className="space-y-3">
                                  {q.options.map((opt: any, optIndex: number) => (
                                    <div key={opt.id ?? optIndex} className="p-4 bg-card rounded-lg border border-border">
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-xs font-medium text-foreground mb-1">Option ID:</label>
                                          <input
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                            value={opt.id ?? ''}
                                            onChange={e =>
                                              handleOptionChange(index, optIndex, 'id', e.target.value)
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-foreground mb-1">Label:</label>
                                          <input
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                                            value={opt.label ?? ''}
                                            onChange={e =>
                                              handleOptionChange(index, optIndex, 'label', e.target.value)
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-foreground mb-1">Description:</label>
                                          <input
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
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
                                          className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg transition-colors text-sm"
                                          onClick={() => handleDeleteOption(index, optIndex)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          Delete Option
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No options yet.
                            </p>
                          )}

                          <button 
                            type="button" 
                            className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
                            onClick={() => handleAddOption(index)}
                          >
                            <Plus className="h-3 w-3" />
                            Add Option
                          </button>
                        </div>
                      )}
                      {q.id === 'q1_frequencies' && (
                        <div className="mt-3">
                          <button
                            type="button"
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors text-sm"
                            onClick={() => handleAddQuarterlyWithFollowups(index)}
                          >
                            Add Quarterly Option + Follow-up Questions
                          </button>
                        </div>
                      )}
                          <div className="mt-3">
                            <button 
                              type="button" 
                              className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg transition-colors text-sm"
                              onClick={() => handleDeleteQuestion(q.id)}
                            >
                              <Trash2 className="h-3 w-3" />
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
        </div>
      </div>
    </AdminLayout>
  );
}
