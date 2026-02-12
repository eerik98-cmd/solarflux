'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Upload, Trash2, File, X, Download, Printer, Eye, ArrowLeft, ArrowRight, RefreshCw, Edit2, Search } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { DocumentPreview } from './DocumentPreview';

interface CompanyDocument {
  id: string;
  name: string;
  url?: string; // Undefined for folders
  uploadedAt: Date;
  description?: string;
  valability?: string;
  folderPath?: string; // e.g., "" for root, "Projects/2026"
  isFolder?: boolean;
}

interface FileManagerProps {
  documents: CompanyDocument[];
  onAddDocument: (document: CompanyDocument) => void;
  onDeleteDocument: (id: string) => void;
  onUpdateDocument?: (id: string, updates: Partial<CompanyDocument>) => void;
}

export const FileManager: React.FC<FileManagerProps> = ({ documents = [], onAddDocument, onDeleteDocument, onUpdateDocument }) => {
  const [uploadName, setUploadName] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docValability, setDocValability] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [pathHistory, setPathHistory] = useState<string[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [newFolderName, setNewFolderName] = useState('');
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
  const [editDoc, setEditDoc] = useState<CompanyDocument | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editValability, setEditValability] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const currentPathKey = currentPath.join('/');
  
  // If there's a search query, search globally across all documents
  let sortedEntries: CompanyDocument[];
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    const allMatches = documents.filter(item => 
      item.name.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      (item.valability && item.valability.toLowerCase().includes(query))
    );
    const matchedFolders = allMatches.filter(d => d.isFolder);
    const matchedFiles = allMatches.filter(d => !d.isFolder);
    sortedEntries = [
      ...matchedFolders.sort((a, b) => a.name.localeCompare(b.name)),
      ...matchedFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    ];
  } else {
    // No search query - show only items in current path
    const folders = documents.filter(d => d.isFolder && (d.folderPath || '') === currentPathKey);
    const files = documents.filter(d => !d.isFolder && (d.folderPath || '') === currentPathKey);
    sortedEntries = [
      ...folders.sort((a, b) => a.name.localeCompare(b.name)),
      ...files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    ];
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newDoc: CompanyDocument = {
        id: Date.now().toString(),
        name: uploadName.trim() || file.name,
        url,
        uploadedAt: new Date(),
        description: docDescription.trim() || undefined,
        valability: docValability.trim() || undefined,
        folderPath: currentPathKey,
        isFolder: false
      };
      onAddDocument(newDoc);
      setUploadName('');
      setDocDescription('');
      setDocValability('');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: CompanyDocument = {
      id: Date.now().toString(),
      name: newFolderName.trim(),
      uploadedAt: new Date(),
      folderPath: currentPathKey,
      isFolder: true
    };
    onAddDocument(newFolder);
    setNewFolderName('');
  };

  const downloadDocument = (url?: string, filename?: string) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printDocument = (url?: string) => {
    if (!url) return;
    
    // Simple approach: open in new window with print-ready content
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow pop-ups to print documents');
      return;
    }
    
    if (url.includes('data:application/pdf') || url.toLowerCase().endsWith('.pdf')) {
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
    } else if (url.includes('data:image')) {
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
    } else if (url.includes('data:text')) {
      const textContent = atob(url.split(',')[1]);
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Document</title>
            <style>
              body { margin: 20px; font-family: monospace; white-space: pre-wrap; }
            </style>
          </head>
          <body><pre>${textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          <script>setTimeout(() => { window.print(); }, 500);</script>
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

  const navigateToPath = (newPath: string[]) => {
    setCurrentPath(newPath);
    const newHistory = pathHistory.slice(0, historyIndex + 1);
    newHistory.push(newPath);
    setPathHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentPath(pathHistory[historyIndex - 1]);
    }
  };

  const goForward = () => {
    if (historyIndex < pathHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentPath(pathHistory[historyIndex + 1]);
    }
  };

  const refresh = () => {
    setCurrentPath([...currentPath]);
  };

  const handleEditDocument = () => {
    if (!editDoc || !onUpdateDocument) return;
    const updates: Partial<CompanyDocument> = {};
    if (editName.trim() && editName !== editDoc.name) updates.name = editName.trim();
    if (editDescription.trim() !== (editDoc.description || '')) updates.description = editDescription.trim() || undefined;
    if (editValability.trim() !== (editDoc.valability || '')) updates.valability = editValability.trim() || undefined;
    if (Object.keys(updates).length > 0) {
      onUpdateDocument(editDoc.id, updates);
    }
    setEditDoc(null);
    setEditName('');
    setEditDescription('');
    setEditValability('');
  };

  const openEditDialog = (doc: CompanyDocument) => {
    setEditDoc(doc);
    setEditName(doc.name);
    setEditDescription(doc.description || '');
    setEditValability(doc.valability || '');
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FolderOpen size={32} className="text-amber-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">Company Documents</h1>
              <p className="text-xs text-slate-400">Organize files in folders like on your computer.</p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files and folders..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                title="Clear search"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <button onClick={() => navigateToPath([])} className="hover:text-amber-400 font-semibold">Root</button>
            {currentPath.map((segment, idx) => {
              const pathSlice = currentPath.slice(0, idx + 1);
              return (
                <React.Fragment key={pathSlice.join('/') + idx}>
                  <span className="text-slate-600">/</span>
                  <button onClick={() => navigateToPath(pathSlice)} className="hover:text-amber-400">{segment}</button>
                </React.Fragment>
              );
            })}
          </div>
          {currentPath.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                disabled={historyIndex <= 0}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Go Back"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                onClick={goForward}
                disabled={historyIndex >= pathHistory.length - 1}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Go Forward"
              >
                <ArrowRight size={18} />
              </button>
              <button
                onClick={refresh}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              <FolderOpen size={16} /> New Folder
            </h4>
            <div className="space-y-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={handleCreateFolder}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Create Folder
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 lg:col-span-2">
            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Upload size={16} /> Upload Document</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Name (optional)</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Defaults to original file name"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Description (optional)</label>
                <input
                  type="text"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="e.g., Contract Q1"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Valability (optional)</label>
                <input
                  type="text"
                  value={docValability}
                  onChange={(e) => setDocValability(e.target.value)}
                  placeholder="e.g., Valid until 2027"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3 space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase block">Select File</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-amber-400 hover:file:bg-slate-600 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {sortedEntries.length > 0 ? (
              sortedEntries.map(doc => {
                const isFolder = !!doc.isFolder;
                return (
                  <div
                    key={doc.id}
                    className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between group transition-all gap-4"
                    onClick={() => {
                      if (isFolder) navigateToPath([...currentPath, doc.name]);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-600 flex-shrink-0 ${isFolder ? 'text-amber-400' : 'text-blue-400'}`}>
                        {isFolder ? <FolderOpen size={20} /> : <File size={20} />}
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-sm flex items-center gap-2">
                          {doc.name}
                          {isFolder && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">Folder</span>}
                        </h5>
                        {searchQuery.trim() && doc.folderPath && (
                          <p className="text-[11px] text-blue-400 mt-0.5 font-mono">📁 {doc.folderPath}/</p>
                        )}
                        {doc.description && <p className="text-xs text-amber-500 mt-0.5 font-medium">{doc.description}</p>}
                        {doc.valability && <p className="text-[11px] text-emerald-400 mt-0.5">Valability: {doc.valability}</p>}
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {isFolder ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditDialog(doc); }}
                          title="Edit Folder"
                          className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Delete Folder',
                              message: `Are you sure you want to delete the folder "${doc.name}"? This action cannot be undone.`,
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
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewDoc(doc); }}
                          title="Preview"
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditDialog(doc); }}
                          title="Edit"
                          className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadDocument(doc.url, doc.name); }}
                          title="Download"
                          className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); printDocument(doc.url); }}
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
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-500 italic border border-slate-700 border-dashed rounded-xl">No items here. Create a folder or upload a file.</div>
            )}
          </div>
        </div>
      </div>

      {previewDoc && previewDoc.url && (
        <DocumentPreview 
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
          allowEdit={true}
          folder={`company/${currentPath.join('/')}`}
          onSave={async (newUrl) => {
            // Update document URL in company documents
            const updatedDocs = companyDocs.map(doc =>
              doc.id === previewDoc.id ? { ...doc, url: newUrl } : doc
            );
            console.log('Document saved with new URL:', newUrl);
          }}
          onPdfCreated={(pdfDoc) => {
            // Add the PDF as a new company document in the current folder
            const newCompanyDoc: CompanyDocument = {
              id: pdfDoc.id,
              name: pdfDoc.name,
              url: pdfDoc.url,
              uploadedAt: pdfDoc.date,
              description: `PDF from ${previewDoc.name}`,
              folderPath: currentPath.join('/'),
              isFolder: false,
            };
            onAddDocument(newCompanyDoc);
          }}
        />
      )}

      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditDoc(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">Edit {editDoc.isFolder ? 'Folder' : 'Document'}</h3>
              <button onClick={() => setEditDoc(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              {!editDoc.isFolder && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Description</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Enter description (optional)"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Valability</label>
                    <input
                      type="text"
                      value={editValability}
                      onChange={(e) => setEditValability(e.target.value)}
                      placeholder="Enter valability date (optional)"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-700 justify-end">
              <button
                onClick={() => setEditDoc(null)}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEditDocument}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
              >
                <Edit2 size={16} /> Save Changes
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
