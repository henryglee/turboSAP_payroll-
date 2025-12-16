import { useState } from 'react';
import type { PayFrequency, PayFrequencyType, CalendarPattern, PayDay } from './types';
import { Trash2, Plus, Edit2 } from 'lucide-react';

interface PayFrequencyEditorProps {
  frequencies: PayFrequency[];
  onAdd: (freq: PayFrequency) => void;
  onUpdate: (index: number, freq: Partial<PayFrequency>) => void;
  onRemove: (index: number) => void;
}

export function PayFrequencyEditor({
  frequencies,
  onAdd,
  onUpdate,
  onRemove,
}: PayFrequencyEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<PayFrequency>({
    type: 'weekly',
    employeeCount: 0,
    calendarPattern: 'mon-sun',
    payDay: 'friday',
  });

  const handleStartAdd = () => {
    setFormData({
      type: 'weekly',
      employeeCount: 0,
      calendarPattern: 'mon-sun',
      payDay: 'friday',
    });
    setIsAdding(true);
  };

  const handleStartEdit = (index: number) => {
    setFormData({ ...frequencies[index] });
    setEditingIndex(index);
  };

  const handleSave = () => {
    if (editingIndex !== null) {
      onUpdate(editingIndex, formData);
      setEditingIndex(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingIndex(null);
  };

  const getFrequencyLabel = (type: PayFrequencyType): string => {
    const labels: Record<PayFrequencyType, string> = {
      weekly: 'Weekly',
      biweekly: 'Bi-Weekly',
      semimonthly: 'Semi-Monthly',
      monthly: 'Monthly',
    };
    return labels[type];
  };

  const getCalendarLabel = (pattern: CalendarPattern): string => {
    const labels: Record<CalendarPattern, string> = {
      'mon-sun': 'Monday - Sunday',
      'sun-sat': 'Sunday - Saturday',
      'custom': 'Custom',
    };
    return labels[pattern];
  };

  const getPayDayLabel = (payDay: PayDay): string => {
    const labels: Record<PayDay, string> = {
      thursday: 'Thursday',
      friday: 'Friday',
      current: 'Current (within period)',
      custom: 'Custom',
    };
    return labels[payDay];
  };

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Pay Frequencies</h2>
        {!isAdding && editingIndex === null && (
          <button className="button button-small" onClick={handleStartAdd}>
            <Plus size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
            Add Frequency
          </button>
        )}
      </div>

      <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '1rem' }}>
        Define the pay frequencies for your organization. Each frequency will generate separate payroll calendars.
      </p>

      {/* Existing frequencies */}
      {frequencies.map((freq, idx) => (
        <div
          key={idx}
          style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            background: editingIndex === idx ? '#edf2f7' : '#f7fafc',
            borderRadius: '4px',
            border: editingIndex === idx ? '2px solid #667eea' : '1px solid #e2e8f0',
          }}
        >
          {editingIndex === idx ? (
            // Edit mode
            <div>
              <div className="form-group">
                <label className="form-label">Frequency Type</label>
                <select
                  className="form-input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as PayFrequencyType })}
                >
                  <option value="weekly">Weekly (52-53 periods/year)</option>
                  <option value="biweekly">Bi-Weekly (26 periods/year)</option>
                  <option value="semimonthly">Semi-Monthly (24 periods/year)</option>
                  <option value="monthly">Monthly (12 periods/year)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Employee Count</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.employeeCount}
                  onChange={(e) => setFormData({ ...formData, employeeCount: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Period Begin/End Pattern
                  {formData.type === 'semimonthly' && (
                    <span style={{ fontSize: '0.75rem', color: '#718096', marginLeft: '0.5rem' }}>
                      (1-15 and 16-end of month)
                    </span>
                  )}
                </label>
                <select
                  className="form-input"
                  value={formData.calendarPattern}
                  onChange={(e) => setFormData({ ...formData, calendarPattern: e.target.value as CalendarPattern })}
                  disabled={formData.type === 'semimonthly'}
                >
                  <option value="mon-sun">Monday - Sunday</option>
                  <option value="sun-sat">Sunday - Saturday</option>
                  <option value="custom">Custom</option>
                </select>
                {formData.type === 'semimonthly' && (
                  <p style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.25rem' }}>
                    Semi-monthly always uses 1-15 and 16-end of month
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Pay Date (Check Date)</label>
                <select
                  className="form-input"
                  value={formData.payDay}
                  onChange={(e) => setFormData({ ...formData, payDay: e.target.value as PayDay })}
                >
                  <option value="thursday">Thursday (after period ends)</option>
                  <option value="friday">Friday (after period ends)</option>
                  <option value="current">Current (within period)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="button button-small" onClick={handleSave}>
                  Save
                </button>
                <button className="button button-secondary button-small" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  {getFrequencyLabel(freq.type)}
                  <span className="stat-badge">{freq.employeeCount} employees</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4a5568' }}>
                  {freq.type === 'semimonthly'
                    ? '1-15 and 16-end of month'
                    : getCalendarLabel(freq.calendarPattern)
                  }, Pay date: {getPayDayLabel(freq.payDay)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="button button-secondary button-small"
                  onClick={() => handleStartEdit(idx)}
                  style={{ padding: '0.25rem 0.5rem' }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="button button-secondary button-small"
                  onClick={() => onRemove(idx)}
                  style={{ padding: '0.25rem 0.5rem', background: '#e53e3e' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new frequency form */}
      {isAdding && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            background: '#edf2f7',
            borderRadius: '4px',
            border: '2px solid #667eea',
          }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Add New Pay Frequency
          </h3>

          <div className="form-group">
            <label className="form-label">Frequency Type</label>
            <select
              className="form-input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as PayFrequencyType })}
            >
              <option value="weekly">Weekly (52-53 periods/year)</option>
              <option value="biweekly">Bi-Weekly (26 periods/year)</option>
              <option value="semimonthly">Semi-Monthly (24 periods/year)</option>
              <option value="monthly">Monthly (12 periods/year)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Employee Count</label>
            <input
              type="number"
              className="form-input"
              value={formData.employeeCount}
              onChange={(e) => setFormData({ ...formData, employeeCount: parseInt(e.target.value) || 0 })}
              min="0"
              placeholder="Enter number of employees"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Period Begin/End Pattern
              {formData.type === 'semimonthly' && (
                <span style={{ fontSize: '0.75rem', color: '#718096', marginLeft: '0.5rem' }}>
                  (1-15 and 16-end of month)
                </span>
              )}
            </label>
            <select
              className="form-input"
              value={formData.calendarPattern}
              onChange={(e) => setFormData({ ...formData, calendarPattern: e.target.value as CalendarPattern })}
              disabled={formData.type === 'semimonthly'}
            >
              <option value="mon-sun">Monday - Sunday</option>
              <option value="sun-sat">Sunday - Saturday</option>
              <option value="custom">Custom</option>
            </select>
            {formData.type === 'semimonthly' && (
              <p style={{ fontSize: '0.7rem', color: '#718096', marginTop: '0.25rem' }}>
                Semi-monthly always uses 1-15 and 16-end of month
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Pay Date (Check Date)</label>
            <select
              className="form-input"
              value={formData.payDay}
              onChange={(e) => setFormData({ ...formData, payDay: e.target.value as PayDay })}
            >
              <option value="thursday">Thursday (after period ends)</option>
              <option value="friday">Friday (after period ends)</option>
              <option value="current">Current (within period)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button button-small" onClick={handleSave}>
              Add Frequency
            </button>
            <button className="button button-secondary button-small" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {frequencies.length === 0 && !isAdding && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#718096' }}>
          <p style={{ fontSize: '0.875rem' }}>No pay frequencies configured yet.</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Click "Add Frequency" to get started.
          </p>
        </div>
      )}
    </div>
  );
}
