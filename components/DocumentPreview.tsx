'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Printer, File, FileText, Edit, Save, FileDown, Mail } from 'lucide-react';
import mammoth from 'mammoth';
import { StorageService } from '../services/storageService';
import NovelEditor from './NovelEditor';
import type { Editor } from '@tiptap/react';

interface DocumentPreviewProps {
  document: {
    name: string;
    url: string;
    description?: string;
    uploadedAt?: Date;
    date?: Date;
    id?: string;
  };
  onClose: () => void;
  allowEdit?: boolean; // Enable editing for DOCX files
  onSave?: (updatedUrl: string) => void; // Callback after saving
  clientId?: string; // Client ID for PDF upload path
  folder?: string; // Folder path for PDF upload (e.g., 'documents', 'quotes')
  onPdfCreated?: (pdfDocument: { name: string; url: string; id: string; date: Date }) => void; // Callback when PDF is created
  onSendEmail?: (document: { name: string; url: string; id: string; date: Date }) => void; // Callback to send document via email
}

const isPdfDoc = (doc: { url: string; name: string }) =>
  !!doc.url && (
    doc.url.startsWith('data:application/pdf') ||
    doc.name?.toLowerCase().endsWith('.pdf') ||
    doc.url.toLowerCase().includes('.pdf')
  );

const isDocxDoc = (doc: { url: string; name: string }) =>
  !!doc.url && (
    doc.url.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    doc.name?.toLowerCase().endsWith('.docx') ||
    doc.url.toLowerCase().includes('.docx')
  );

const isHtmlDoc = (doc: { url: string; name: string }) =>
  !!doc.url && (
    doc.url.startsWith('data:text/html') ||
    doc.name?.toLowerCase().endsWith('.html') ||
    doc.name?.toLowerCase().endsWith('.htm') ||
    doc.url.toLowerCase().includes('.html') ||
    doc.url.toLowerCase().includes('.htm')
  );

