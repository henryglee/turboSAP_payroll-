import { useEffect, useState } from 'react';

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

const API_BASE = 'http://localhost:8000'; // adjust if needed

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
      const res = await fetch(`${API_BASE}/api/config/questions/current`);
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

        const res = await fetch(`${API_BASE}/api/config/questions/upload`, {
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

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/config/questions/current`, {
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
      const res = await fetch(`${API_BASE}/api/config/questions/restore`, {
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
                  <button onClick={() => handleDeleteQuestion(q.id)}>
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