'use client';

import React, { useState, useMemo } from 'react';
import { FileText, RefreshCcw, Save, Zap, Package, Info, Plus, Trash2, History, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { useData } from '@/contexts/DataContext';
import { Quote, QuoteLineItem, Category } from '@/types';

export default function ClientQuotesPage() {
  const { client } = useClient();
  const { inventory, savedQuotes, saveQuote, deleteQuote } = useData();
  
  const [quoteProjectName, setQuoteProjectName] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [openSerialPickerId, setOpenSerialPickerId] = useState<string | null>(null);
  const [selectedProjectForQuote, setSelectedProjectForQuote] = useState<string>('');

  if (!client) return null;

  const clientQuotes = savedQuotes.filter(q => q.clientId === client.id);

  const quoteTotals = useMemo(() => {
    const subtotalNet = quoteItems.reduce((acc, item) => acc + (item.quantity * item.netPrice), 0);
    const vatTotal = subtotalNet * 0.21;
    const totalGross = subtotalNet + vatTotal;
    return { subtotalNet, vatTotal, totalGross };
  }, [quoteItems]);

  const handleNewQuoteClick = () => { 
    setQuoteItems([]); 
    setQuoteProjectName(''); 
    setEditingQuoteId(null);
    setSelectedProjectForQuote('');
  };

  const handleLoadQuote = (quote: Quote) => {
    setQuoteProjectName(quote.title || '');
    setQuoteItems(quote.items.map(i => ({...i, selectedSerialNumbers: i.selectedSerialNumbers || []})));
    setEditingQuoteId(quote.id);
  };

  const saveClientQuote = () => {
    if (quoteItems.length === 0 || !quoteProjectName.trim()) { 
      alert("Please ensure project name is set and items are added."); 
      return; 
    }
    let targetId = editingQuoteId;
    if (!targetId) {
      const existingByName = savedQuotes.find(q => q.clientId === client.id && q.title === quoteProjectName.trim());
      targetId = existingByName ? existingByName.id : Date.now().toString();
    }
    const newQuote: Quote = { 
      id: targetId, 
      clientId: client.id, 
      title: quoteProjectName.trim(), 
      customerName: client.name, 
      date: new Date(), 
      items: [...quoteItems], 
      ...quoteTotals 
    };
    saveQuote(newQuote);
    setEditingQuoteId(targetId);
    alert('Quote saved successfully.');
  };

  const handleAddQuoteLine = () => {
    const newItem: QuoteLineItem = { 
      id: Date.now().toString() + Math.random().toString(), 
      description: '', 
      unit: 'pcs', 
      quantity: 1, 
      netPrice: 0 
    };
    setQuoteItems([...quoteItems, newItem]);
  };

  const updateQuoteLine = (id: string, field: keyof QuoteLineItem, value: string | number | string[]) => {
    setQuoteItems(quoteItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeQuoteLine = (id: string) => setQuoteItems(quoteItems.filter(item => item.id !== id));

  const addMountingStructuresToQuote = () => {
    if (!client?.needs?.panelCount) {
      alert('Panel count not configured in Client Needs');
      return;
    }

    const totalPanels = client.needs.panelCount;
    const roofType = client.needs.roofType;
    
    // Simple calculation - assuming 1 row for basic implementation
    const numRows = 1;
    const endClamps = numRows * 4;
    const midClamps = (totalPanels - 1) * 2;
    
    const selectedPanel = client.needs.panelStockItemId 
      ? inventory.find(i => i.id === client.needs.panelStockItemId) 
      : null;
    const panelWidth = selectedPanel?.panelWidth || 1.134;
    const railLengthPerRow = totalPanels * panelWidth;
    const railLengthWithWaste = railLengthPerRow * 1.1;
    const sectionsPerRail = Math.ceil(railLengthWithWaste / 6);
    const railsOf6m = sectionsPerRail * 2;
    const totalCombiners = (sectionsPerRail > 1 ? sectionsPerRail - 1 : 0) * 2;
    
    let attachmentType = 'Roof Attachments (Hooks/Bolts)';
    let attachmentsPerPanel = 4;
    
    if (roofType === 'Tigla ceramica' || roofType === 'Tigla metalica') {
      attachmentType = 'Tile Hooks';
      attachmentsPerPanel = 5;
    } else if (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata') {
      attachmentType = 'Hanger Bolts';
      attachmentsPerPanel = 4;
    }
    
    const totalAttachments = totalPanels * attachmentsPerPanel;

    const findMountingItem = (name: string) => {
      return inventory.find(i => 
        i.category === Category.MOUNTING && 
        i.name.toLowerCase().includes(name.toLowerCase())
      );
    };

    const mountingItems: QuoteLineItem[] = [];
    const timestamp = Date.now();

    const endClampItem = findMountingItem('end clamp');
    mountingItems.push({
      id: `${timestamp}-end-clamps`,
      inventoryItemId: endClampItem?.id,
      description: endClampItem ? `${endClampItem.name} (End Clamps)` : 'End Clamps',
      unit: 'pcs',
      quantity: endClamps,
      netPrice: endClampItem?.sellPrice || 0
    });

    const midClampItem = findMountingItem('mid clamp');
    mountingItems.push({
      id: `${timestamp}-mid-clamps`,
      inventoryItemId: midClampItem?.id,
      description: midClampItem ? `${midClampItem.name} (Mid Clamps)` : 'Mid Clamps',
      unit: 'pcs',
      quantity: midClamps,
      netPrice: midClampItem?.sellPrice || 0
    });

    const railItem = findMountingItem('rail');
    mountingItems.push({
      id: `${timestamp}-rails`,
      inventoryItemId: railItem?.id,
      description: railItem ? `${railItem.name} (6m Rails)` : 'Mounting Rails (6m)',
      unit: 'pcs',
      quantity: railsOf6m,
      netPrice: railItem?.sellPrice || 0
    });

    if (totalCombiners > 0) {
      const combinerItem = findMountingItem('combiner') || findMountingItem('connector');
      mountingItems.push({
        id: `${timestamp}-combiners`,
        inventoryItemId: combinerItem?.id,
        description: combinerItem ? `${combinerItem.name} (Rail Combiners)` : 'Rail Combiners/Connectors',
        unit: 'pcs',
        quantity: totalCombiners,
        netPrice: combinerItem?.sellPrice || 0
      });
    }

    const attachmentItem = findMountingItem(attachmentType);
    mountingItems.push({
      id: `${timestamp}-attachments`,
      inventoryItemId: attachmentItem?.id,
      description: attachmentItem ? `${attachmentItem.name}` : attachmentType,
      unit: 'pcs',
      quantity: totalAttachments,
      netPrice: attachmentItem?.sellPrice || 0
    });

    setQuoteItems([...quoteItems, ...mountingItems]);
    
    const missingPrices = mountingItems.filter(i => i.netPrice === 0).length;
    if (missingPrices > 0) {
      alert(`Mounting structures added! Note: ${missingPrices} item(s) have no price set.`);
    } else {
      alert('Mounting structures added successfully!');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Quote Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText size={20} className="text-amber-500" />Project Quote
            </h3>
            <div className="flex gap-2">
              <button onClick={handleNewQuoteClick} className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors">
                <RefreshCcw size={16} /> Reset
              </button>
              <button onClick={saveClientQuote} className="px-6 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/10">
                <Save size={18} /> Save
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Quote Name</label>
              <input 
                type="text" 
                placeholder="Enter quote name..." 
                value={quoteProjectName} 
                onChange={(e) => setQuoteProjectName(e.target.value)} 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-lg text-white focus:ring-2 focus:ring-amber-500 outline-none" 
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Select from Saved Project</label>
              <select
                value={selectedProjectForQuote}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedProjectForQuote(value);
                  if (value === 'current') {
                    setQuoteProjectName(client?.needs?.projectName || '');
                  } else if (value.startsWith('archived-')) {
                    const idx = parseInt(value.replace('archived-', ''));
                    const project = client?.archivedProjects?.[idx];
                    if (project) {
                      setQuoteProjectName(project.projectName || `Project ${idx + 1}`);
                    }
                  }
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="">-- None (Manual Quote) --</option>
                {client?.archivedProjects?.map((project, idx) => (
                  <option key={idx} value={`archived-${idx}`}>
                    {project.projectName || `Archived Project ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Project Summary */}
        {selectedProjectForQuote && (() => {
          const idx = parseInt(selectedProjectForQuote.replace('archived-', ''));
          const projectData = client?.archivedProjects?.[idx]?.data;
          
          if (!projectData) return null;
          
          return (
            <div className="bg-gradient-to-br from-amber-500/10 via-slate-800 to-slate-800 border border-amber-500/30 rounded-xl p-6">
              <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                <Info size={16} /> Project Summary
              </h4>
              <p className="text-white leading-relaxed">
                The client needs a system for <span className="font-bold text-amber-400">{projectData.connectionType || 'not specified'}</span> connection
                {projectData.inverterKw && `, ${projectData.inverterKw}kW inverter`}
                {projectData.batteryKwh && `, ${projectData.batteryKwh}kWh storage`}
                {projectData.panelKw && `, ${projectData.panelKw}kW solar panels`}. 
                Roof type: <span className="font-bold text-amber-400">{projectData.roofType || 'not specified'}</span>.
              </p>
            </div>
          );
        })()}

        {/* Selected Components */}
        {selectedProjectForQuote && (() => {
          const idx = parseInt(selectedProjectForQuote.replace('archived-', ''));
          const projectData = client?.archivedProjects?.[idx]?.data;
          
          if (!projectData) return null;

          return (
            <div className="space-y-6">
              {/* Inverter */}
              {projectData.selectedInverterId && (() => {
                const selectedInv = inventory.find(i => i.id === projectData.selectedInverterId && i.category === Category.INVERTERS);
                if (!selectedInv) return null;
                
                return (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <Zap size={16} className="text-amber-500" />Selected Inverter
                    </h4>
                    <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/50">
                      <div className="flex-1">
                        <p className="text-white font-bold">{selectedInv.name}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {selectedInv.inverterPowerKw}kW • {selectedInv.inverterConnectionType} • {selectedInv.quantity} in stock
                        </p>
                        <p className="text-sm text-emerald-400 font-bold mt-2">{selectedInv.sellPrice} RON</p>
                      </div>
                      <button
                        onClick={() => {
                          const newLine: QuoteLineItem = {
                            id: Date.now().toString(),
                            inventoryItemId: selectedInv.id,
                            description: `${selectedInv.name} (${selectedInv.inverterPowerKw}kW)`,
                            unit: 'piece',
                            quantity: 1,
                            netPrice: selectedInv.sellPrice,
                            selectedSerialNumbers: []
                          };
                          setQuoteItems([...quoteItems, newLine]);
                        }}
                        className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
                      >
                        Add to Quote
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Battery */}
              {projectData.selectedBatteryId && (() => {
                const selectedBat = inventory.find(i => i.id === projectData.selectedBatteryId && i.category === Category.BATTERIES);
                if (!selectedBat) return null;
                
                return (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <Package size={16} className="text-amber-500" />Selected Battery
                    </h4>
                    <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/50">
                      <div className="flex-1">
                        <p className="text-white font-bold">{selectedBat.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{selectedBat.batteryPowerKwh}kWh • {selectedBat.quantity} in stock</p>
                        <p className="text-sm text-emerald-400 font-bold mt-2">{selectedBat.sellPrice} RON</p>
                      </div>
                      <button
                        onClick={() => {
                          const newLine: QuoteLineItem = {
                            id: Date.now().toString(),
                            inventoryItemId: selectedBat.id,
                            description: `${selectedBat.name} (${selectedBat.batteryPowerKwh}kWh)`,
                            unit: 'piece',
                            quantity: 1,
                            netPrice: selectedBat.sellPrice,
                            selectedSerialNumbers: []
                          };
                          setQuoteItems([...quoteItems, newLine]);
                        }}
                        className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
                      >
                        Add to Quote
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Panels */}
              {projectData.panelStockItemId && projectData.panelCount && (() => {
                const selectedPanel = inventory.find(i => i.id === projectData.panelStockItemId && i.category === Category.PANELS);
                if (!selectedPanel) return null;
                
                return (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <Package size={16} className="text-amber-500" />Selected Panels
                    </h4>
                    <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/50">
                      <div className="flex-1">
                        <p className="text-white font-bold">{selectedPanel.name}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {selectedPanel.powerW}W • {projectData.panelCount} pieces • {selectedPanel.quantity} in stock
                        </p>
                        <p className="text-sm text-emerald-400 font-bold mt-2">{selectedPanel.sellPrice} RON/piece</p>
                      </div>
                      <button
                        onClick={() => {
                          const newLine: QuoteLineItem = {
                            id: Date.now().toString(),
                            inventoryItemId: selectedPanel.id,
                            description: `${selectedPanel.name} (${selectedPanel.powerW}W)`,
                            unit: 'piece',
                            quantity: projectData.panelCount!,
                            netPrice: selectedPanel.sellPrice,
                            selectedSerialNumbers: []
                          };
                          setQuoteItems([...quoteItems, newLine]);
                        }}
                        className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
                      >
                        Add to Quote
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Mounting Structure */}
              {projectData.panelCount && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                      <Package size={16} className="text-amber-500" />Mounting Structure
                    </h4>
                    <button
                      onClick={() => {
                        const totalPanels = projectData.panelCount!;
                        const roofType = projectData.roofType;
                        
                        const numRows = 1;
                        const endClamps = numRows * 4;
                        const midClamps = (totalPanels - 1) * 2;
                        
                        const selectedPanel = projectData.panelStockItemId 
                          ? inventory.find(i => i.id === projectData.panelStockItemId) 
                          : null;
                        const panelWidth = selectedPanel?.panelWidth || 1.134;
                        const railLengthPerRow = totalPanels * panelWidth;
                        const railLengthWithWaste = railLengthPerRow * 1.1;
                        const sectionsPerRail = Math.ceil(railLengthWithWaste / 6);
                        const railsOf6m = sectionsPerRail * 2;
                        const totalCombiners = (sectionsPerRail > 1 ? sectionsPerRail - 1 : 0) * 2;
                        
                        let attachmentType = 'Roof Attachments (Hooks/Bolts)';
                        let attachmentsPerPanel = 4;
                        
                        if (roofType === 'Tigla ceramica' || roofType === 'Tigla metalica') {
                          attachmentType = 'Tile Hooks';
                          attachmentsPerPanel = 5;
                        } else if (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata') {
                          attachmentType = 'Hanger Bolts';
                          attachmentsPerPanel = 4;
                        }
                        
                        const totalAttachments = totalPanels * attachmentsPerPanel;

                        const findMountingItem = (name: string) => {
                          return inventory.find(i => 
                            i.category === Category.MOUNTING && 
                            i.name.toLowerCase().includes(name.toLowerCase())
                          );
                        };

                        const mountingItems: QuoteLineItem[] = [];
                        const timestamp = Date.now();

                        const endClampItem = findMountingItem('end clamp');
                        mountingItems.push({
                          id: `${timestamp}-end-clamps`,
                          inventoryItemId: endClampItem?.id,
                          description: endClampItem ? `${endClampItem.name} (End Clamps)` : 'End Clamps',
                          unit: 'pcs',
                          quantity: endClamps,
                          netPrice: endClampItem?.sellPrice || 0
                        });

                        const midClampItem = findMountingItem('mid clamp');
                        mountingItems.push({
                          id: `${timestamp}-mid-clamps`,
                          inventoryItemId: midClampItem?.id,
                          description: midClampItem ? `${midClampItem.name} (Mid Clamps)` : 'Mid Clamps',
                          unit: 'pcs',
                          quantity: midClamps,
                          netPrice: midClampItem?.sellPrice || 0
                        });

                        const railItem = findMountingItem('rail');
                        mountingItems.push({
                          id: `${timestamp}-rails`,
                          inventoryItemId: railItem?.id,
                          description: railItem ? `${railItem.name} (6m Rails)` : 'Mounting Rails (6m)',
                          unit: 'pcs',
                          quantity: railsOf6m,
                          netPrice: railItem?.sellPrice || 0
                        });

                        if (totalCombiners > 0) {
                          const combinerItem = findMountingItem('combiner') || findMountingItem('connector');
                          mountingItems.push({
                            id: `${timestamp}-combiners`,
                            inventoryItemId: combinerItem?.id,
                            description: combinerItem ? `${combinerItem.name} (Rail Combiners)` : 'Rail Combiners/Connectors',
                            unit: 'pcs',
                            quantity: totalCombiners,
                            netPrice: combinerItem?.sellPrice || 0
                          });
                        }

                        const attachmentItem = findMountingItem(attachmentType);
                        mountingItems.push({
                          id: `${timestamp}-attachments`,
                          inventoryItemId: attachmentItem?.id,
                          description: attachmentItem ? `${attachmentItem.name}` : attachmentType,
                          unit: 'pcs',
                          quantity: totalAttachments,
                          netPrice: attachmentItem?.sellPrice || 0
                        });

                        setQuoteItems([...quoteItems, ...mountingItems]);
                        
                        const missingPrices = mountingItems.filter(i => i.netPrice === 0).length;
                        if (missingPrices > 0) {
                          alert(`Mounting structures added! Note: ${missingPrices} item(s) have no price set.`);
                        } else {
                          alert('Mounting structures added successfully!');
                        }
                      }}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} /> Add All to Quote
                    </button>
                  </div>
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-300">
                      Mounting structures calculated for <span className="font-bold">{projectData.panelCount} panels</span>.
                      Click "Add All to Quote" to include all components.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Quote Items Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
          <div className="overflow-x-auto p-6 flex-1">
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
                {quoteItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500 italic">
                      No items. Click &quot;Add Line&quot; to start.
                    </td>
                  </tr>
                ) : (
                  quoteItems.map((item, idx) => {
                    const lineNet = item.quantity * item.netPrice;
                    const inventoryItem = inventory.find(i => i.id === item.inventoryItemId);
                    const hasTrackedSerials = inventoryItem?.serialNumbers && inventoryItem.serialNumbers.length > 0;
                    const isSerialPickerOpen = openSerialPickerId === `serial-${item.id}`;
                    const selectedCount = item.selectedSerialNumbers?.length || 0;
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-700/30 border-b border-slate-700/50 last:border-0">
                        <td className="p-3 text-center text-slate-500 text-sm align-top pt-4">{idx + 1}</td>
                        <td className="p-3 align-top">
                          <textarea 
                            value={item.description}
                            onChange={(e) => updateQuoteLine(item.id, 'description', e.target.value)}
                            placeholder="Description..."
                            rows={1}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                          />
                          {hasTrackedSerials && (
                            <div className="mt-2 relative">
                              <button
                                onClick={() => setOpenSerialPickerId(isSerialPickerOpen ? null : `serial-${item.id}`)}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                                  selectedCount > 0 
                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/50' 
                                    : 'bg-slate-900 text-slate-400 border border-slate-600'
                                }`}
                              >
                                <Package size={10} />
                                {selectedCount > 0 ? `${selectedCount} SNs` : 'Select SNs'}
                                <ChevronDown size={10} />
                              </button>
                              {isSerialPickerOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 p-2">
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {inventoryItem?.serialNumbers?.map(sn => {
                                      const isSelected = (item.selectedSerialNumbers || []).includes(sn);
                                      return (
                                        <div 
                                          key={sn}
                                          onClick={() => {
                                            const currentSerials = item.selectedSerialNumbers || [];
                                            const newSerials = currentSerials.includes(sn)
                                              ? currentSerials.filter(s => s !== sn)
                                              : [...currentSerials, sn];
                                            updateQuoteLine(item.id, 'selectedSerialNumbers', newSerials);
                                            if (newSerials.length > 0) {
                                              updateQuoteLine(item.id, 'quantity', newSerials.length);
                                            }
                                          }}
                                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${
                                            isSelected ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-slate-700 text-slate-300'
                                          }`}
                                        >
                                          {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                                          <span className="font-mono">{sn}</span>
                                        </div>
                                      );
                                    })}
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
                            onChange={(e) => updateQuoteLine(item.id, 'unit', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-center text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={(e) => updateQuoteLine(item.id, 'quantity', Number(e.target.value))} 
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-center text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none" 
                          />
                        </td>
                        <td className="p-3 align-top">
                          <input 
                            type="number" 
                            value={item.netPrice} 
                            onChange={(e) => updateQuoteLine(item.id, 'netPrice', Number(e.target.value))} 
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-right text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none" 
                          />
                        </td>
                        <td className="p-3 align-top text-right text-sm font-bold text-emerald-400">
                          {lineNet.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}
                        </td>
                        <td className="p-3 align-top text-center">
                          <button 
                            onClick={() => removeQuoteLine(item.id)} 
                            className="text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14}/>
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
            <button onClick={handleAddQuoteLine} className="w-full py-3 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-amber-500 hover:text-amber-300 font-bold flex justify-center items-center gap-2 transition-colors">
              <Plus size={18} /> Add Line
            </button>
          </div>
          <div className="bg-slate-900 p-6 border-t border-slate-700">
            <div className="flex justify-end">
              <div className="w-80 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal (Net):</span>
                  <span className="text-white font-bold">{quoteTotals.subtotalNet.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">VAT (21%):</span>
                  <span className="text-white font-bold">{quoteTotals.vatTotal.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-700 pt-2 mt-2">
                  <span className="text-amber-500">Total Gross:</span>
                  <span className="text-white">{quoteTotals.totalGross.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote History */}
        <div className="border-t border-slate-700 pt-8">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <History size={20} className="text-slate-400" />History
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientQuotes.slice().reverse().map(q => (
              <div key={q.id} className="bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl p-4 transition-all relative group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-white truncate pr-6">{q.title}</h4>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm(`Delete quote "${q.title}"?`)) {
                        deleteQuote(q.id);
                      }
                    }} 
                    className="text-slate-600 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-emerald-400 font-bold">{q.totalGross.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</span>
                  <button 
                    type="button"
                    onClick={() => handleLoadQuote(q)} 
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded cursor-pointer"
                  >
                    Load
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