const HtmlPreview: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const [html, setHtml] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (url.startsWith('data:text/html')) {
          const base64 = url.split(',')[1];
          setHtml(atob(base64));
        } else {
          const res = await fetch(url);
          setHtml(await res.text());
        }
      } catch (e) {
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [url]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
    </div>
  );
  if (error) return <div className="text-red-400 p-4">{error}</div>;

  return (
    <div
      className="bg-white rounded-lg p-8 mx-auto prose prose-slate max-w-4xl"
      style={{ color: '#1e293b', fontSize: '14px', lineHeight: '1.6' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const PdfPreview: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  // #toolbar=0&navpanes=0 suppresses the download toolbar in Chrome's PDF viewer
  const src = url.startsWith('data:') ? url : `${url}#toolbar=0&navpanes=0&scrollbar=1`;
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
        <iframe
          src={src}
          title={title}
          className="w-full min-h-[600px] h-full"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
};

const DocxPreview: React.FC<{ 
  url: string; 
  name: string; 
  allowEdit?: boolean; 
  onSave?: (docxBlob: Blob) => void;
  clientId?: string;
  folder?: string;
  onPdfCreated?: (pdfDocument: { name: string; url: string; id: string; date: Date }) => void;
}> = ({ url, name, allowEdit = false, onSave, clientId, folder, onPdfCreated }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [originalArrayBuffer, setOriginalArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [embeddedStyles, setEmbeddedStyles] = useState<string>('');
  const editorRef = useRef<Editor | null>(null);

  const decodeQuotedPrintable = (input: string) => {
    return input
      .replace(/=\r?\n/g, '')
      .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  };

  const extractHtmlBody = (html: string) => {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1].trim() : html;
  };

  const extractStyleBlocks = (html: string) => {
    const matches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
    return matches ? matches.join('\n') : '';
  };

  const isRenderableHtml = (html: string) => {
    const trimmed = (html || '').trim();
    if (!trimmed) return false;
    const textLength = trimmed.replace(/<[^>]*>/g, '').trim().length;
    if (textLength > 0) return true;
    return /<(img|table|svg|canvas|object|iframe|div|p|span|h[1-6]|ul|ol|li|br)\b/i.test(trimmed);
  };

  useEffect(() => {
    const loadDocx = async () => {
      try {
        setLoading(true);
        setError(null);

        let arrayBuffer: ArrayBuffer;
        if (url.startsWith('data:')) {
          // Convert data URL to ArrayBuffer
          const base64Data = url.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else {
          // Fetch remote URL and convert to ArrayBuffer
          const response = await fetch(url, { cache: 'no-store' });
          arrayBuffer = await response.arrayBuffer();
        }

        setOriginalArrayBuffer(arrayBuffer);
        const result = await mammoth.convertToHtml({ arrayBuffer });
        let htmlResult = (result.value || '').trim();
        let previewHtml = htmlResult;
        let editableHtml = extractHtmlBody(htmlResult);
        let styleBlocks = extractStyleBlocks(htmlResult);

        if (!isRenderableHtml(previewHtml)) {
          try {
            const PizZipModule = await import('pizzip');
            const PizZip = (PizZipModule as any).default || PizZipModule;
            const zip = new PizZip(arrayBuffer);
            const zipFiles = Object.keys((zip as any).files || {});
            const chunkPath = zipFiles.find(path => /^word\/afchunk.*\.(mht|mhtml)$/i.test(path));

            if (chunkPath) {
              const mhtRaw = zip.file(chunkPath)?.asText() || '';
              const decoded = decodeQuotedPrintable(mhtRaw);
              const htmlMatch = decoded.match(/<html[\s\S]*<\/html>/i) || mhtRaw.match(/<html[\s\S]*<\/html>/i);
              if (htmlMatch?.[0]) {
                const fallbackHtml = htmlMatch[0].trim();
                styleBlocks = extractStyleBlocks(fallbackHtml);
                editableHtml = extractHtmlBody(fallbackHtml).trim();
                previewHtml = `${styleBlocks}${editableHtml}`.trim();
              }
            }
          } catch (fallbackError) {
            console.warn('DOCX fallback parse failed:', fallbackError);
          }
        }

        if (!isRenderableHtml(previewHtml)) {
          setError('Unable to render this DOCX preview. Please download to view.');
          setHtmlContent('');
          setEditorContent('');
          setEmbeddedStyles('');
        } else {
          setEmbeddedStyles(styleBlocks);
          setHtmlContent(previewHtml);
          setEditorContent(editableHtml);
        }
        
        if (result.messages.length > 0) {
          console.warn('Mammoth conversion messages:', result.messages);
        }
      } catch (err) {
        console.error('Error loading DOCX:', err);
        setError('Failed to load document preview');
      } finally {
        setLoading(false);
      }
    };

    loadDocx();
  }, [url, name]);

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditorContent(extractHtmlBody(htmlContent)); // Reset to original content
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    if (!originalArrayBuffer) {
      alert('Original document not loaded yet. Please wait and try again.');
      return;
    }

    setSaving(true);
    try {
      const editedHtml = editorRef.current.getHTML();

      const defaultStyleBlock = `<style>
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; max-width: 860px; margin: 40px auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ccc; padding: 6px 8px; }
    img { max-width: 100%; }
    h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 14pt; }
  </style>`;

      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${embeddedStyles || defaultStyleBlock}
</head>
<body>${editedHtml}</body>
</html>`;

      // Encode both HTML and original DOCX so the server can merge them
      const htmlBase64 = btoa(unescape(encodeURIComponent(fullHtml)));
      const origBytes = new Uint8Array(originalArrayBuffer);
      let binaryStr = '';
      for (let i = 0; i < origBytes.length; i++) binaryStr += String.fromCharCode(origBytes[i]);
      const originalDocxBase64 = btoa(binaryStr);

      const response = await fetch('/api/convert-html-to-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlBase64, originalDocxBase64 }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Conversion failed');
      }

      const { docxBase64 } = await response.json();

      // Decode base64 → real DOCX Blob
      const decoded = atob(docxBase64);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      const docxBlob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Update local preview immediately so user sees changes without reload
      setHtmlContent(`${embeddedStyles}${editedHtml}`.trim());
      setEditorContent(editedHtml);
      setEditMode(false);

      // Pass the real DOCX blob upstream for persistence
      if (onSave) {
        onSave(docxBlob);
      }
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Failed to save document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToPdf = async () => {
    if (!originalArrayBuffer) {
      alert('Document not loaded');
      return;
    }

    if (!clientId || !folder) {
      alert('Cannot save PDF: missing client or folder information');
      return;
    }

    setConverting(true);
    try {
      // Convert ArrayBuffer to base64
      const uint8Array = new Uint8Array(originalArrayBuffer);
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      const docxBase64 = btoa(binaryString);
      
      // Call PDF conversion API
      const response = await fetch('/api/convert-docx-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docxBase64 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to convert to PDF');
      }

      const { pdfBase64 } = await response.json();
      
      // Store PDF in app storage (Mongo-backed document URL)
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
      const pdfFileName = name.replace('.docx', '.pdf');
      const timestamp = Date.now();
      const storagePath = `clients/${clientId}/${folder}/${pdfFileName.replace(/\s+/g, '_')}_${timestamp}`;
      
      const pdfUrl = await StorageService.uploadFile(pdfDataUrl, storagePath);
      
      // Create PDF document object
      const pdfDocument = {
        id: `pdf_${timestamp}`,
        name: pdfFileName,
        url: pdfUrl,
        date: new Date(),
      };
      
      // Notify parent component
      if (onPdfCreated) {
        onPdfCreated(pdfDocument);
      }
      
      alert(`PDF created successfully: ${pdfFileName}`);
    } catch (err) {
      console.error('Error converting to PDF:', err);
      alert('Failed to convert to PDF');
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[500px]">
        <div className="text-slate-400 flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
          <p>Loading document preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[500px]">
        <div className="text-red-400 flex flex-col items-center gap-3">
          <FileText size={48} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col min-h-full">
      {/* Toolbar for editing */}
      {allowEdit && (
        <div className="sticky top-0 z-10 flex-shrink-0 mb-4 flex items-center justify-between gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 shadow-md">
          <div className="flex items-center gap-2">
            {editMode ? (
              <span className="text-sm text-slate-300">✏️ Edit mode - Make your changes below</span>
            ) : (
              <span className="text-sm text-slate-400">👁️ View mode</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {editMode ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEdit}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center gap-2"
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  onClick={handleConvertToPdf}
                  disabled={converting}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {converting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <FileDown size={14} />
                      Convert to PDF
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-slate-900 rounded-lg">
        {editMode ? (
          <div className="flex flex-col p-4" style={{ minHeight: '60vh' }}>
            <div className="flex-1 bg-white rounded-lg shadow-lg overflow-hidden">
              <NovelEditor
                content={editorContent}
                onChange={setEditorContent}
                placeholder="Edit your document..."
                dark={false}
                minHeight="500px"
                editable={!saving}
                showToolbar={true}
                onEditorReady={(editor) => {
                  editorRef.current = editor;
                }}
              />
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div 
              className="bg-white rounded-lg p-8 mx-auto prose prose-slate max-w-4xl"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              style={{
                minHeight: '500px',
                color: '#1e293b',
                fontSize: '14px',
                lineHeight: '1.6'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
  document: doc, 
  onClose, 
  allowEdit = false, 
  onSave,
  clientId,
  folder,
  onPdfCreated,
  onSendEmail
}) => {
  const [saving, setSaving] = useState(false);

  const downloadDocument = (url: string, filename: string) => {
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleSaveDocx = async (blob: Blob) => {
    setSaving(true);
    try {
      const newDocxDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result);
            return;
          }
          reject(new Error('Failed to encode edited document'));
        };
        reader.onerror = () => reject(new Error('Failed to read edited document blob'));
        reader.readAsDataURL(blob);
      });
      
      if (onSave) {
        await onSave(newDocxDataUrl);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to save document to server');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const printDocument = (url: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow pop-ups to print documents');
      return;
    }

    const isImage = url.includes('data:image') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = url.includes('data:application/pdf') || url.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print PDF</title>
            <style>
              body { margin: 0; padding: 0; }
              iframe { width: 100vw; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${url}" onload="setTimeout(() => { this.contentWindow.print(); }, 1000);"></iframe>
          </body>
        </html>
      `);
    } else if (isImage) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Image</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${url}" onload="setTimeout(() => { window.print(); }, 500);" />
          </body>
        </html>
      `);
    } else {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>Print</title></head>
          <body>
            <p>Unable to preview this file type for printing.</p>
            <script>setTimeout(() => { window.print(); }, 500);</script>
          </body>
        </html>
      `);
    }

    printWindow.document.close();
  };

  const displayDate = doc.uploadedAt || doc.date;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto flex flex-col mx-4" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <div>
            <h3 className="text-lg font-bold text-white">{doc.name}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {doc.description && `${doc.description} • `}
              {displayDate && new Date(displayDate).toLocaleDateString()}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all flex-shrink-0"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-900 flex flex-col">
          {doc.url.includes('data:image') || doc.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <div className="flex-1 overflow-auto p-6">
              <img 
                src={doc.url} 
                alt={doc.name} 
                className="max-w-full max-h-full object-contain rounded-lg mx-auto" 
              />
            </div>
          ) : isPdfDoc(doc) ? (
            <div className="flex-1 overflow-hidden p-6">
              <PdfPreview url={doc.url} title={doc.name} />
            </div>
          ) : isHtmlDoc(doc) ? (
            <div className="flex-1 overflow-auto p-6">
              <HtmlPreview url={doc.url} title={doc.name} />
            </div>
          ) : isDocxDoc(doc) ? (
            <div className="flex-1 overflow-auto p-6">
              <DocxPreview 
                url={doc.url} 
                name={doc.name} 
                allowEdit={allowEdit}
                onSave={handleSaveDocx}
                clientId={clientId}
                folder={folder}
                onPdfCreated={onPdfCreated}
              />
            </div>
          ) : doc.url.includes('data:text') ? (
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 w-full">
                <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">
                  {atob(doc.url.split(',')[1])}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center text-slate-400 flex flex-col items-center gap-4">
                <File size={64} className="text-slate-600" />
                <div>
                  <p className="font-semibold text-white mb-2">{doc.name}</p>
                  <p className="text-sm">Preview not available for this file type</p>
                  <button 
                    onClick={() => downloadDocument(doc.url, doc.name)} 
                    className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-all"
                  >
                    Download File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-700 bg-slate-800 justify-end">
          {isPdfDoc(doc) && onSendEmail && (
            <button 
              onClick={() => onSendEmail({
                name: doc.name,
                url: doc.url,
                id: doc.id || Date.now().toString(),
                date: doc.date || doc.uploadedAt || new Date()
              })} 
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Mail size={16} /> Send Email
            </button>
          )}
          <button 
            onClick={() => downloadDocument(doc.url, doc.name)} 
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
          >
            <Download size={16} /> Download
          </button>
          <button 
            onClick={() => printDocument(doc.url)} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
          >
            <Printer size={16} /> Print
          </button>
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
