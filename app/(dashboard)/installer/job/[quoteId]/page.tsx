'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { 
  ArrowLeft, MapPin, Phone, Mail, User, Building, FileText, Camera, Package, 
  Plus, Trash2, BarChart3, CheckCircle, AlertCircle, Barcode, Save, X 
} from 'lucide-react';
import Link from 'next/link';

interface ConsumptionItem {
  id: string;
  description: string;
  quotedQty: number;
  consumedQty: number;
  unit: string;
  netPrice: number;
  isExtra?: boolean;
  originalLineItemId?: string;
}

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { savedQuotes, clients, inventory } = useData();
  const quoteId = params.quoteId as string;

  const quote = savedQuotes.find((q: any) => q.id === quoteId);
  const client = quote ? clients.find((c: any) => c.id === quote.clientId) : null;

  const [consumptionItems, setConsumptionItems] = useState<ConsumptionItem[]>(
    quote?.items?.map((item: any) => ({
      id: item.id,
      description: item.description,
      quotedQty: item.quantity,
      consumedQty: 0,
      unit: item.unit,
      netPrice: item.netPrice,
      originalLineItemId: item.id,
    })) || []
  );

  const [extraItems, setExtraItems] = useState<ConsumptionItem[]>([]);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [newExtraItem, setNewExtraItem] = useState({ description: '', quantity: 0, unit: 'pcs', price: 0 });
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate variances and costs
  const summary = useMemo(() => {
    const allItems = [...consumptionItems, ...extraItems];
    
    const quotedCost = consumptionItems.reduce((sum, item) => sum + (item.quotedQty * item.netPrice), 0);
    const actualCost = allItems.reduce((sum, item) => sum + (item.consumedQty * item.netPrice), 0);
    const costVariance = actualCost - quotedCost;
    
    const materialVariances = consumptionItems.map(item => ({
      description: item.description,
      quoted: item.quotedQty,
      consumed: item.consumedQty,
      delta: item.consumedQty - item.quotedQty,
      cost: (item.consumedQty - item.quotedQty) * item.netPrice,
    }));

    const extraCost = extraItems.reduce((sum, item) => sum + (item.consumedQty * item.netPrice), 0);

    return {
      quotedCost,
      actualCost,
      costVariance,
      extraCost,
      materialVariances,
      totalItems: allItems.length,
    };
  }, [consumptionItems, extraItems]);

  const handleUpdateConsumption = (id: string, quantity: number) => {
    setConsumptionItems(prev =>
      prev.map(item => item.id === id ? { ...item, consumedQty: Math.max(0, quantity) } : item)
    );
  };

  const handleAddExtraItem = () => {
    if (!newExtraItem.description || newExtraItem.quantity <= 0) {
      alert('Please fill in all fields');
      return;
    }

    const extraItem: ConsumptionItem = {
      id: `extra-${Date.now()}`,
      description: newExtraItem.description,
      quotedQty: 0,
      consumedQty: newExtraItem.quantity,
      unit: newExtraItem.unit,
      netPrice: newExtraItem.price,
      isExtra: true,
    };

    setExtraItems([...extraItems, extraItem]);
    setNewExtraItem({ description: '', quantity: 0, unit: 'pcs', price: 0 });
    setShowAddExtra(false);
  };

  const handleRemoveExtra = (id: string) => {
    setExtraItems(prev => prev.filter(item => item.id !== id));
  };

  const handleBarcodeScanned = (barcode: string) => {
    if (!barcode.trim()) return;

    // Find matching item by barcode (SKU)
    const matchingItem = consumptionItems.find(
      item => item.description.toUpperCase().includes(barcode.toUpperCase()) ||
              barcode.toUpperCase().includes(item.description.split(' ')[0].toUpperCase())
    );

    if (matchingItem) {
      handleUpdateConsumption(matchingItem.id, matchingItem.consumedQty + 1);
      setScannedItems([...scannedItems, `✓ ${matchingItem.description}`]);
    } else {
      setScannedItems([...scannedItems, `✗ No match: ${barcode}`]);
    }

    setBarcodeInput('');
  };

  const handleCompleteJob = () => {
    if (consumptionItems.some(item => item.consumedQty === 0)) {
      alert('Please enter consumption quantities for all quoted items');
      return;
    }
    setShowCompletionForm(true);
  };

  const handleSubmitJobCompletion = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/installer/complete-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          consumptionData: consumptionItems,
          extraItems,
          completionNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete job');
      }

      const data = await response.json();
      alert('Job completed successfully! Redirecting to dashboard...');
      router.push('/installer');
    } catch (error) {
      console.error('Error completing job:', error);
      alert('Error completing job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!quote || !client) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={32} />
          <p className="text-white mb-4">Job not found</p>
          <Link href="/installer" className="text-blue-400 hover:text-blue-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">{quote.title || 'Installation Job'}</h1>
            <p className="text-slate-400 mt-1">Project ID: {quote.id}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Client Info & Photos */}
          <div className="lg:col-span-1 space-y-6">
            {/* Client Information */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <User size={18} className="text-blue-400" />
                Client Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Name</p>
                  <p className="text-white font-semibold">{client.name}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Phone</p>
                  <a href={`tel:${client.phone}`} className="text-blue-400 hover:text-blue-300">
                    {client.phone}
                  </a>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
                  <a href={`mailto:${client.email}`} className="text-blue-400 hover:text-blue-300 break-all">
                    {client.email}
                  </a>
                </div>

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Site Location</p>
                  <div className="flex items-start gap-2 mt-1 text-sm text-white">
                    <MapPin size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                    <span>
                      {client.needs?.siteStreet} {client.needs?.siteStreetNumber}, {client.needs?.siteCity}, {client.needs?.siteCounty}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Site Photos */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <button
                onClick={() => setShowPhotoGallery(!showPhotoGallery)}
                className="w-full flex items-center justify-between text-white font-bold hover:text-blue-400 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Camera size={18} className="text-amber-400" />
                  Site Photos ({client.needs?.siteImages?.length || 0})
                </span>
                <span>{showPhotoGallery ? '−' : '+'}</span>
              </button>

              {showPhotoGallery && (
                <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                  {client.needs?.siteImages && client.needs.siteImages.length > 0 ? (
                    client.needs.siteImages.map((img: any) => (
                      <div key={img.id} className="bg-slate-900 rounded p-2">
                        {img.url && (
                          <img
                            src={img.url}
                            alt={img.label || 'Site photo'}
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                        )}
                        <p className="text-xs text-slate-300">{img.label || 'Untitled'}</p>
                        <p className="text-xs text-slate-500">{new Date(img.timestamp).toLocaleString('ro-RO')}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">No photos available</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Material Tracking & Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Consumption Tracking Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package size={18} className="text-emerald-400" />
                  Material Consumption Tracking
                </h3>
                <button
                  onClick={() => setShowBarcodeScanner(!showBarcodeScanner)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  <Barcode size={16} />
                  Scanner
                </button>
              </div>

              {/* Barcode Scanner Modal */}
              {showBarcodeScanner && (
                <div className="mb-4 p-4 bg-slate-900/50 border border-blue-500/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-blue-400">Barcode Scanner</h4>
                    <button
                      onClick={() => setShowBarcodeScanner(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Scan barcode or enter SKU..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleBarcodeScanned(barcodeInput);
                        }
                      }}
                      autoFocus
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={() => handleBarcodeScanned(barcodeInput)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {scannedItems.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                      {scannedItems.map((item, idx) => (
                        <div key={idx} className={item.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}>
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-2 text-slate-400 font-semibold">Item</th>
                      <th className="text-center py-3 px-2 text-slate-400 font-semibold">Quoted</th>
                      <th className="text-center py-3 px-2 text-slate-400 font-semibold">Consumed</th>
                      <th className="text-center py-3 px-2 text-slate-400 font-semibold">Delta</th>
                      <th className="text-right py-3 px-2 text-slate-400 font-semibold">Price/Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptionItems.map((item) => {
                      const delta = item.consumedQty - item.quotedQty;
                      const deltaColor = delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-400';
                      return (
                        <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                          <td className="py-3 px-2 text-white">{item.description}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{item.quotedQty} {item.unit}</td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              min="0"
                              value={item.consumedQty}
                              onChange={(e) => handleUpdateConsumption(item.id, Number(e.target.value))}
                              className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </td>
                          <td className={`py-3 px-2 text-center font-semibold ${deltaColor}`}>
                            {delta > 0 ? '+' : ''}{delta}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-300">{item.netPrice.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Extra Items */}
              {extraItems.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h4 className="text-sm font-bold text-yellow-400 mb-3">Extra Items (Not in Quote)</h4>
                  <div className="space-y-3">
                    {extraItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded border border-yellow-500/30">
                        <div className="flex-1">
                          <p className="text-white font-semibold">{item.description}</p>
                          <p className="text-xs text-slate-400">
                            {item.consumedQty} {item.unit} × {item.netPrice.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveExtra(item.id)}
                          className="text-red-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Extra Item Form */}
              {showAddExtra ? (
                <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
                  <input
                    type="text"
                    placeholder="Item description"
                    value={newExtraItem.description}
                    onChange={(e) => setNewExtraItem({ ...newExtraItem, description: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={newExtraItem.quantity || ''}
                      onChange={(e) => setNewExtraItem({ ...newExtraItem, quantity: Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Unit"
                      value={newExtraItem.unit}
                      onChange={(e) => setNewExtraItem({ ...newExtraItem, unit: e.target.value })}
                      className="bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={newExtraItem.price || ''}
                      onChange={(e) => setNewExtraItem({ ...newExtraItem, price: Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddExtraItem}
                      className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                    <button
                      onClick={() => setShowAddExtra(false)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddExtra(true)}
                  className="mt-6 w-full py-2 border-2 border-dashed border-slate-600 text-slate-400 hover:border-emerald-500 hover:text-emerald-400 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Add Extra Item
                </button>
              )}
            </div>

            {/* Summary & Variance Report */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-purple-400" />
                Cost Summary & Variance
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700">
                  <span className="text-slate-300">Quoted Cost:</span>
                  <span className="text-white font-bold">
                    {summary.quotedCost.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700">
                  <span className="text-slate-300">Extra Items Cost:</span>
                  <span className="text-yellow-400 font-bold">
                    +{summary.extraCost.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                  </span>
                </div>

                <div className={`flex justify-between items-center p-3 rounded border ${
                  summary.costVariance > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <span className={summary.costVariance > 0 ? 'text-red-300' : 'text-emerald-300'}>Variance (Under/Over):</span>
                  <span className={`font-bold ${summary.costVariance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {summary.costVariance > 0 ? '+' : ''}{summary.costVariance.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded border border-blue-500/30 text-lg font-bold">
                  <span className="text-blue-300">Actual Cost:</span>
                  <span className="text-blue-400">
                    {summary.actualCost.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                  </span>
                </div>
              </div>

              {/* Material Variances Detail */}
              {summary.materialVariances.some(v => v.delta !== 0) && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <p className="text-sm font-bold text-slate-300 mb-3">Material Variances:</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {summary.materialVariances.filter(v => v.delta !== 0).map((v, idx) => (
                      <div key={idx} className="text-xs p-2 bg-slate-900 rounded border border-slate-600">
                        <p className="text-white">{v.description}</p>
                        <p className="text-slate-400">
                          Quoted: {v.quoted} | Consumed: {v.consumed} | <span className={v.delta > 0 ? 'text-red-400' : 'text-emerald-400'}>Delta: {v.delta > 0 ? '+' : ''}{v.delta}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCompleteJob}
                className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle size={18} />
                Complete Job
              </button>
              <button
                onClick={() => router.push('/installer')}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
              >
                Back
              </button>
            </div>

            {/* Completion Form Modal */}
            {showCompletionForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 max-w-md w-full">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle size={24} className="text-emerald-400" />
                    <h3 className="text-2xl font-bold text-white">Complete Job</h3>
                  </div>

                  <p className="text-slate-400 mb-6">
                    You're about to mark this installation as complete. Please add any notes about the job.
                  </p>

                  {/* Summary Stats */}
                  <div className="bg-slate-900 rounded p-4 mb-6 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quoted Cost:</span>
                      <span className="text-white font-semibold">
                        {summary.quotedCost.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Actual Cost:</span>
                      <span className="text-emerald-400 font-semibold">
                        {summary.actualCost.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                      </span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between">
                      <span className="text-slate-400">Variance:</span>
                      <span className={`font-bold ${summary.costVariance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {summary.costVariance > 0 ? '+' : ''}{summary.costVariance.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-white mb-2">Completion Notes</label>
                    <textarea
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      placeholder="Any issues encountered, quality notes, or recommendations..."
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSubmitJobCompletion}
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                    >
                      {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
                    </button>
                    <button
                      onClick={() => setShowCompletionForm(false)}
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
