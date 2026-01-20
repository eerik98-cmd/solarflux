'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, Quote, QuoteLineItem, Client } from '../types';
import { Plus, Trash2, Save, History, RefreshCcw, CheckSquare, Square, Search, ChevronDown, Package, Printer, Edit3 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface QuoteGeneratorProps {
  inventory: InventoryItem[];
  clients: Client[];
  savedQuotes: Quote[];
  onSaveQuote: (quote: Quote) => void;
  onDeleteQuote?: (id: string) => void;
}

export const QuoteGenerator: React.FC<QuoteGeneratorProps> = ({ inventory, clients, savedQuotes, onSaveQuote, onDeleteQuote }) => {
  const [projectTitle, setProjectTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  
  // UI State
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [openSerialPickerId, setOpenSerialPickerId] = useState<string | null>(null);
  const [serialSearchTerm, setSerialSearchTerm] = useState('');
  
  // Customer Search State
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  
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
  
  const VAT_RATE = 0.21;

  // Filter clients for autocomplete
  const filteredClients = useMemo(() => {
     if (!customerName) return [];
     return clients.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5);
  }, [customerName, clients]);

  // Reset serial search when opening a new picker
  useEffect(() => {
    if (openSerialPickerId) {
      setSerialSearchTerm('');
    }
  }, [openSerialPickerId]);

  // Add an empty line item
  const handleAddEmptyRow = () => {
    const newItem: QuoteLineItem = {
      id: Date.now().toString() + Math.random().toString(),
      inventoryItemId: undefined,
      description: '',
      unit: 'pcs',
      quantity: 1,
      netPrice: 0,
      selectedSerialNumbers: []
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof QuoteLineItem, value: string | number | string[]) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleProductSelect = (id: string, product: InventoryItem) => {
    setItems(items.map(item => 
      item.id === id ? {
        ...item,
        inventoryItemId: product.id,
        description: product.name,
        unit: 'pcs',
        netPrice: product.sellPrice,
        selectedSerialNumbers: [] // Reset serials when product changes
      } : item
    ));
    setFocusedRowId(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Toggle specific serial number for a line item
  const toggleSerialNumber = (itemId: string, serial: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item;
      
      const currentSerials = item.selectedSerialNumbers || [];
      const newSerials = currentSerials.includes(serial)
        ? currentSerials.filter(s => s !== serial)
        : [...currentSerials, serial];
      
      return {
        ...item,
        selectedSerialNumbers: newSerials,
        quantity: newSerials.length > 0 ? newSerials.length : item.quantity
      };
    }));
  };

  const calculateTotals = useMemo(() => {
    const subtotalNet = items.reduce((sum, item) => sum + (item.netPrice * item.quantity), 0);
    const vatTotal = subtotalNet * VAT_RATE;
    const totalGross = subtotalNet + vatTotal;
    return { subtotalNet, vatTotal, totalGross };
  }, [items]);

  const handleSave = () => {
    if (!customerName.trim()) {
      alert('Please enter a customer name');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    // Try to match client ID if not explicitly selected but name matches
    let finalClientId = selectedClientId;
    if (!finalClientId) {
      const match = clients.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
      if (match) {
        finalClientId = match.id;
      }
    }

    const newQuote: Quote = {
      id: Date.now().toString(),
      clientId: finalClientId,
      title: projectTitle,
      customerName,
      description,
      date: new Date(),
      items: [...items],
      ...calculateTotals
    };

    onSaveQuote(newQuote);
    setConfirmDialog({
      isOpen: true,
      title: 'Quote Saved',
      message: 'Quote saved successfully! Would you like to start a new one?',
      variant: 'info',
      onConfirm: () => {
        handleClear();
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleClear = () => {
    setProjectTitle('');
    setCustomerName('');
    setSelectedClientId(undefined);
    setDescription('');
    setItems([]);
  };

  const loadQuote = (quote: Quote) => {
    if (items.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Overwrite Current Work',
        message: 'This will overwrite your current work. Do you want to continue?',
        variant: 'warning',
        onConfirm: () => {
          loadQuoteData(quote);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      });
      return;
    }
    loadQuoteData(quote);
  };

  const loadQuoteData = (quote: Quote) => {
    setProjectTitle(quote.title || '');
    setCustomerName(quote.customerName);
    setSelectedClientId(quote.clientId);
    setDescription(quote.description || '');
    setItems(quote.items.map(i => ({...i, selectedSerialNumbers: i.selectedSerialNumbers || []})));
    
    // Scroll to top
    const container = document.querySelector('.quote-gen-scroll');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(val);
  };

  const printQuote = () => {
    const win = window.open('', '_blank');
    if (win) {
        // Construct HTML (similar to ClientRegistry but with generic data)
        const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Offer - ${projectTitle || customerName}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>body { -webkit-print-color-adjust: exact; }</style>
    </head>
    <body class="p-10 bg-white text-slate-900">
      <div class="max-w-4xl mx-auto border border-gray-200 p-8">
        <header class="flex justify-between items-start mb-8">
           <div>
              <h1 class="text-3xl font-bold text-amber-500 mb-2">SolarFlux</h1>
              <p class="text-sm text-gray-500">Professional Solar Installation</p>
           </div>
           <div class="text-right">
              <h2 class="text-2xl font-bold text-slate-800">OFFER</h2>
              <p class="font-bold text-lg mt-1">${projectTitle || 'Untitled'}</p>
              <p class="text-sm text-gray-600">Date: ${new Date().toLocaleDateString()}</p>
           </div>
        </header>

        <div class="mb-8 border-t border-b border-gray-200 py-4">
           <h3 class="font-bold text-gray-700 uppercase text-xs mb-2">Customer</h3>
           <p class="font-bold text-lg">${customerName}</p>
        </div>
        
        ${description ? `<div class="mb-8 p-4 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap">${description}</div>` : ''}

        <table class="w-full text-left mb-8">
          <thead>
            <tr class="border-b-2 border-gray-800 text-sm uppercase">
              <th class="py-2">Description</th>
              <th class="py-2 text-center">Unit</th>
              <th class="py-2 text-center">Qty</th>
              <th class="py-2 text-right">Net Price</th>
              <th class="py-2 text-right">Total Net</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr class="border-b border-gray-100">
                <td class="py-3 text-sm">
                  <div class="font-medium">${item.description}</div>
                  ${item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0 ? `<div class="text-xs text-gray-500 mt-1">SNs: ${item.selectedSerialNumbers.join(', ')}</div>` : ''}
                </td>
                <td class="py-3 text-center text-sm text-gray-600">${item.unit}</td>
                <td class="py-3 text-center text-sm font-bold">${item.quantity}</td>
                <td class="py-3 text-right text-sm">${item.netPrice.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</td>
                <td class="py-3 text-right text-sm font-bold">${(item.quantity * item.netPrice).toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="flex justify-end mb-12">
           <div class="w-64 space-y-2">
              <div class="flex justify-between text-sm">
                 <span class="text-gray-600">Subtotal Net:</span>
                 <span class="font-medium">${calculateTotals.subtotalNet.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</span>
              </div>
              <div class="flex justify-between text-sm">
                 <span class="text-gray-600">VAT (21%):</span>
                 <span class="font-medium">${calculateTotals.vatTotal.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</span>
              </div>
              <div class="flex justify-between text-lg font-bold border-t border-gray-800 pt-2">
                 <span>Total Gross:</span>
                 <span>${calculateTotals.totalGross.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</span>
              </div>
           </div>
        </div>
      </div>
      <script>window.print()</script>
    </body>
    </html>`;
        win.document.write(html);
        win.document.close();
    }
  };

  // Close serial picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openSerialPickerId && !(event.target as Element).closest('.serial-picker-container')) {
        setOpenSerialPickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSerialPickerId]);

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="p-6 border-b border-slate-700 bg-slate-800 flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Quote Generator</h1>
            <p className="text-slate-400">Create, preview, and save sales quotes.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleClear}
              className="px-4 py-2 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors border border-slate-600"
            >
              <RefreshCcw size={16} /> New / Reset
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
            >
              <Save size={18} /> Save Quote
            </button>
          </div>
      </header>

      {/* Main Content Vertical Scroll */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 quote-gen-scroll">
            
            {/* SECTION 1: PROJECT DETAILS */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Edit3 size={16} className="text-amber-500" />
                   Project Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Project Title / Name</label>
                        <input 
                           type="text" 
                           value={projectTitle}
                           onChange={(e) => setProjectTitle(e.target.value)}
                           placeholder="e.g. 5kW Hybrid System - Spring Promo"
                           className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Customer Name</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                value={customerName}
                                onChange={(e) => {
                                    setCustomerName(e.target.value);
                                    setIsCustomerSearchOpen(true);
                                    if (selectedClientId) setSelectedClientId(undefined); // Clear ID if user starts typing
                                }}
                                onFocus={() => setIsCustomerSearchOpen(true)}
                                onBlur={() => setTimeout(() => setIsCustomerSearchOpen(false), 200)}
                                placeholder="Search existing client or type name..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>
                        {isCustomerSearchOpen && filteredClients.length > 0 && (
                             <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
                                {filteredClients.map(client => (
                                    <div 
                                        key={client.id}
                                        onClick={() => {
                                            setCustomerName(client.name);
                                            setSelectedClientId(client.id); // Set Client ID
                                            setIsCustomerSearchOpen(false);
                                        }}
                                        className="p-3 hover:bg-slate-700 cursor-pointer text-sm text-white flex justify-between items-center"
                                    >
                                        <span className="font-bold">{client.name}</span>
                                        <span className="text-xs text-slate-500 uppercase">{client.type}</span>
                                    </div>
                                ))}
                             </div>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Description / Notes</label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter project description, address, or specific notes..."
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* SECTION 2: QUOTE EDITOR */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col min-h-[500px] shadow-lg overflow-hidden">
                  <div className="overflow-visible flex-1 p-6">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-700 text-xs uppercase tracking-wider">
                          <th className="p-3 font-semibold w-12 text-center">#</th>
                          <th className="p-3 font-semibold min-w-[300px]">Description</th>
                          <th className="p-3 font-semibold w-24 text-center">Unit</th>
                          <th className="p-3 font-semibold w-24 text-center">Qty</th>
                          <th className="p-3 font-semibold w-32 text-right">Net Price</th>
                          <th className="p-3 font-semibold w-32 text-right">Net Total</th>
                          <th className="p-3 font-semibold w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-500 italic">
                              No items. Click &quot;Add Line&quot; to start.
                            </td>
                          </tr>
                        ) : (
                          items.map((item, index) => {
                            const lineNet = item.quantity * item.netPrice;
                            
                            // Inventory Logic
                            const inventoryItem = inventory.find(i => i.id === item.inventoryItemId);
                            const hasTrackedSerials = inventoryItem?.serialNumbers && inventoryItem.serialNumbers.length > 0;
                            
                            // Filter logic for suggestions
                            const showSuggestions = focusedRowId === item.id && item.description.trim().length > 0;
                            const suggestions = showSuggestions 
                              ? inventory.filter(p => 
                                  p.name.toLowerCase().includes(item.description.toLowerCase()) || 
                                  p.sku.toLowerCase().includes(item.description.toLowerCase())
                                ).slice(0, 5) 
                              : [];

                            // Available Serials Logic
                            const serialsUsedElsewhere = items
                              .filter(i => i.id !== item.id)
                              .flatMap(i => i.selectedSerialNumbers || []);
                            
                            let availableSerials = inventoryItem?.serialNumbers?.filter(
                              sn => !serialsUsedElsewhere.includes(sn)
                            ) || [];
                            if (serialSearchTerm) {
                              availableSerials = availableSerials.filter(sn => sn.toLowerCase().includes(serialSearchTerm.toLowerCase()));
                            }

                            const selectedCount = item.selectedSerialNumbers?.length || 0;
                            const isSerialPickerOpen = openSerialPickerId === item.id;

                            return (
                              <tr key={item.id} className="hover:bg-slate-700/30 group border-b border-slate-700/50 last:border-0">
                                <td className="p-3 text-center text-slate-500 text-sm align-top pt-4">
                                  {index + 1}
                                </td>
                                <td className="p-3 align-top relative">
                                  <div className="relative">
                                    <textarea 
                                      value={item.description}
                                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                      onFocus={() => setFocusedRowId(item.id)}
                                      onBlur={() => setTimeout(() => setFocusedRowId(null), 200)}
                                      placeholder="Description or search..."
                                      rows={1}
                                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none resize-none overflow-hidden placeholder-slate-600"
                                      onInput={(e) => {
                                        e.currentTarget.style.height = 'auto';
                                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                      }}
                                    />

                                    {/* Autocomplete Dropdown */}
                                    {suggestions.length > 0 && (
                                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden w-full max-w-md">
                                        {suggestions.map(suggestion => (
                                          <div 
                                            key={suggestion.id}
                                            onClick={() => handleProductSelect(item.id, suggestion)}
                                            className="p-2.5 hover:bg-slate-700 cursor-pointer flex justify-between items-center border-b border-slate-700/50 last:border-0"
                                          >
                                            <div>
                                              <div className="text-sm text-white font-medium">{suggestion.name}</div>
                                              <div className="text-xs text-slate-400">{suggestion.sku}</div>
                                            </div>
                                            <div className="text-xs font-bold text-emerald-400">
                                              {formatCurrency(suggestion.sellPrice)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Serial Number Section */}
                                  {hasTrackedSerials && (
                                    <div className="mt-2 relative serial-picker-container">
                                      <div className="flex flex-wrap gap-1 items-center">
                                        <button
                                          onClick={() => setOpenSerialPickerId(isSerialPickerOpen ? null : item.id)}
                                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1 ${
                                            selectedCount > 0 
                                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/50' 
                                              : 'bg-slate-900 text-slate-400 border-slate-600 hover:border-slate-500 hover:text-slate-300'
                                          }`}
                                        >
                                          <Package size={10} />
                                          {selectedCount > 0 ? `${selectedCount} SNs` : 'Select SNs'}
                                          <ChevronDown size={10} />
                                        </button>
                                        {item.selectedSerialNumbers!.map(sn => (
                                            <span key={sn} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                                                {sn}
                                            </span>
                                        ))}
                                      </div>

                                      {isSerialPickerOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 p-2 flex flex-col">
                                            <input 
                                              type="text" 
                                              placeholder="Search..."
                                              value={serialSearchTerm}
                                              onChange={(e) => setSerialSearchTerm(e.target.value)}
                                              className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white mb-2 outline-none"
                                              autoFocus
                                            />
                                            <div className="max-h-32 overflow-y-auto space-y-1">
                                                {availableSerials.map(sn => {
                                                  const isSelected = item.selectedSerialNumbers?.includes(sn);
                                                  return (
                                                    <div 
                                                      key={sn}
                                                      onClick={() => toggleSerialNumber(item.id, sn)}
                                                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${isSelected ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-slate-700 text-slate-300'}`}
                                                    >
                                                      {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                                                      <span className="font-mono">{sn}</span>
                                                    </div>
                                                  )
                                                })}
                                                {availableSerials.length === 0 && <div className="text-center text-[10px] text-slate-500 py-2">No serials found</div>}
                                            </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 align-top">
                                   <input 
                                    type="text" 
                                    value={item.unit}
                                    onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-600 rounded px-1 py-1.5 text-sm text-center text-white focus:ring-1 focus:ring-amber-500 outline-none"
                                  />
                                </td>
                                <td className="p-3 align-top">
                                  <input 
                                    type="number" 
                                    min="1"
                                    readOnly={selectedCount > 0}
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                                    className={`w-full border rounded px-1 py-1.5 text-sm text-center text-white focus:ring-1 focus:ring-amber-500 outline-none ${
                                      selectedCount > 0 
                                        ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                                        : 'bg-slate-900/50 border-slate-600'
                                    }`}
                                  />
                                </td>
                                <td className="p-3 align-top">
                                  <input 
                                    type="number" 
                                    value={item.netPrice}
                                    onChange={(e) => handleUpdateItem(item.id, 'netPrice', Number(e.target.value))}
                                    className="w-full bg-slate-900/50 border border-slate-600 rounded px-1 py-1.5 text-sm text-right text-white focus:ring-1 focus:ring-amber-500 outline-none"
                                  />
                                </td>
                                <td className="p-3 text-right font-medium text-emerald-400 align-top pt-3.5">
                                  {formatCurrency(lineNet)}
                                </td>
                                <td className="p-3 text-center align-top pt-2.5">
                                  <button 
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-slate-800 border-t border-slate-700">
                     <button 
                      onClick={handleAddEmptyRow}
                      className="w-full py-2 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-amber-500 hover:text-amber-500 transition-all font-bold flex justify-center items-center gap-2"
                    >
                      <Plus size={18} /> Add Line
                    </button>
                  </div>

                  {/* Totals Footer */}
                  <div className="bg-slate-900 p-6 border-t border-slate-700 flex justify-end">
                    <div className="w-full max-w-xs space-y-2">
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>Subtotal Net</span>
                        <span className="font-medium text-white">{formatCurrency(calculateTotals.subtotalNet)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>VAT (21%)</span>
                        <span className="font-medium text-white">{formatCurrency(calculateTotals.vatTotal)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t border-slate-700 pt-2 mt-2">
                        <span className="text-amber-500">Total Gross</span>
                        <span className="text-white">{formatCurrency(calculateTotals.totalGross)}</span>
                      </div>
                    </div>
                  </div>
            </div>

            {/* SECTION 3: PREVIEW (Always Visible) */}
            <div className="bg-slate-200 rounded-xl shadow-lg p-8 text-slate-900 min-h-[500px]">
                    <div className="flex justify-between items-start mb-8 border-b border-slate-300 pb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-amber-600">SolarFlux</h2>
                            <p className="text-xs text-slate-500">Professional Solar Installation</p>
                        </div>
                        <div className="text-right">
                             <h1 className="text-xl font-bold text-slate-800">OFFER</h1>
                             <p className="font-bold">{projectTitle || 'Untitled'}</p>
                             <p className="text-xs text-slate-500">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    <div className="mb-8 bg-white p-4 rounded border border-slate-300">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">Customer</div>
                        <div className="font-bold">{customerName || '...'}</div>
                    </div>

                    {description && <div className="mb-8 text-sm text-slate-700 whitespace-pre-wrap px-1">{description}</div>}

                    <table className="w-full text-sm mb-8">
                        <thead>
                            <tr className="border-b-2 border-slate-800">
                                <th className="text-left py-2">Description</th>
                                <th className="text-center py-2">Qty</th>
                                <th className="text-right py-2">Unit Price</th>
                                <th className="text-right py-2">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-8 text-slate-400 italic">No items in quote.</td></tr>
                            )}
                            {items.map(item => (
                                <tr key={item.id} className="border-b border-slate-300">
                                    <td className="py-2">
                                        <div className="font-medium">{item.description}</div>
                                        {item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0 && (
                                            <div className="text-[10px] text-slate-500 italic">{item.selectedSerialNumbers.join(', ')}</div>
                                        )}
                                    </td>
                                    <td className="text-center py-2">{item.quantity} {item.unit}</td>
                                    <td className="text-right py-2">{item.netPrice.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</td>
                                    <td className="text-right py-2 font-bold">{(item.quantity * item.netPrice).toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex justify-end">
                        <div className="w-64 space-y-1 text-right">
                            <div className="flex justify-between text-sm"><span>Subtotal Net:</span> <span>{calculateTotals.subtotalNet.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</span></div>
                            <div className="flex justify-between text-sm"><span>VAT (21%):</span> <span>{calculateTotals.vatTotal.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</span></div>
                            <div className="flex justify-between text-lg font-bold border-t border-slate-800 pt-2 mt-2"><span>Total Gross:</span> <span>{calculateTotals.totalGross.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</span></div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-center">
                        <button onClick={printQuote} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-transform hover:scale-105">
                            <Printer size={16} /> Open Print View
                        </button>
                    </div>
            </div>

            {/* SECTION 4: HISTORY */}
            <div className="border-t border-slate-700 pt-8 pb-12">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <History size={20} className="text-slate-400" />
                    Quote History
                </h3>
                
                {savedQuotes.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border border-slate-700 rounded-xl border-dashed">
                        No saved quotes found.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {savedQuotes.slice().reverse().map(q => (
                            <div key={q.id} className="bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl p-4 transition-all group relative">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-white truncate pr-2 cursor-pointer" onClick={() => loadQuote(q)}>{q.title || 'Untitled'}</h4>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: 'Delete Quote',
                                          message: `Are you sure you want to delete quote "${q.title || 'Untitled'}"? This action cannot be undone.`,
                                          variant: 'danger',
                                          onConfirm: () => {
                                            if (onDeleteQuote) onDeleteQuote(q.id);
                                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                                          }
                                        });
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1 cursor-pointer" onClick={() => loadQuote(q)}>
                                    <span className="font-semibold text-slate-300">{q.customerName}</span>
                                </div>
                                <div className="flex justify-between items-end mt-3 cursor-pointer" onClick={() => loadQuote(q)}>
                                    <span className="text-[10px] text-slate-500">{new Date(q.date).toLocaleDateString()}</span>
                                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(q.totalGross)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
      </div>
      
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
