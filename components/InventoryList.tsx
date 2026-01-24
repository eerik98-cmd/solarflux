'use client';

import React, { useState } from 'react';
import { InventoryItem, Category, User } from '../types';
import { Search, Plus, Filter, AlertCircle, Edit2, Trash2, ScanBarcode, FileText, CheckCircle2, ShieldCheck, Hash, X, Zap } from 'lucide-react';
import { DocumentPreview } from './DocumentPreview';

interface InventoryListProps {
  inventory: InventoryItem[];
  currentUser?: User;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
}

export const InventoryList: React.FC<InventoryListProps> = ({ 
  inventory, onAddItem, onEditItem, onDeleteItem 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [viewingSerials, setViewingSerials] = useState<InventoryItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; description?: string; uploadedAt?: Date } | null>(null);

  const filteredItems = (inventory || []).filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.barcode.includes(searchTerm);
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(val);
  };

  const openDocument = (name: string, url: string) => {
    setPreviewDoc({
      name,
      url,
      description: 'Inventory Document',
      uploadedAt: new Date()
    });
  };

  return (
    <div className="p-8 h-full flex flex-col relative">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-white mb-2">Inventory</h1>
           <p className="text-slate-400">Manage your solar components and equipment.</p>
        </div>
        <button 
          onClick={onAddItem}
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus size={20} />
          Add Item
        </button>
      </header>

      {/* Controls */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, SKU, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as Category | 'All')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none appearance-none"
          >
            <option value="All">All Categories</option>
            {Object.values(Category).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-700 text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">Item & Details</th>
                <th className="p-4 font-semibold">Category</th>
                <th className="p-4 font-semibold">Location</th>
                <th className="p-4 font-semibold text-right">Stock</th>
                <th className="p-4 font-semibold text-right">Buy / Sell (RON)</th>
                <th className="p-4 font-semibold text-center">Docs</th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => {
                  const isLowStock = item.quantity <= item.minThreshold;
                  const hasSerials = item.serialNumbers && item.serialNumbers.length > 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-700/30 transition-colors group">
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            {item.name}
                            {item.powerW && item.powerW > 0 && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold border border-amber-500/30 flex items-center gap-0.5">
                                <Zap size={8} /> {item.powerW}W
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                             <span className="bg-slate-700 px-1.5 rounded">{item.sku}</span>
                             {item.barcode && (
                               <span className="flex items-center gap-1 text-slate-600"><ScanBarcode size={10} /> {item.barcode}</span>
                             )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-sm">{item.location}</td>
                      <td className="p-4 text-right">
                         <div className="font-medium text-white">{item.quantity}</div>
                         {hasSerials && (
                           <button 
                            onClick={() => setViewingSerials(item)}
                            className="text-[10px] text-amber-500 hover:underline flex items-center gap-1 justify-end ml-auto"
                           >
                             <Hash size={10} /> View SNs
                           </button>
                         )}
                      </td>
                      <td className="p-4 text-right">
                         <div className="text-slate-300 text-sm">{formatCurrency(item.buyPrice)}</div>
                         <div className="text-emerald-400 text-xs font-medium">{formatCurrency(item.sellPrice)}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          {item.documents?.dataSheet ? (
                            <button 
                              onClick={() => openDocument(item.documents?.dataSheetName || 'Data Sheet', item.documents?.dataSheet || '')}
                              title={`View Data Sheet (${item.documents.dataSheetName})`}
                              className="text-amber-500 hover:text-amber-400 transition-colors"
                            >
                              <FileText size={18} />
                            </button>
                          ) : (
                            <FileText size={18} className="text-slate-600" />
                          )}
                           {item.documents?.certificate ? (
                            <button 
                              onClick={() => openDocument(item.documents?.certificateName || 'Certificate', item.documents?.certificate || '')}
                              title={`View Certificate (${item.documents.certificateName})`}
                              className="text-blue-500 hover:text-blue-400 transition-colors"
                            >
                              <ShieldCheck size={18} />
                            </button>
                          ) : (
                            <ShieldCheck size={18} className="text-slate-600" />
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {isLowStock ? (
                          <div className="inline-flex items-center gap-1 text-red-400 text-xs font-bold bg-red-400/10 px-2 py-1 rounded">
                            <AlertCircle size={12} /> Low Stock
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded">
                            <CheckCircle2 size={12} /> In Stock
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => onEditItem(item)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => onDeleteItem(item.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No items found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreview 
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Serial Number Viewer Modal */}
      {viewingSerials && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-md w-full flex flex-col max-h-[80%]">
             <div className="flex justify-between items-center p-4 border-b border-slate-700">
                <div>
                   <h3 className="font-bold text-white">{viewingSerials.name}</h3>
                   <p className="text-xs text-slate-400">Recorded Serial Numbers</p>
                </div>
                <button onClick={() => setViewingSerials(null)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
             </div>
             <div className="p-4 overflow-y-auto">
               {viewingSerials.serialNumbers && viewingSerials.serialNumbers.length > 0 ? (
                 <ul className="space-y-2">
                   {viewingSerials.serialNumbers.map((sn, idx) => (
                     <li key={idx} className="bg-slate-900 px-3 py-2 rounded text-sm text-slate-300 font-mono border border-slate-700 flex items-center gap-2">
                       <Hash size={12} className="text-slate-500" />
                       {sn}
                     </li>
                   ))}
                 </ul>
               ) : (
                 <div className="text-center text-slate-500 py-4">No serial numbers recorded.</div>
               )}
             </div>
             <div className="p-4 border-t border-slate-700 bg-slate-900/50 rounded-b-xl">
               <button 
                onClick={() => setViewingSerials(null)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium"
               >
                 Close
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
