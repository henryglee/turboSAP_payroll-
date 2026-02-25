import { useState } from 'react';
import { FileText, Copy, Check } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Tab Button Component
// ─────────────────────────────────────────────────────────────────────────────

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-medium border-b-2 transition-colors
        ${isActive
          ? 'border-purple-500 text-purple-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
      `}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy Button Component
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copy
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Preview Component
// ─────────────────────────────────────────────────────────────────────────────

function CodePreview({ content, filename }: { content: string; filename: string }) {
  const lines = content.split('\n');

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">{filename}</span>
          <span className="text-xs text-gray-500">({lines.length} rows)</span>
        </div>
        <CopyButton text={content} />
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 w-10">#</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Content</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, index) => (
              <tr key={index} className={index === 0 ? 'bg-purple-50' : ''}>
                <td className="px-4 py-1.5 text-xs text-gray-400 font-mono">{index + 1}</td>
                <td className="px-4 py-1.5 font-mono text-gray-900 whitespace-nowrap">
                  {line}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function FilePreview() {
  const { generateT500P, generateT001P } = usePersonnelAreaV2Store();
  const [activeTab, setActiveTab] = useState<'T500P' | 'T001P'>('T500P');

  const t500pContent = generateT500P();
  const t001pContent = generateT001P();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900">SAP File Preview</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Preview the files that will be generated for SAP configuration.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex -mb-px">
          <TabButton
            label="T500P (Personnel Areas)"
            isActive={activeTab === 'T500P'}
            onClick={() => setActiveTab('T500P')}
          />
          <TabButton
            label="T001P (Personnel Subareas)"
            isActive={activeTab === 'T001P'}
            onClick={() => setActiveTab('T001P')}
          />
        </div>
      </div>

      {/* Content */}
      {activeTab === 'T500P' && (
        <CodePreview content={t500pContent} filename="T500P_personnel_areas.csv" />
      )}
      {activeTab === 'T001P' && (
        <CodePreview content={t001pContent} filename="T001P_personnel_subareas.csv" />
      )}

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
          Column Reference
        </h4>
        {activeTab === 'T500P' ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-mono text-purple-600">PERSA</span>
              <p className="text-xs text-gray-500">Personnel Area code</p>
            </div>
            <div>
              <span className="font-mono text-purple-600">NAME1</span>
              <p className="text-xs text-gray-500">Personnel Area name</p>
            </div>
            <div>
              <span className="font-mono text-purple-600">BUKRS</span>
              <p className="text-xs text-gray-500">Company Code</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-mono text-purple-600">WERKS</span>
              <p className="text-xs text-gray-500">Personnel Area code</p>
            </div>
            <div>
              <span className="font-mono text-purple-600">BTRTL</span>
              <p className="text-xs text-gray-500">Personnel Subarea code</p>
            </div>
            <div>
              <span className="font-mono text-purple-600">BTEXT</span>
              <p className="text-xs text-gray-500">Subarea description</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
