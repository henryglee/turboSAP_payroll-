import { Download, RotateCcw, ArrowLeft } from 'lucide-react';
import { usePersonnelAreaV2Store } from '../../../stores/usePersonnelAreaV2Store';

// ─────────────────────────────────────────────────────────────────────────────
// Download Helper
// ─────────────────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ExportActions() {
  const { generateT500P, generateT001P, reset, goBack } = usePersonnelAreaV2Store();

  const handleDownloadT500P = () => {
    const content = generateT500P();
    downloadFile(content, 'T500P_personnel_areas.csv');
  };

  const handleDownloadT001P = () => {
    const content = generateT001P();
    downloadFile(content, 'T001P_personnel_subareas.csv');
  };

  const handleDownloadAll = () => {
    handleDownloadT500P();
    setTimeout(() => handleDownloadT001P(), 100);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to start over? This will clear all your configuration.')) {
      reset();
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDownloadAll}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Download className="h-5 w-5" />
          Download All Files
        </button>

        <button
          onClick={handleDownloadT500P}
          className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          T500P Only
        </button>

        <button
          onClick={handleDownloadT001P}
          className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          T001P Only
        </button>
      </div>

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
          onClick={handleReset}
          className="inline-flex items-center gap-2 px-4 py-3 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Start Over
        </button>
      </div>
    </div>
  );
}
