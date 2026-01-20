import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Upload, Trash2, File, X, ExternalLink, Printer, Eye } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { ConfirmDialog } from './ConfirmDialog';

interface CompanyDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: Date;
  description?: string;
}

interface FileManagerProps {
  documents: CompanyDocument[];
  onAddDocument: (document: CompanyDocument) => void;
  onDeleteDocument: (id: string) => void;
}

const isPdfDoc = (doc: CompanyDocument) =>
  doc.url.startsWith('data:application/pdf') || doc.name.toLowerCase().endsWith('.pdf');

const dataUrlToUint8Array = (dataUrl: string): Uint8Array => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    throw new Error('Invalid data URL');
  }
  const header = dataUrl.slice(0, commaIndex);
  const dataPart = dataUrl.slice(commaIndex + 1);

  if (header.includes(';base64')) {
    const binaryString = atob(dataPart);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  const decoded = decodeURIComponent(dataPart);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
};

const PdfCanvasPreview: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel?: () => void } | null = null;
    let loadingTask: { destroy?: () => void } | null = null;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = url.startsWith('data:')
          ? dataUrlToUint8Array(url)
          : new Uint8Array(await (await fetch(url)).arrayBuffer());

        // Use pdf.js without a dedicated worker to avoid runtime worker-url issues
        // (some browsers/settings otherwise force downloads or hang the preview).
        loadingTask = (pdfjsLib as any).getDocument({ data, disableWorker: true });
        const pdf = await (loadingTask as any).promise;
        const page = await pdf.getPage(1);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Fit-to-width-ish: scale based on container width if possible
        const containerWidth = canvas.parentElement?.clientWidth ?? 800;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(1, Math.min(2.5, (containerWidth - 24) / unscaledViewport.width));
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        renderTask = page.render({ canvasContext: context, viewport });
        await (renderTask as any).promise;
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to render PDF');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel?.();
      } catch {
        // ignore
      }
      try {
        loadingTask?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, [url]);

  return (
    <div className="w-full h-full flex flex-col">
      {loading && (
        <div className="text-slate-400 text-sm mb-3">Loading PDF preview…</div>
      )}
      {error && (
        <div className="text-red-300 text-sm mb-3">
          {error} — try “Open in New Tab”.
        </div>
      )}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-700 bg-slate-950">
        <canvas ref={canvasRef} aria-label={title} className="block mx-auto" />
      </div>
    </div>
  );
};

export const FileManager: React.FC<FileManagerProps> = ({ documents = [], onAddDocument, onDeleteDocument }) => {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('Other');
  const [docDescription, setDocDescription] = useState('');
  
  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newDoc: CompanyDocument = {
        id: Date.now().toString(),
        name: file.name,
        type: docType,
        url: url,
        uploadedAt: new Date(),
        description: docDescription || undefined
      };
      onAddDocument(newDoc);
      setUploadFile(null);
      setDocDescription('');
      setDocType('Other');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const openDocument = (url: string) => {
    window.open(url, '_blank');
  };

  const downloadDocument = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printDocument = (url: string) => {
    const printWindow = window.open(url, '_blank');
    printWindow?.print();
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FolderOpen size={32} className="text-amber-500" />
            Company Documents
          </h1>
        </div>

        {/* Upload Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Upload size={16} /> Upload Document</h4>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/4">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Type</label>
              <select 
                value={docType} 
                onChange={(e) => setDocType(e.target.value)} 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="Contract">Contract</option>
                <option value="Invoice">Invoice</option>
                <option value="Report">Report</option>
                <option value="Certificate">Certificate</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="w-full md:w-1/3">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description (Optional)</label>
              <input 
                type="text" 
                value={docDescription} 
                onChange={(e) => setDocDescription(e.target.value)} 
                placeholder="e.g., Q1 2026 Report" 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" 
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Select File</label>
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-amber-400 hover:file:bg-slate-600 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Documents</h4>
          <div className="grid grid-cols-1 gap-3">
            {documents && documents.length > 0 ? (
              documents.slice().sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).map(doc => (
                <div key={doc.id} className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between group transition-all gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-600 text-blue-400 flex-shrink-0">
                      <File size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{doc.name}</h5>
                      {doc.description && (
                        <p className="text-xs text-amber-500 mt-0.5 font-medium">{doc.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">{new Date(doc.uploadedAt).toLocaleDateString()} • {doc.type}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPreviewDoc(doc);
                      }} 
                      title="Preview" 
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDocument(doc.url);
                      }}
                      title="Open in New Tab" 
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
                    >
                      <ExternalLink size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        printDocument(doc.url);
                      }}
                      title="Print" 
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                    >
                      <Printer size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Delete Document',
                          message: `Are you sure you want to delete "${doc.name}"? This action cannot be undone.`,
                          variant: 'danger',
                          onConfirm: () => {
                            onDeleteDocument(doc.id);
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                          }
                        });
                      }} 
                      title="Delete" 
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 italic border border-slate-700 border-dashed rounded-xl">No documents. Upload one to get started.</div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
              <div>
                <h3 className="text-lg font-bold text-white">{previewDoc.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{previewDoc.description} • {previewDoc.type} • {new Date(previewDoc.uploadedAt).toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all flex-shrink-0"
              >
                <X size={24} />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 p-6 bg-slate-900 min-h-[500px] flex flex-col">
              {previewDoc.url.includes('data:image') ? (
                // Image Preview
                <img 
                  src={previewDoc.url} 
                  alt={previewDoc.name} 
                  className="max-w-full max-h-full object-contain rounded-lg mx-auto"
                  onError={(e) => console.error('Image load error:', e)}
                />
              ) : isPdfDoc(previewDoc) ? (
                <PdfCanvasPreview url={previewDoc.url} title={previewDoc.name} />
              ) : previewDoc.url.includes('data:text') ? (
                // Text Preview
                <div className="bg-slate-800 rounded-lg p-6 max-h-full overflow-auto border border-slate-700 w-full">
                  <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">
                    {atob(previewDoc.url.split(',')[1])}
                  </pre>
                </div>
              ) : (
                // Other file types - show message
                <div className="text-center text-slate-400 flex flex-col items-center gap-4 justify-center h-full">
                  <File size={64} className="text-slate-600" />
                  <div>
                    <p className="font-semibold text-white mb-2">{previewDoc.name}</p>
                    <p className="text-sm">Preview not available for this file type</p>
                    <button 
                      onClick={() => openDocument(previewDoc.url)} 
                      className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-all"
                    >
                      Download File
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-slate-700 bg-slate-800 justify-end">
              <button 
                onClick={() => printDocument(previewDoc.url)} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
              >
                <Printer size={16} /> Print
              </button>
              <button 
                onClick={() => setPreviewDoc(null)} 
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
};
