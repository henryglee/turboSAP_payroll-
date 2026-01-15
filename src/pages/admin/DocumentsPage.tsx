/**
 * DocumentsPage - Document upload/management page for admins
 * Allows uploading documents (PPT, DOCX, XLSX) to S3 for future vector DB processing
 */

import { useState, useRef, useCallback, useId } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  File,
} from 'lucide-react';
import { apiFetch } from '../../api/utils';

// File type config
const ALLOWED_TYPES = {
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/pdf': 'pdf',
};

const ALLOWED_EXTENSIONS = ['.pptx', '.ppt', '.docx', '.doc', '.xlsx', '.xls', '.pdf'];
const KB_COMPANY_NAME = 'default';
const KB_COMPANY_CODE = 'default-code';
const KB_CONTENT_TYPE_MAP: Record<string, 'ppt' | 'words' | 'docs' | 'xlxs'> = {
  ppt: 'ppt',
  pptx: 'ppt',
  doc: 'words',
  docx: 'words',
  pdf: 'docs',
  xlsx: 'xlxs',
  xls: 'xlxs',
};
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface Document {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  s3Key?: string;
}

// Mock data - remove when API is ready
const MOCK_DOCUMENTS: Document[] = [
  { id: '1', name: 'SAP_Training_Guide.pptx', fileType: 'pptx', fileSize: 24500000, uploadedAt: '2025-01-10T14:30:00Z' },
  { id: '2', name: 'Payroll_Policies.docx', fileType: 'docx', fileSize: 890000, uploadedAt: '2025-01-08T09:15:00Z' },
  { id: '3', name: 'Employee_Data_Template.xlsx', fileType: 'xlsx', fileSize: 1200000, uploadedAt: '2025-01-05T16:45:00Z' },
];

export function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get icon for file type
  const getFileIcon = (fileType: string) => {
    if (['pptx', 'ppt'].includes(fileType)) {
      return <Presentation className="h-5 w-5 text-orange-500" />;
    }
    if (['docx', 'doc'].includes(fileType)) {
      return <FileText className="h-5 w-5 text-blue-500" />;
    }
    if (['xlsx', 'xls'].includes(fileType)) {
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    }
    if (fileType === 'pdf') {
      return <File className="h-5 w-5 text-red-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${formatSize(MAX_FILE_SIZE)}`;
    }
    return null;
  };

  const resolveKnowledgebaseContentType = (filename: string): 'ppt' | 'words' | 'docs' | 'xlxs' => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return KB_CONTENT_TYPE_MAP[ext] || 'docs';
  };

  const requestPresignedUpload = async (
    contentType: 'ppt' | 'words' | 'docs' | 'xlxs'
  ) => {
    return apiFetch<{ uploadUrl: string; rawResponse: Record<string, unknown> }>(
      '/api/knowledgebase/presign',
      {
        method: 'POST',
        body: JSON.stringify({
          companyName: KB_COMPANY_NAME,
          companyCode: KB_COMPANY_CODE,
          contentType,
        }),
      }
    );
  };

  const uploadToPresignedUrl = async (uploadUrl: string, file: File) => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Upload failed (${response.status}): ${errorBody || response.statusText}`
      );
    }

    return uploadUrl.split('?')[0];
  };

  // Handle file upload
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setMessage(null);

    const file = files[0];
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);

    try {
      const kbContentType = resolveKnowledgebaseContentType(file.name);
      const { uploadUrl } = await requestPresignedUpload(kbContentType);
      if (!uploadUrl) {
        throw new Error('Failed to obtain upload URL');
      }
      console.log(`upload URL: ${uploadUrl}`)

      const objectUrl = await uploadToPresignedUrl(uploadUrl, file);

      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        s3Key: objectUrl,
      };

      setDocuments(prev => [newDoc, ...prev]);
      setMessage(`"${file.name}" uploaded successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      setError(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle delete
  const handleDelete = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    setError(null);
    setMessage(null);

    try {
      // TODO: Replace with actual API call when backend is ready
      // await apiFetch(`/api/admin/documents/${docId}`, { method: 'DELETE' });

      // Mock delete
      await new Promise(resolve => setTimeout(resolve, 500));

      setDocuments(prev => prev.filter(d => d.id !== docId));
      setMessage(`"${doc.name}" deleted successfully`);
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete file');
    }
  };

  // Drag handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  }, []);

  return (
    <AdminLayout
      title="Documents"
      description="Upload and manage training documents for the knowledge base"
    >
      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4 text-red-500 hover:text-red-700" />
          </button>
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{message}</p>
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="h-4 w-4 text-green-500 hover:text-green-700" />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-amber-500 bg-amber-50'
            : 'border-gray-300 bg-white hover:border-amber-400 hover:bg-amber-50/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={(e) => handleUpload(e.target.files)}
          className="sr-only"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-amber-100">
              <Upload className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Drop files here or{' '}
                <label
                  htmlFor={fileInputId}
                  className={`text-amber-600 hover:text-amber-700 underline ${
                    uploading
                      ? 'opacity-50 cursor-not-allowed pointer-events-none'
                      : 'cursor-pointer'
                  }`}
                >
                  browse
                </label>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PPT, DOCX, XLSX, PDF supported (max {formatSize(MAX_FILE_SIZE)})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Size</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Uploaded</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No documents uploaded yet</p>
                    <p className="text-sm text-gray-400 mt-1">Upload your first document above</p>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.fileType)}
                        <span className="font-medium text-gray-900 truncate max-w-xs">
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                        {doc.fileType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatSize(doc.fileSize)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(doc.uploadedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {deleteConfirm === doc.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(doc.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-4 text-xs text-gray-400 text-center">
        Documents will be processed for the knowledge base after upload
      </p>
    </AdminLayout>
  );
}
