'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Printer, File, FileText } from 'lucide-react';
import mammoth from 'mammoth';

interface DocumentPreviewProps {
  document: {
    name: string;
    url: string;
    description?: string;
    uploadedAt?: Date;
    date?: Date;
  };
  onClose: () => void;
}

const isPdfDoc = (doc: { url: string; name: string }) =>
  !!doc.url && (doc.url.startsWith('data:application/pdf') || doc.name?.toLowerCase().endsWith('.pdf'));

const isDocxDoc = (doc: { url: string; name: string }) =>
  !!doc.url && (
    doc.url.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
    doc.name?.toLowerCase().endsWith('.docx')
  );

const PdfPreview: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-auto rounded-lg border border-slate-700 bg-slate-950">
        <iframe
          src={url}
          title={title}
          className="w-full h-full min-h-[600px]"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
};

const DocxPreview: React.FC<{ url: string; name: string }> = ({ url, name }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          const response = await fetch(url);
          arrayBuffer = await response.arrayBuffer();
        }

        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtmlContent(result.value);
        
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
  }, [url]);

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
    <div className="w-full h-full overflow-auto">
      <div 
        className="bg-white rounded-lg p-8 max-w-4xl mx-auto prose prose-slate"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{
          minHeight: '600px',
          color: '#1e293b',
          fontSize: '14px',
          lineHeight: '1.6'
        }}
      />
    </div>
  );
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ document: doc, onClose }) => {
  const downloadDocument = (url: string, filename: string) => {
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
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

        <div className="flex-1 p-6 bg-slate-900 min-h-[500px] flex flex-col">
          {doc.url.includes('data:image') || doc.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <img 
              src={doc.url} 
              alt={doc.name} 
              className="max-w-full max-h-full object-contain rounded-lg mx-auto" 
            />
          ) : isPdfDoc(doc) ? (
            <PdfPreview url={doc.url} title={doc.name} />
          ) : isDocxDoc(doc) ? (
            <DocxPreview url={doc.url} name={doc.name} />
          ) : doc.url.includes('data:text') ? (
            <div className="bg-slate-800 rounded-lg p-6 max-h-full overflow-auto border border-slate-700 w-full">
              <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">
                {atob(doc.url.split(',')[1])}
              </pre>
            </div>
          ) : (
            <div className="text-center text-slate-400 flex flex-col items-center gap-4 justify-center h-full">
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
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-700 bg-slate-800 justify-end">
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
