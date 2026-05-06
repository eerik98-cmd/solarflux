'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, Quote, QuoteLineItem, Client, DocTemplate, User } from '../types';
import { Plus, Trash2, Save, History, RefreshCcw, CheckSquare, Square, Search, ChevronDown, Package, Edit3, FileText, Download, X, Eye, Award, Users, SendHorizonal, Printer } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { DocumentPreview } from './DocumentPreview';

interface QuoteGeneratorProps {
  inventory: InventoryItem[];
  clients: Client[];
  savedQuotes: Quote[];
  onSaveQuote: (quote: Quote) => void;
  onDeleteQuote?: (id: string) => void;
  docTemplates: DocTemplate[];
  companyDocuments?: Array<{ id: string; name: string; url: string; date?: Date; description?: string; quoteId?: string }>;
  onSaveDocument?: (doc: { id: string; name: string; url: string; date: Date; description?: string; quoteId?: string; clientId?: string }) => Promise<void>;
  onDeleteDocument?: (id: string) => Promise<void>;
  onUpdateQuoteDocuments?: (quoteId: string, doc: { id: string; name: string; url: string; date: Date; generatedBy?: string }) => Promise<void>;
  installerUsers?: User[];
}

export const QuoteGenerator: React.FC<QuoteGeneratorProps> = ({ inventory, clients, savedQuotes, onSaveQuote, onDeleteQuote, docTemplates, companyDocuments = [], onSaveDocument, onDeleteDocument, onUpdateQuoteDocuments, installerUsers = [] }) => {
  const [projectTitle, setProjectTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<QuoteLineItem[]>([]);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
  
  // UI State
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [openSerialPickerId, setOpenSerialPickerId] = useState<string | null>(null);
  const [serialSearchTerm, setSerialSearchTerm] = useState('');
  
  // Customer Search State
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  
  // Document Generation State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocuments, setGeneratedDocuments] = useState<Array<{id: string, name: string, blob: Blob, date: Date, quoteId?: string}>>([]);
  const [previewDoc, setPreviewDoc] = useState<{name: string, url: string, description?: string, date?: Date} | null>(null);
  
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

  // Installer Allocation State for quote-won flow
  const [pendingInstallerIds, setPendingInstallerIds] = useState<string[]>([]);
  
  const VAT_RATE = 0.21;

  // Filter clients for autocomplete
  const filteredClients = useMemo(() => {
     if (!customerName) return [];
     return (clients || []).filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5);
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
      ...calculateTotals,
      quoteStatus: 'draft',
    };

    onSaveQuote(newQuote);
    setCurrentQuoteId(newQuote.id);
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
    setCurrentQuoteId(null);
    setPendingInstallerIds([]);
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
    setCurrentQuoteId(quote.id);
    setPendingInstallerIds((quote.assignedInstallers || []).map(i => i.installerId));
    
    // Scroll to top
    const container = document.querySelector('.quote-gen-scroll');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getCurrentQuote = () => savedQuotes.find(q => q.id === currentQuoteId);

  const handleMarkQuoteWon = () => {
    const q = getCurrentQuote();
    if (!q) return;
    onSaveQuote({ ...q, quoteStatus: 'won_unallocated' });
  };

  const handleAllocateInstallers = () => {
    const q = getCurrentQuote();
    if (!q || pendingInstallerIds.length === 0) return;
    const chosen = installerUsers.filter(u => pendingInstallerIds.includes(u.id));
    onSaveQuote({
      ...q,
      quoteStatus: 'won_allocated',
      assignedInstallers: chosen.map(u => ({
        installerId: u.id,
        installerNickname: u.nickname,
        assignedAt: new Date(),
      })),
      allocatedInstallerId: chosen[0]?.nickname || q.allocatedInstallerId,
      allocatedAt: new Date(),
      phase: 'in-progress',
    });
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

  const generateDocument = async () => {
    if (!selectedTemplateId) {
      alert('Please select a template first');
      return;
    }
    if (!customerName.trim()) {
      alert('Please enter a customer name');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setIsGenerating(true);
    try {
      // Dynamic imports
      const [PizZipModule, DocxtemplaterModule, FileSaverModule] = await Promise.all([
        import('pizzip'),
        import('docxtemplater'),
        import('file-saver')
      ]);
      const PizZip = (PizZipModule as any).default || PizZipModule;
      const Docxtemplater = (DocxtemplaterModule as any).default || DocxtemplaterModule;
      const saveAs = (FileSaverModule as any).saveAs || (FileSaverModule as any).default?.saveAs;

      const template = docTemplates?.find(t => t.id === selectedTemplateId);
      if (!template) {
        alert('Template not found');
        setIsGenerating(false);
        return;
      }

      // Convert data URL to blob using fetch (more reliable than atob for large files)
      let blob: Blob;
      try {
        // If it's already a data URL, fetch can handle it directly
        const response = await fetch(template.content);
        blob = await response.blob();
      } catch (e) {
        console.error('Failed to convert template:', e);
        alert('Template file is corrupted. Please re-upload the template.');
        setIsGenerating(false);
        return;
      }

      // Convert blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);

      // Process the template
      const zip = new PizZip(byteArray);
      const doc = new Docxtemplater(zip, { 
        paragraphLoop: true, 
        linebreaks: true,
        nullGetter: () => '' 
      });

      // Get client data if available
      const client = selectedClientId ? clients.find(c => c.id === selectedClientId) : undefined;

      // Prepare filtered equipment table (Inverter, Battery, Solar Panels only)
      const equipmentItems = items
        .map((item, index) => {
          const invItem = inventory.find(i => i.id === item.inventoryItemId);
          if (!invItem) return null;

          // Filter: only inverters, batteries, and solar panels
          const isInverter = invItem.category === 'Inverters';
          const isBattery = invItem.category === 'Batteries';
          const isPanel = invItem.category === 'Solar Panels';

          if (!isInverter && !isBattery && !isPanel) return null;

          // Determine power rating multiplied by quantity
          let putere = '';
          if (isInverter && invItem.inverterPowerKw) {
            const totalKw = invItem.inverterPowerKw * item.quantity;
            putere = `${totalKw} kW`;
          } else if (isBattery && invItem.batteryPowerKwh) {
            const totalKwh = invItem.batteryPowerKwh * item.quantity;
            putere = `${totalKwh} kWh`;
          } else if (isPanel && invItem.powerW) {
            const totalW = invItem.powerW * item.quantity;
            // Convert to kW if >= 1000W
            if (totalW >= 1000) {
              putere = `${(totalW / 1000).toFixed(2)} kW`;
            } else {
              putere = `${totalW} W`;
            }
          }

          return {
            nr_crt: index + 1,
            denumire: item.description || invItem.name,
            cantitate: item.quantity || 0,
            putere: putere
          };
        })
        .filter(item => item !== null);

      const data = {
        customer_name: customerName,
        customer_email: client?.email || '',
        customer_phone: client?.phone || '',
        customer_address: client?.address || '',
        project_title: projectTitle || 'Untitled Quote',
        description: description || '',
        today_date: new Date().toLocaleDateString('ro-RO'),
        subtotal_net: formatCurrency(calculateTotals.subtotalNet),
        vat_total: formatCurrency(calculateTotals.vatTotal),
        total_gross: formatCurrency(calculateTotals.totalGross),
        // Aliases for common placeholder names
        net_price: formatCurrency(calculateTotals.subtotalNet),
        tva: formatCurrency(calculateTotals.vatTotal),
        total_price: formatCurrency(calculateTotals.totalGross),
        items: items.map(item => ({
          description: item.description || '',
          qty: item.quantity || 0,
          unit: item.unit || 'pcs',
          net_price: formatCurrency(item.netPrice || 0),
          total_price: formatCurrency((item.quantity || 0) * (item.netPrice || 0)),
          serials: item.selectedSerialNumbers?.join(', ') || ''
        })),
        equipment: equipmentItems
      };

      doc.render(data);
      
      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const fileName = `Quote - ${projectTitle || customerName} - ${new Date().toLocaleDateString('ro-RO').replace(/\//g, '-')}.docx`;
      
      // Add to generated documents list with quote association
      setGeneratedDocuments(prev => [{
        id: Date.now().toString(),
        name: fileName,
        blob: out,
        date: new Date(),
        quoteId: currentQuoteId || undefined
      }, ...prev]);

      // Convert blob to base64 data URL for preview + persistence
      const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const dataUrl = await toDataUrl(out);

      // Preview with DocumentPreview component
      setPreviewDoc({ name: fileName, url: dataUrl, description: `Generated from Quote for ${customerName}`, date: new Date() });

      // Persist to storage if handler provided
      if (onSaveDocument) {
        const docId = Date.now().toString();
        await onSaveDocument({
          id: docId,
          name: fileName,
          url: dataUrl,
          date: new Date(),
          description: `Quote document for ${customerName}`,
          quoteId: currentQuoteId || undefined,
          clientId: selectedClientId || undefined
        });

        // Also update the quote's generatedDocuments for cross-listing in client quotes page
        if (onUpdateQuoteDocuments && currentQuoteId) {
          await onUpdateQuoteDocuments(currentQuoteId, {
            id: docId,
            name: fileName,
            url: dataUrl,
            date: new Date()
          });
        }
      }

      setIsGenerating(false);
      alert('Document generated and saved successfully!');
      
    } catch (err) {
      console.error('Document generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to generate document: ${errorMessage}`);
      setIsGenerating(false);
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

            {/* ─── Quote Related Documents (only when a quote is loaded) ─── */}
            {currentQuoteId && (() => {
              const loadedQuote = savedQuotes.find(q => q.id === currentQuoteId);
              const quotePersistedDocs = loadedQuote?.generatedDocuments || [];
              const sessionDocs = generatedDocuments.filter(d => d.quoteId === currentQuoteId);
              const companyDocs = companyDocuments.filter((d: any) => d.quoteId === currentQuoteId);
              const persistedIds = new Set([...quotePersistedDocs.map((d: any) => d.id), ...sessionDocs.map(d => d.id)]);
              const uniqueCompanyDocs = companyDocs.filter((cd: any) => !persistedIds.has(cd.id));
              const qs = loadedQuote?.quoteStatus;

              const statusCfgs: Record<string, { label: string; cls: string }> = {
                sent: { label: 'Quote Sent', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
                won_unallocated: { label: 'Quote WON — Not Allocated', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                won_allocated: { label: `Quote WON — ${loadedQuote?.assignedInstallers?.map(i => i.installerNickname).join(', ')}`, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
              };

              return (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText size={20} className="text-blue-400" />
                      Quote Related Documents
                    </h3>
                    {qs && qs !== 'draft' && statusCfgs[qs] && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusCfgs[qs].cls}`}>
                        {statusCfgs[qs].label}
                      </span>
                    )}
                  </div>

                  {/* Template select + generate */}
                  {docTemplates && docTemplates.length > 0 && (
                    <div className="mb-6 pb-6 border-b border-slate-700">
                      <div className="flex items-end gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Generate from Template</label>
                          <select
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                          >
                            <option value="">Select a template...</option>
                            {docTemplates.map(tmpl => (
                              <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={generateDocument}
                          disabled={!selectedTemplateId || isGenerating || items.length === 0}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed font-semibold transition-all flex items-center gap-2 shadow-lg"
                        >
                          {isGenerating ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</>
                          ) : (
                            <><FileText size={18} />Generate</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Combined documents list */}
                  {(sessionDocs.length > 0 || quotePersistedDocs.length > 0 || uniqueCompanyDocs.length > 0) ? (
                    <div className="space-y-2">
                      {/* session (blob) docs */}
                      {sessionDocs.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{doc.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{doc.date.toLocaleString('ro-RO')} • {(doc.blob.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={async () => {
                                const reader = new FileReader();
                                reader.onloadend = () => setPreviewDoc({ name: doc.name, url: reader.result as string, date: doc.date });
                                reader.readAsDataURL(doc.blob);
                              }}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            ><Eye size={14} />Preview</button>
                            <button
                              onClick={async () => {
                                const FileSaverModule = await import('file-saver');
                                const saveAs = (FileSaverModule as any).saveAs || (FileSaverModule as any).default?.saveAs;
                                saveAs(doc.blob, doc.name);
                              }}
                              className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            ><Download size={14} />Download</button>
                            <button
                              onClick={() => { if (confirm(`Delete "${doc.name}"?`)) setGeneratedDocuments(prev => prev.filter(d => d.id !== doc.id)); }}
                              className="p-2 text-red-500 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                            ><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                      {/* persisted firebase docs */}
                      {quotePersistedDocs.filter((doc: any) => !sessionDocs.some(sd => sd.id === doc.id)).map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{doc.name}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {doc.date ? new Date(doc.date).toLocaleString('ro-RO') : ''}{doc.generatedBy && ` • by ${doc.generatedBy}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button onClick={() => setPreviewDoc({ name: doc.name, url: doc.url, date: doc.date })}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            ><Eye size={14} />Preview</button>
                            <a href={doc.url} download={doc.name} target="_blank" rel="noreferrer"
                              className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            ><Download size={14} />Download</a>
                          </div>
                        </div>
                      ))}
                      {/* company docs */}
                      {uniqueCompanyDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{doc.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{doc.date ? new Date(doc.date).toLocaleString('ro-RO') : ''}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button onClick={() => setPreviewDoc({ name: doc.name, url: doc.url, description: doc.description, date: doc.date })}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            ><Eye size={14} />Preview</button>
                            <a href={doc.url} download={doc.name}
                              className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            ><Download size={14} />Download</a>
                            {onDeleteDocument && (
                              <button onClick={() => { if (confirm(`Delete "${doc.name}"?`)) onDeleteDocument(doc.id); }}
                                className="p-2 text-red-500 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                              ><Trash2 size={16} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-500">
                      <FileText size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No documents yet. Select a template above and click Generate.</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ─── Quote Won / Outcome Section (only when a quote is loaded) ─── */}
            {currentQuoteId && (() => {
              const loadedQuote = savedQuotes.find(q => q.id === currentQuoteId);
              const qs = loadedQuote?.quoteStatus;
              const isWon = qs === 'won_unallocated' || qs === 'won_allocated';

              return (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                    <Award size={20} className="text-amber-400" />
                    Quote Outcome
                  </h3>

                  {!isWon ? (
                    <div className="space-y-4">
                      <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                        qs === 'sent' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900/50 border-slate-700'
                      }`}>
                        {qs === 'sent' ? (
                          <><SendHorizonal size={18} className="text-blue-400 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-blue-300">Quote Sent</p>
                            {loadedQuote?.emailSentAt && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                Sent to {loadedQuote.emailSentTo} on {new Date(loadedQuote.emailSentAt).toLocaleDateString('ro-RO')}
                              </p>
                            )}
                          </div></>
                        ) : (
                          <><FileText size={18} className="text-slate-500 shrink-0" />
                          <p className="text-sm text-slate-400">Draft — not yet sent to client</p></>
                        )}
                      </div>
                      <button
                        onClick={handleMarkQuoteWon}
                        className="w-full px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-900 font-extrabold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg text-lg"
                      >
                        <Award size={24} />
                        Quote Won!
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                          <Award size={28} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="text-lg font-extrabold text-emerald-300">Quote WON!</p>
                          {qs === 'won_unallocated' ? (
                            <p className="text-sm text-slate-400 mt-0.5">Not yet allocated to an installer</p>
                          ) : (
                            <p className="text-sm text-slate-400 mt-0.5">
                              Allocated to: <span className="font-bold text-emerald-400">
                                {loadedQuote?.assignedInstallers?.map(i => i.installerNickname).join(', ')}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Users size={14} />
                          {qs === 'won_allocated' ? 'Update Installer Allocation' : 'Allocate to Installer'}
                        </p>
                        {installerUsers.length === 0 ? (
                          <p className="text-sm text-slate-500 italic">No installers found. Add users with INSTALLER role in Settings.</p>
                        ) : (
                          <div className="space-y-2 mb-4">
                            {installerUsers.map(u => {
                              const checked = pendingInstallerIds.includes(u.id);
                              return (
                                <label key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  checked
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500'
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setPendingInstallerIds(prev =>
                                      checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                    )}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                  />
                                  <span className="font-semibold text-sm">{u.nickname}</span>
                                  <span className="text-xs text-slate-500 ml-auto">{u.username}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={handleAllocateInstallers}
                          disabled={pendingInstallerIds.length === 0}
                          className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Users size={18} />
                          {qs === 'won_allocated' ? 'Update Allocation' : 'Confirm Allocation'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
                                    <div className="flex-1">
                                      <h4 className="font-bold text-white truncate pr-2 cursor-pointer" onClick={() => loadQuote(q)}>{q.title || 'Untitled'}</h4>
                                      {q.allocatedInstallerId && (
                                        <div className="text-xs mt-1 flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full w-fit">
                                          👷 {q.allocatedInstallerId}
                                        </div>
                                      )}
                                    </div>
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
                                <div className="flex justify-between items-end mt-3">
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

      {/* Document Preview Modal using DocumentPreview */}
      {previewDoc && (
        <DocumentPreview
          document={{ name: previewDoc.name, url: previewDoc.url, description: previewDoc.description, date: previewDoc.date }}
          onClose={() => setPreviewDoc(null)}
          clientId={selectedClientId}
          folder="quotes"
        />
      )}
    </div>
  );
};
