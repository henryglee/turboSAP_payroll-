import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../api/utils';
import { useAuthStore } from '../store/auth';

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
  const [isMobile, setIsMobile] = useState(false);

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <main className="main-container">
        <div className="right-panel">
          <div className="section">
            <div className="admin-access-denied">
              <h2>Access Denied</h2>
              <p>This page is only available to administrators.</p>
            </div>
          </div>
        </div>
      </main>
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

  // Check screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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
    <main className="main-container">
      <div className="left-panel">
        <div className="section">
          <div style={{ marginBottom: '2rem' }}>
            <h2 className="section-title">Questions Configuration</h2>
            <p style={{ marginTop: '0.5rem', color: '#718096', fontSize: '0.9375rem', lineHeight: '1.6' }}>
              Upload, edit, and manage the questions JSON used by the chat flow.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">
              Import questions JSON
            </label>
            <input 
              type="file" 
              accept="application/json" 
              onChange={handleFileChange}
              className="form-input"
              style={{ padding: '0.625rem' }}
            />
          </div>

          <div style={{ 
            marginBottom: '1.5rem', 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem'
          }}>
            <button className="button" onClick={handleAddQuestion}>
              Add Question
            </button>
            <button 
              className="button" 
              onClick={handleSave} 
              disabled={saving || !config}
            >
              {saving ? 'Saving...' : 'Save Current'}
            </button>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <button className="button button-secondary" onClick={handleRestore} style={{ width: '100%' }}>
              Restore Original
            </button>
          </div>

          {loading && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#718096' }}>
              Loading questions…
            </div>
          )}
          {error && (
            <div className="admin-message error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          {message && (
            <div className="admin-message success" style={{ marginBottom: '1rem' }}>
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="right-panel">
        <div className="section" style={{ marginBottom: 0 }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>Questions List</h2>
            {config && (
              <p style={{ marginTop: '0.5rem', color: '#718096', fontSize: '0.9375rem' }}>
                {config.questions.length} question{config.questions.length !== 1 ? 's' : ''} configured
              </p>
            )}
          </div>
          {!config && !loading && (
            <div style={{ 
              padding: '3rem 2rem', 
              textAlign: 'center', 
              color: '#718096',
              background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
              borderRadius: '12px',
              border: '2px dashed #cbd5e0'
            }}>
              <p style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 500 }}>
                No questions loaded
              </p>
              <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
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
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 8px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(-50%)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                  }}
                >
                  ↑ Scroll Up
                </button>
              )}

              {/* Scroll Down Button */}
              {showScrollDown && (
                <button
                  onClick={scrollDown}
                  style={{
                    position: 'absolute',
                    bottom: '0.5rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 8px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(-50%) translateY(2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(-50%)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                  }}
                >
                  ↓ Scroll Down
                </button>
              )}

              <div
                ref={scrollContainerRef}
                style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  border: '2px solid #e2e8f0', 
                  borderRadius: '12px',
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)',
                  minHeight: 0,
                  boxSizing: 'border-box',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.02)',
                  maxHeight: '100%',
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                  gap: '1.5rem',
                  alignContent: 'start',
                }}
              >
              {config.questions.map((q, index) => (
                  <div
                    key={q.id}
                    style={{
                      marginBottom: '1.5rem',
                      padding: '1.5rem',
                      background: 'white',
                      borderRadius: '12px',
                      border: '2px solid #e2e8f0',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.borderColor = '#cbd5e0';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    <div className="form-group">
                      <label className="form-label">
                        Question ID:
                      </label>
                      <input
                        className="form-input"
                        value={q.id}
                        onChange={e => handleQuestionChange(index, 'id', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Question Text:
                      </label>
                      <input
                        className="form-input"
                        value={q.text}
                        onChange={e => handleQuestionChange(index, 'text', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Type:
                      </label>
                      <input
                        className="form-input"
                        value={q.type ?? ''}
                        onChange={e => handleQuestionChange(index, 'type', e.target.value)}
                      />
                    </div>


                    {(q.type === 'multiple_choice' || q.type === 'multiple_select') && (
                      <div style={{ 
                        marginTop: '1.5rem', 
                        padding: '1.5rem', 
                        background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)', 
                        borderRadius: '10px',
                        border: '2px solid #e2e8f0'
                      }}>
                        <strong style={{ 
                          display: 'block', 
                          marginBottom: '1rem', 
                          color: '#2d3748',
                          fontSize: '0.9375rem',
                          fontWeight: 700
                        }}>
                          Options
                        </strong>
                        {Array.isArray(q.options) && q.options.length > 0 ? (
                          q.options.map((opt: any, optIndex: number) => (
                            <div key={opt.id ?? optIndex} style={{ 
                              marginBottom: '1rem', 
                              padding: '1.25rem', 
                              background: 'white', 
                              borderRadius: '8px', 
                              border: '2px solid #e2e8f0',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                            }}>
                              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                <label className="form-label">Option ID:</label>
                                <input
                                  className="form-input"
                                  value={opt.id ?? ''}
                                  onChange={e =>
                                    handleOptionChange(index, optIndex, 'id', e.target.value)
                                  }
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                <label className="form-label">Label:</label>
                                <input
                                  className="form-input"
                                  value={opt.label ?? ''}
                                  onChange={e =>
                                    handleOptionChange(index, optIndex, 'label', e.target.value)
                                  }
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                <label className="form-label">Description:</label>
                                <input
                                  className="form-input"
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
                                className="button button-small button-secondary"
                                onClick={() => handleDeleteOption(index, optIndex)}
                              >
                                Delete Option
                              </button>
                            </div>
                          ))
                        ) : (
                          <p style={{ fontSize: '0.875rem', color: '#718096', fontStyle: 'italic' }}>
                            No options yet.
                          </p>
                        )}

                        <button 
                          type="button" 
                          className="button button-small"
                          onClick={() => handleAddOption(index)}
                        >
                          Add Option
                        </button>
                      </div>
                    )}
                    {q.id === 'q1_frequencies' && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="button button-small"
                          onClick={() => handleAddQuarterlyWithFollowups(index)}
                        >
                          Add Quarterly Option + Follow-up Questions
                        </button>
                      </div>
                    )}
                    <div style={{ marginTop: '0.75rem' }}>
                      <button 
                        type="button" 
                        className="button button-small button-secondary"
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
    </main>
  );
}
