import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';

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
  const [config, setConfig] = useState<QuestionsConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCurrent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/questions/current`);
      if (!res.ok) {
        throw new Error(`Failed to load: ${res.status}`);
      }
      const data = await res.json();
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

        const res = await fetch(`${API_BASE_URL}/api/config/questions/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `Upload failed: ${res.status}`);
        }

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
      const res = await fetch(`${API_BASE_URL}/api/config/questions/current`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Save failed: ${res.status}`);
      }
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
      const res = await fetch(`${API_BASE_URL}/api/config/questions/restore`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Restore failed: ${res.status}`);
      }
      setMessage('Restored from original questions.');
      await loadCurrent();
    } catch (e: any) {
      setError(e.message ?? 'Failed to restore original');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Questions Configuration</h1>
        <p>Upload, edit, and manage the questions JSON used by the chat flow.</p>
      </header>

      <main className="main-container">
        <div className="left-panel" style={{ width: '100%' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Import questions JSON:{' '}
              <input type="file" accept="application/json" onChange={handleFileChange} />
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <button onClick={handleAddQuestion}>Add Question</button>{' '}
            <button onClick={handleSave} disabled={saving || !config}>
              {saving ? 'Saving...' : 'Save Current'}
            </button>{' '}
            <button onClick={handleRestore}>Restore Original</button>
          </div>

          {loading && <p>Loading questions…</p>}
          {error && (
            <p style={{ color: 'red' }}>
              {error}
            </p>
          )}
          {message && (
            <p style={{ color: 'green' }}>
              {message}
            </p>
          )}

          {config && (
            <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #ddd', padding: '0.5rem' }}>
              {config.questions.map((q, index) => (
                <div
                  key={q.id}
                  style={{
                    borderBottom: '1px solid #eee',
                    paddingBottom: '0.5rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div>
                    <label>
                      ID:{' '}
                      <input
                        value={q.id}
                        onChange={e => handleQuestionChange(index, 'id', e.target.value)}
                      />
                    </label>
                  </div>
                  <div>
                    <label>
                      Text:{' '}
                      <input
                        value={q.text}
                        onChange={e => handleQuestionChange(index, 'text', e.target.value)}
                        style={{ width: '80%' }}
                      />
                    </label>
                  </div>
                  <div>
                    <label>
                      Type:{' '}
                      <input
                        value={q.type ?? ''}
                        onChange={e => handleQuestionChange(index, 'type', e.target.value)}
                      />
                    </label>
                  </div>


                  {(q.type === 'multiple_choice' || q.type === 'multiple_select') && (
                    <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                      <strong>Options</strong>
                      {Array.isArray(q.options) && q.options.length > 0 ? (
                        q.options.map((opt: any, optIndex: number) => (
                          <div key={opt.id ?? optIndex} style={{ marginBottom: '0.25rem' }}>
                            <label>
                              Option ID:{' '}
                              <input
                                value={opt.id ?? ''}
                                onChange={e =>
                                  handleOptionChange(index, optIndex, 'id', e.target.value)
                                }
                              />
                            </label>{' '}
                            <label>
                              Label:{' '}
                              <input
                                value={opt.label ?? ''}
                                onChange={e =>
                                  handleOptionChange(index, optIndex, 'label', e.target.value)
                                }
                                style={{ width: '40%' }}
                              />
                            </label>{' '}
                            <label>
                              Description:{' '}
                              <input
                                value={opt.description ?? ''}
                                onChange={e =>
                                  handleOptionChange(
                                    index,
                                    optIndex,
                                    'description',
                                    e.target.value,
                                  )
                                }
                                style={{ width: '40%' }}
                              />
                            </label>{' '}
                            <button
                              type="button"
                              onClick={() => handleDeleteOption(index, optIndex)}
                            >
                              Delete option
                            </button>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: '#666' }}>
                          No options yet.
                        </p>
                      )}

                      <button type="button" onClick={() => handleAddOption(index)}>
                        Add option
                      </button>
                    </div>
                  )}
                  {q.id === 'q1_frequencies' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleAddQuarterlyWithFollowups(index)}
                      >
                        Add quarterly option + follow-up questions
                      </button>
                    </div>
                  )}
                  <button type="button" onClick={() => handleDeleteQuestion(q.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}