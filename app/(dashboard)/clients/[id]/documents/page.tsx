'use client';

import React, { useState } from 'react';
import { FolderOpen, Upload, Eye, Edit2, Download, Printer, Trash2, FileText, X, Save, AlertCircle, Check } from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { ClientType } from '@/types';
import { FileSystem, getFolderForDocType } from '@/services/fileSystemService';
import { DocumentPreview } from '@/components/DocumentPreview';

export default function ClientDocumentsPage() {
  const { client, updateClient } = useClient();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('CI');
  const [docInput, setDocInput] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [facturaPod, setFacturaPod] = useState('');
  const [cfNumber, setCfNumber] = useState('');
  const [cadNumber, setCadNumber] = useState('');
  const [docAddress, setDocAddress] = useState('');
  const [selectedProjectKey, setSelectedProjectKey] = useState('none');
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{docId: string; docName: string} | null>(null);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error' | 'info'} | null>(null);

  if (!client) return null;

  const projectOptions = [
    { key: 'none', label: 'General (No project)', projectId: '', projectName: '' }
  ];

  const currentProjectName = client.needs?.projectName?.trim();
  if (currentProjectName) {
    projectOptions.push({
      key: 'current',
      label: `Current Project: ${currentProjectName}`,
      projectId: client.needs?.projectId || '',
      projectName: currentProjectName
    });
  }

  (client.archivedProjects || []).forEach(project => {
    projectOptions.push({
      key: `archived-${project.id}`,
      label: `Archived: ${project.projectName}`,
      projectId: project.id,
      projectName: project.projectName
    });
  });

  const selectedProject = projectOptions.find(option => option.key === selectedProjectKey) || projectOptions[0];

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setUploadFile(e.target.files[0]);
  };

  const handleUploadDocument = async () => {
    if (!client || !uploadFile) return;
    const internalId = client.internalId || 'NO_ID';
    const typeLabel = docType;
    let generatedName = `[${internalId}] ${typeLabel} ${client.name}`;
    let description = docDescription.trim();
    
    // Map docType to valid FileSystem types
    let fsType: 'CI' | 'CF' | 'Fact' | 'Other' = 'Other';
    if (docType === 'CI') fsType = 'CI';
    else if (docType === 'CF') fsType = 'CF';
    else if (docType === 'Factura') {
      fsType = 'Fact';
      if (facturaPod.trim()) description = description ? `${description} - POD: ${facturaPod}` : `POD: ${facturaPod}`;
    } else if (docType === 'CUI') {
      fsType = 'Other';
      generatedName = `[${internalId}] CUI ${client.name}`;
    } else if (docType === 'Other' && docInput.trim()) {
      generatedName = `[${internalId}] ${docInput.trim()} ${client.name}`;
    }

    let projectId = selectedProject.projectId;
    let projectName = selectedProject.projectName;
    if (selectedProject.key === 'current' && currentProjectName && !projectId) {
      const generatedId = client.needs?.projectId || Date.now().toString();
      projectId = generatedId;
      projectName = currentProjectName;
      if (!client.needs?.projectId) {
        await updateClient({ needs: { ...client.needs, projectId: generatedId } });
      }
    }
    
    try {
      const newDoc = await FileSystem.saveFile(client, uploadFile, getFolderForDocType(docType), fsType, generatedName);
      newDoc.description = description;
      newDoc.podNumber = facturaPod.trim() || undefined;
      newDoc.cfNumber = cfNumber.trim() || undefined;
      newDoc.cadNumber = cadNumber.trim() || undefined;
      newDoc.docAddress = docAddress.trim() || undefined;
      newDoc.projectId = projectId || undefined;
      newDoc.projectName = projectName || undefined;
      await updateClient({ documents: [newDoc, ...(client.documents || [])] });
      setUploadFile(null);
      setDocInput('');
      setDocDescription('');
      setFacturaPod('');
      setCfNumber('');
      setCadNumber('');
      setDocAddress('');
      setDocType('CI');
      showNotification('Document uploaded successfully!', 'success');
    } catch (error) { 
      console.error(error); 
      showNotification('Failed to upload document', 'error'); 
    }
  };

  const handleDeleteDocument = (docId: string, docName: string) => {
    if (!client) return;
    setDeleteConfirmation({ docId, docName });
  };

  const openDocument = (url: string) => {
    const win = window.open();
    if (win) win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
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
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      showNotification('Please allow pop-ups to print documents', 'error');
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

  const handleEditDocument = async () => {
    if (!editingDoc || !client) return;
    const updatedDocs = client.documents?.map(d => 
      d.id === editingDoc.id ? editingDoc : d
    ) || [];
    await updateClient({ documents: updatedDocs });
    setEditingDoc(null);
  };

  return (
    <div className="h-full flex flex-col p-8 bg-slate-900 overflow-y-auto">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`rounded-lg border shadow-lg p-4 min-w-[300px] max-w-md ${
            notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
            notification.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' :
            'bg-blue-500/10 border-blue-500/50 text-blue-400'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {notification.type === 'success' && <Check size={20} className="flex-shrink-0" />}
                {notification.type === 'error' && <AlertCircle size={20} className="flex-shrink-0" />}
                {notification.type === 'info' && <AlertCircle size={20} className="flex-shrink-0" />}
                <p className="font-semibold">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-current hover:opacity-70 transition-opacity"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertCircle size={24} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Delete Document</h3>
                  <p className="text-slate-300 text-sm">
                    Are you sure you want to delete <span className="font-bold text-white">"{deleteConfirmation.docName}"</span>?
                  </p>
                  <p className="text-slate-400 text-xs mt-2">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!client) return;
                    await updateClient({ documents: client.documents?.filter(d => d.id !== deleteConfirmation.docId) || [] });
                    setDeleteConfirmation(null);
                    showNotification('Document deleted successfully', 'success');
                  }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-5xl w-full mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderOpen size={20} className="text-amber-500" />
            File Manager
          </h3>
        </div>

        {/* Upload Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Upload size={16} /> Upload Document
          </h4>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-1/4">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Type</label>
                <select 
                  value={docType} 
                  onChange={(e) => setDocType(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {client.type === ClientType.PRIVATE ? (
                    <>
                      <option value="CI">CI</option>
                      <option value="CF">CF</option>
                      <option value="Factura">Factura</option>
                      <option value="Other">Other</option>
                    </>
                  ) : (
                    <>
                      <option value="CI">CI</option>
                      <option value="CUI">CUI</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </div>

              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Project</label>
                <select
                  value={selectedProjectKey}
                  onChange={(e) => setSelectedProjectKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {projectOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {docType === 'Factura' && (
                <div className="w-full md:w-1/3">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">POD Number</label>
                  <input 
                    type="text" 
                    value={facturaPod} 
                    onChange={(e) => setFacturaPod(e.target.value)} 
                    placeholder="POD number" 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                  />
                </div>
              )}

              {docType === 'CF' && (
                <div className="w-full md:w-1/3">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nr CF</label>
                  <input 
                    type="text" 
                    value={cfNumber} 
                    onChange={(e) => setCfNumber(e.target.value)} 
                    placeholder="Nr CF" 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                  />
                </div>
              )}

              {docType === 'CF' && (
                <div className="w-full md:w-1/3">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nr CAD</label>
                  <input 
                    type="text" 
                    value={cadNumber} 
                    onChange={(e) => setCadNumber(e.target.value)} 
                    placeholder="Nr CAD" 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                  />
                </div>
              )}

              {docType === 'Other' && (
                <div className="w-full md:w-1/3">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Name
                  </label>
                  <input 
                    type="text" 
                    value={docInput} 
                    onChange={(e) => setDocInput(e.target.value)} 
                    placeholder="..." 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                  />
                </div>
              )}

              <div className="flex-1 w-full">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Select File</label>
                <input 
                  type="file" 
                  onChange={handleFileSelection} 
                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-amber-400 hover:file:bg-slate-600 transition-all" 
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-end">
              {(docType === 'Factura' || docType === 'CF') && (
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Address</label>
                  <input 
                    type="text" 
                    value={docAddress} 
                    onChange={(e) => setDocAddress(e.target.value)} 
                    placeholder="Address" 
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                  />
                </div>
              )}

              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description (Optional)</label>
                <input 
                  type="text" 
                  value={docDescription} 
                  onChange={(e) => setDocDescription(e.target.value)} 
                  placeholder="Additional notes or description..." 
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                />
              </div>

              <button 
                onClick={handleUploadDocument} 
                disabled={!uploadFile} 
                className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Upload size={18} /> Upload
              </button>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Attached Documents</h4>
          <div className="grid grid-cols-1 gap-3">
            {client.documents && client.documents.length > 0 ? (
              client.documents.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(doc => (
                <div key={doc.id} className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between group transition-all gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-600 text-blue-400 flex-shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{doc.name}</h5>
                      {doc.description && (
                        <p className="text-xs text-amber-500 mt-0.5 font-medium">{doc.description}</p>
                      )}
                      {doc.projectName && (
                        <p className="text-xs text-slate-400 mt-0.5">Project: {doc.projectName}</p>
                      )}
                      {doc.type === 'CF' && (doc.cfNumber || doc.cadNumber || doc.docAddress) && (
                        <p className="text-xs text-amber-500 mt-0.5 font-medium">
                          {doc.cfNumber && `Nr CF: ${doc.cfNumber}`}
                          {doc.cfNumber && doc.cadNumber && ' • '}
                          {doc.cadNumber && `Nr CAD: ${doc.cadNumber}`}
                          {(doc.cfNumber || doc.cadNumber) && doc.docAddress && ' • '}
                          {doc.docAddress && `Address: ${doc.docAddress}`}
                        </p>
                      )}
                      {doc.type === 'Fact' && (doc.podNumber || doc.docAddress) && (
                        <p className="text-xs text-amber-500 mt-0.5 font-medium">
                          {doc.podNumber && `POD: ${doc.podNumber}`}
                          {doc.podNumber && doc.docAddress && ' • '}
                          {doc.docAddress && `Address: ${doc.docAddress}`}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(doc.date).toLocaleDateString()} • {doc.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setPreviewDoc(doc)} 
                      title="Preview" 
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setEditingDoc({...doc})} 
                      title="Edit" 
                      className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => downloadDocument(doc.url, doc.name)} 
                      title="Download" 
                      className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg"
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => printDocument(doc.url)} 
                      title="Print" 
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                    >
                      <Printer size={16} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteDocument(doc.id, doc.name)} 
                      title="Delete" 
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 italic border border-slate-700 border-dashed rounded-xl">
                No files.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && previewDoc.url && (
        <DocumentPreview 
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
          allowEdit={true}
          clientId={client.id}
          folder="documents"
          onSave={async (newUrl) => {
            // Update document URL in client documents
            const updatedDocuments = client.documents?.map(doc =>
              doc.id === previewDoc.id ? { ...doc, url: newUrl } : doc
            );
            // You would call updateClient here with updated documents
            console.log('Document saved with new URL:', newUrl);
          }}
          onPdfCreated={(pdfDoc) => {
            // Add the PDF to client documents
            const newDocument = {
              ...pdfDoc,
              type: previewDoc.type || 'PDF',
              description: `PDF from ${previewDoc.name}`,
              projectId: previewDoc.projectId,
              projectName: previewDoc.projectName,
            };
            const updatedDocuments = [...(client.documents || []), newDocument];
            updateClient({ ...client, documents: updatedDocuments });
            showNotification(`PDF created: ${pdfDoc.name}`, 'success');
          }}
        />
      )}

      {/* Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-white font-bold">Edit Document</h3>
              <button 
                onClick={() => setEditingDoc(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Name</label>
                <input 
                  type="text"
                  value={editingDoc.name}
                  onChange={(e) => setEditingDoc({...editingDoc, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                <input 
                  type="text"
                  value={editingDoc.description || ''}
                  onChange={(e) => setEditingDoc({...editingDoc, description: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingDoc(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEditDocument}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
