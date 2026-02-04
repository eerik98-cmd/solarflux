'use client';

import React, { useState } from 'react';
import { FolderOpen, Upload, Eye, Edit2, Download, Printer, Trash2, FileText, X, Save } from 'lucide-react';
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
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [editingDoc, setEditingDoc] = useState<any>(null);

  if (!client) return null;

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
    
    try {
      const newDoc = await FileSystem.saveFile(client, uploadFile, getFolderForDocType(docType), fsType, generatedName);
      newDoc.description = description;
      newDoc.podNumber = facturaPod.trim() || undefined;
      newDoc.cfNumber = cfNumber.trim() || undefined;
      newDoc.cadNumber = cadNumber.trim() || undefined;
      newDoc.docAddress = docAddress.trim() || undefined;
      await updateClient({ documents: [newDoc, ...(client.documents || [])] });
      setUploadFile(null);
      setDocInput('');
      setDocDescription('');
      setFacturaPod('');
      setCfNumber('');
      setCadNumber('');
      setDocAddress('');
      setDocType('CI');
    } catch (error) { 
      console.error(error); 
      alert("Failed to upload document"); 
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!client) return;
    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      await updateClient({ documents: client.documents?.filter(d => d.id !== docId) || [] });
    }
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
                      onClick={() => handleDeleteDocument(doc.id)} 
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
