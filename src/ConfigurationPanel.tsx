import { useConfigStore } from './store';
import { PayFrequencyEditor } from './PayFrequencyEditor';

export function ConfigurationPanel() {
  const {
    profile,
    addPayFrequency,
    updatePayFrequency,
    removePayFrequency,
    updateBusinessUnit,
    updateUnion,
    updateTimeZone,
    toggleSecuritySplitting,
  } = useConfigStore();

  return (
    <div className="left-panel">
      <div className="section">
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Manual Configuration</h2>
          <p style={{ marginTop: '0.5rem', color: '#718096', fontSize: '0.9375rem', lineHeight: '1.6' }}>
            Manually configure payroll areas by setting company profile and preferences.
          </p>
        </div>
        <h2 className="section-title">Company Profile</h2>
        <div className="form-group">
          <label className="form-label">Company Name</label>
          <input
            type="text"
            className="form-input"
            value={profile.companyName}
            readOnly
            style={{ background: '#f7fafc' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Total Employees</label>
          <input
            type="number"
            className="form-input"
            value={profile.totalEmployees}
            readOnly
            style={{ background: '#f7fafc' }}
          />
        </div>
      </div>

      <PayFrequencyEditor
        frequencies={profile.payFrequencies}
        onAdd={addPayFrequency}
        onUpdate={updatePayFrequency}
        onRemove={removePayFrequency}
      />

      <div className="section">
        <h2 className="section-title">Business Units</h2>
        {profile.businessUnits.map((bu, idx) => (
          <div key={idx} className="checkbox-group">
            <input
              type="checkbox"
              id={`bu-${idx}`}
              checked={bu.requiresSeparateArea}
              onChange={(e) =>
                updateBusinessUnit(idx, { requiresSeparateArea: e.target.checked })
              }
            />
            <label htmlFor={`bu-${idx}`}>
              {bu.name}
              <span className="stat-badge">{bu.employeeCount} emp</span>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#718096' }}>
                {bu.requiresSeparateArea ? '(separate area)' : '(combined)'}
              </span>
            </label>
          </div>
        ))}
        <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
          Check to require separate payroll areas for funding/operational control
        </p>
      </div>

      <div className="section">
        <h2 className="section-title">Time Zones</h2>
        {profile.timeZones.map((tz, idx) => (
          <div key={idx} className="checkbox-group">
            <input
              type="checkbox"
              id={`tz-${idx}`}
              checked={tz.affectsProcessing}
              onChange={(e) =>
                updateTimeZone(idx, { affectsProcessing: e.target.checked })
              }
            />
            <label htmlFor={`tz-${idx}`}>
              {tz.name} ({tz.code})
              <span className="stat-badge">{tz.employeeCount} emp</span>
              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#718096' }}>
                {tz.affectsProcessing ? '(affects processing)' : '(no impact)'}
              </span>
            </label>
          </div>
        ))}
        <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
          Check if time zone differences affect payroll processing deadlines
        </p>
      </div>

      <div className="section">
        <h2 className="section-title">Unions</h2>
        {profile.unions.length > 0 ? (
          profile.unions.map((union, idx) => (
            <div key={idx} style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f7fafc', borderRadius: '4px' }}>
              <div className="checkbox-group" style={{ marginBottom: '0.5rem' }}>
                <strong>{union.name} ({union.code})</strong>
                <span className="stat-badge">{union.employeeCount} emp</span>
              </div>
              <div className="checkbox-group" style={{ marginLeft: '0rem' }}>
                <input
                  type="checkbox"
                  id={`union-${idx}-calendar`}
                  checked={union.uniqueCalendar}
                  onChange={(e) =>
                    updateUnion(idx, { uniqueCalendar: e.target.checked })
                  }
                />
                <label htmlFor={`union-${idx}-calendar`} style={{ fontSize: '0.8125rem' }}>
                  Requires unique payroll calendar
                </label>
              </div>
              <div className="checkbox-group" style={{ marginLeft: '0rem' }}>
                <input
                  type="checkbox"
                  id={`union-${idx}-funding`}
                  checked={union.uniqueFunding}
                  onChange={(e) =>
                    updateUnion(idx, { uniqueFunding: e.target.checked })
                  }
                />
                <label htmlFor={`union-${idx}-funding`} style={{ fontSize: '0.8125rem' }}>
                  Requires separate funding tracking
                </label>
              </div>
            </div>
          ))
        ) : (
          <p style={{ fontSize: '0.875rem', color: '#718096' }}>No unions configured</p>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Security / Access Control</h2>
        <div className="checkbox-group">
          <input
            type="checkbox"
            id="security-splitting"
            checked={profile.securitySplitting}
            onChange={toggleSecuritySplitting}
          />
          <label htmlFor="security-splitting">
            Require separate payroll areas for security/access control
          </label>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
          Only enable if mandatory segregation of duties is required
        </p>
      </div>
    </div>
  );
}
