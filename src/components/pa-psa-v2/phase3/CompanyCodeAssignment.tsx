import { Building, ArrowLeft, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Company Code Select Component
// ─────────────────────────────────────────────────────────────────────────────

function CompanyCodeSelect({
  value,
  onChange,
  availableCodes,
  placeholder = 'Select company code...',
  hasError = false,
}: {
  value: string;
  onChange: (code: string) => void;
  availableCodes: { code: string; name: string }[];
  placeholder?: string;
  hasError?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-full px-3 py-2 border rounded-lg text-sm appearance-none cursor-pointer
        focus:outline-none focus:ring-2
        ${hasError
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
          : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20'
        }
      `}
    >
      <option value="">{placeholder}</option>
      {availableCodes.map((cc) => (
        <option key={cc.code} value={cc.code}>
          {cc.code} - {cc.name}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function CompanyCodeAssignment() {
  const {
    regions,
    companyCodeMode,
    globalCompanyCode,
    regionCompanyCodes,
    availableCompanyCodes,
    setCompanyCodeMode,
    setGlobalCompanyCode,
    setRegionCompanyCode,
    loadCompanyCodes,
    goBack,
    goNext,
    canProceed,
  } = usePersonnelAreaV2Store();

  const hasCompanyCodes = availableCompanyCodes.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Assign Company Codes
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Link each Personnel Area to a Company Code for financial integration.
        </p>
      </div>

      {/* Why This Matters */}
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-900 mb-1">Why this matters</h4>
        <p className="text-sm text-purple-800">
          Company Codes (BUKRS) represent legal entities in SAP FI. Each Personnel Area must be
          assigned to a Company Code for payroll posting and financial reporting.
        </p>
      </div>

      {/* No Company Codes Warning */}
      {!hasCompanyCodes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-1">
                No company codes found
              </h4>
              <p className="text-sm text-yellow-800 mb-3">
                You haven't configured any company codes yet. Please set them up first, or enter codes manually.
              </p>
              <button
                onClick={loadCompanyCodes}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 rounded hover:bg-yellow-200 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Assignment Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setCompanyCodeMode('same')}
            className={`
              flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left
              ${companyCodeMode === 'same'
                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <div className={`
              w-4 h-4 rounded-full border-2 flex items-center justify-center
              ${companyCodeMode === 'same' ? 'border-purple-500' : 'border-gray-300'}
            `}>
              {companyCodeMode === 'same' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
            </div>
            <div>
              <p className={`font-medium ${companyCodeMode === 'same' ? 'text-purple-900' : 'text-gray-700'}`}>
                Same for all
              </p>
              <p className="text-sm text-gray-500">
                All Personnel Areas use one company code
              </p>
            </div>
          </button>

          <button
            onClick={() => setCompanyCodeMode('individual')}
            className={`
              flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left
              ${companyCodeMode === 'individual'
                ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <div className={`
              w-4 h-4 rounded-full border-2 flex items-center justify-center
              ${companyCodeMode === 'individual' ? 'border-purple-500' : 'border-gray-300'}
            `}>
              {companyCodeMode === 'individual' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
            </div>
            <div>
              <p className={`font-medium ${companyCodeMode === 'individual' ? 'text-purple-900' : 'text-gray-700'}`}>
                Different per region
              </p>
              <p className="text-sm text-gray-500">
                Each Personnel Area has its own company code
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Company Code Assignment */}
      {companyCodeMode === 'same' ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Company Code for All Personnel Areas</h3>
          <div className="max-w-md">
            {hasCompanyCodes ? (
              <CompanyCodeSelect
                value={globalCompanyCode}
                onChange={setGlobalCompanyCode}
                availableCodes={availableCompanyCodes}
                hasError={!globalCompanyCode}
              />
            ) : (
              <input
                type="text"
                value={globalCompanyCode}
                onChange={(e) => setGlobalCompanyCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="Enter company code (e.g., 1000)"
                maxLength={4}
                className={`
                  w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase
                  focus:outline-none focus:ring-2
                  ${!globalCompanyCode
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20'
                  }
                `}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Company Code per Personnel Area</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Personnel Area
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Company Code
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {regions.map((region) => {
                  const currentCode = regionCompanyCodes[region.id] || '';
                  const hasError = !currentCode;

                  return (
                    <tr key={region.id} className={hasError ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-purple-500" />
                          <span className="font-mono text-sm text-gray-500">{region.code}</span>
                          <span className="font-medium text-gray-900">{region.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs">
                          {hasCompanyCodes ? (
                            <CompanyCodeSelect
                              value={currentCode}
                              onChange={(code) => setRegionCompanyCode(region.id, code)}
                              availableCodes={availableCompanyCodes}
                              placeholder="Select..."
                              hasError={hasError}
                            />
                          ) : (
                            <input
                              type="text"
                              value={currentCode}
                              onChange={(e) => setRegionCompanyCode(region.id, e.target.value.toUpperCase().slice(0, 4))}
                              placeholder="Enter code"
                              maxLength={4}
                              className={`
                                w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase
                                focus:outline-none focus:ring-2
                                ${hasError
                                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                                  : 'border-gray-200 focus:border-purple-500 focus:ring-purple-500/20'
                                }
                              `}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={goNext}
          disabled={!canProceed()}
          className={`
            inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
            ${canProceed()
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
