'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, User, MapPin, Phone, Mail, FileText, Upload, Download, Eye, Package, AlertCircle, 
  X, Image as ImageIcon, Barcode, Plus, Minus, Save, Camera, TrendingUp, ListChecks
} from 'lucide-react';
import { ClientDocument, QuoteLineItem } from '@/types';

interface EnhancedQuoteItem extends QuoteLineItem {
  actuallyUsed?: number;
  quotedQuantity?: number;
  barcode?: string;
  hasBarcode?: boolean;
}

export default function InstallerClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clients, updateClient, savedQuotes, inventory, saveQuote } = useData();
  const { currentUser } = useAuth();
  const clientId = params?.id as string;

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'CI' | 'CF' | 'Fact' | 'CUI' | 'Other'>('Other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [showImages, setShowImages] = useState(false);
  const [equipmentData, setEquipmentData] = useState<EnhancedQuoteItem[]>([]);
  const [extraItems, setExtraItems] = useState<EnhancedQuoteItem[]>([]);
  const [installationPhotos, setInstallationPhotos] = useState<Array<{id: string, url: string, description: string, timestamp: Date, uploadedBy?: string, uploadedAt?: Date}>>([]);
  const [finalReport, setFinalReport] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const client = clients.find(c => c.id === clientId);

  // Get quote items for this client
  const clientQuotes = savedQuotes.filter(q => q.clientId === clientId);
  const allQuoteItems = clientQuotes.flatMap(q => q.items || []);

  // Initialize equipment data only once, don't reinitialize on data changes
  useEffect(() => {
    if (!isInitialized && allQuoteItems.length > 0) {
      const enhanced: EnhancedQuoteItem[] = allQuoteItems.map(item => {
        const inventoryItem = inventory.find(inv => inv.id === item.inventoryItemId);
        
        // Check if we have saved consumption data for this item
        const savedConsumptionData = clientQuotes
          .flatMap(q => q.consumptionData || [])
          .find(cd => cd.id === item.id);
        
        return {
          ...item,
          actuallyUsed: savedConsumptionData?.actuallyUsed ?? item.quantity,
          quotedQuantity: item.quantity,
          barcode: inventoryItem?.barcode,
          hasBarcode: !!inventoryItem?.barcode,
        };
      });
      setEquipmentData(enhanced);
      
      // Load extra items from saved data
      const savedExtraItems = clientQuotes
        .flatMap(q => q.extraItems || [])
        .filter(item => item.isExtra)
        .map(item => ({
          ...item,
          quantity: item.consumedQty,
          actuallyUsed: item.actuallyUsed || item.consumedQty,
        } as EnhancedQuoteItem));
      
      if (savedExtraItems.length > 0) {
        setExtraItems(savedExtraItems);
      }

      // Load installation photos and report from quote
      const quote = clientQuotes[0];
      if (quote) {
        // Photos are stored in quote's completionData (or custom field)
        setInstallationPhotos((quote as any).installationPhotos || []);
        setFinalReport((quote as any).completionNotes || '');
      }
      
      setIsInitialized(true);
    }
  }, [clientId]);

  // Warn if leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Detect changes in photos or report
  useEffect(() => {
    if (isInitialized) {
      // This will be true if user has made changes
      // We'll set this when photos/report are modified
    }
  }, [isInitialized]);

  if (!client) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-white font-bold">Client Not Found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;

        const newDoc: ClientDocument = {
          id: Date.now().toString(),
          name: file.name,
          type: uploadType,
          description: uploadDescription || undefined,
          url: base64,
          date: new Date(),
          uploadedBy: currentUser.nickname,
          uploadedByRole: currentUser.role,
        };

        const updatedClient = {
          ...client,
          documents: [...(client.documents || []), newDoc],
        };

        await updateClient(updatedClient);
        setUploadDescription('');
        setUploadType('Other');
        alert('Document uploaded successfully!');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleQuantityChange = (itemId: string, value: number) => {
    setEquipmentData(prev =>
      prev.map(item => item.id === itemId ? { ...item, actuallyUsed: value } : item)
    );
  };

  const handleAddExtraItem = () => {
    const newItem: EnhancedQuoteItem = {
      id: `extra-${Date.now()}`,
      description: '',
      unit: 'buc',
      quantity: 0,
      netPrice: 0,
      actuallyUsed: 0,
    };
    setExtraItems([...extraItems, newItem]);
  };

  const handleRemoveExtraItem = (itemId: string) => {
    setExtraItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleExtraItemChange = (itemId: string, field: string, value: any) => {
    setExtraItems(prev =>
      prev.map(item => item.id === itemId ? { ...item, [field]: value } : item)
    );
  };

  const calculateVariance = (item: EnhancedQuoteItem) => {
    const quoted = item.quotedQuantity || item.quantity;
    const actual = item.actuallyUsed || 0;
    const diff = actual - quoted;
    const valueDiff = diff * item.netPrice;
    return { diff, valueDiff };
  };

  const handleSaveEquipment = async () => {
    try {
      // Find all quotes for this client and update them with consumption data and edit tracking
      const updatedQuotes = clientQuotes.map(quote => {
        // Match items from this quote
        const consumptionData = equipmentData
          .filter(item => quote.items.some(qi => qi.id === item.id))
          .map(item => ({
            id: item.id,
            description: item.description,
            quotedQty: item.quotedQuantity || item.quantity,
            consumedQty: item.actuallyUsed || 0,
            actuallyUsed: item.actuallyUsed,
            unit: item.unit,
            netPrice: item.netPrice,
            inventoryItemId: item.inventoryItemId,
            barcode: item.barcode,
            hasBarcode: item.hasBarcode,
          }));

        return {
          ...quote,
          consumptionData,
          consumptionDataUpdatedAt: new Date(),
          consumptionDataUpdatedBy: currentUser?.nickname || 'Unknown',
          extraItems: extraItems.map(item => ({
            id: item.id,
            description: item.description,
            quotedQty: 0,
            consumedQty: item.quantity || 0,
            actuallyUsed: item.quantity,
            unit: item.unit,
            netPrice: item.netPrice,
            isExtra: true,
          })),
          phase: 'in-progress' as const,
        };
      });

      // Save all updated quotes
      for (const quote of updatedQuotes) {
        await saveQuote(quote);
      }

      alert('✓ Equipment data saved successfully!');
      console.log('Saved consumption data:', { equipmentData, extraItems });
    } catch (error) {
      console.error('Error saving equipment data:', error);
      alert('Failed to save equipment data');
    }
  };

  const handleBarcodeScan = (itemId: string) => {
    // In a real app, this would activate camera/scanner
    // For now, show prompt
    const barcode = prompt('Enter or scan barcode:');
    if (barcode) {
      const item = equipmentData.find(i => i.id === itemId);
      if (item && item.barcode === barcode) {
        alert(`✓ Barcode matched for ${item.description}`);
      } else {
        alert('⚠ Barcode does not match inventory item');
      }
    }
  };

  const handleInstallationPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newPhoto = {
          id: Date.now().toString(),
          url: base64,
          description: '',
          timestamp: new Date(),
          uploadedBy: currentUser?.nickname || 'Unknown',
          uploadedAt: new Date(),
        };
        setInstallationPhotos([...installationPhotos, newPhoto]);
        setHasUnsavedChanges(true);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo');
    }
  };

  const handleRemoveInstallationPhoto = (photoId: string) => {
    setInstallationPhotos(prev => prev.filter(p => p.id !== photoId));
    setHasUnsavedChanges(true);
  };

  const handleUpdatePhotoDescription = (photoId: string, description: string) => {
    setInstallationPhotos(prev =>
      prev.map(p => p.id === photoId ? { ...p, description } : p)
    );
    setHasUnsavedChanges(true);
  };

  // Save installation photos and report
  const handleSaveInstallationData = async () => {
    try {
      setIsSaving(true);
      
      // Update all quotes with installation data and edit tracking
      const updatedQuotes = clientQuotes.map(quote => ({
        ...quote,
        installationPhotos,
        completionNotes: finalReport,
        consumptionDataUpdatedAt: new Date(),
        consumptionDataUpdatedBy: currentUser?.nickname || 'Unknown',
      }));

      // Save all updated quotes
      for (const quote of updatedQuotes) {
        await saveQuote(quote);
      }

      setHasUnsavedChanges(false);
      alert('✓ Installation photos and report saved successfully!');
    } catch (error) {
      console.error('Error saving installation data:', error);
      alert('Failed to save installation data');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate summary
  const calculateSummary = () => {
    const originalQuoteTotal = equipmentData.reduce((sum, item) => sum + (item.quantity * item.netPrice), 0);
    const actualConsumptionTotal = equipmentData.reduce((sum, item) => sum + ((item.actuallyUsed || 0) * item.netPrice), 0);
    const equipmentVariance = actualConsumptionTotal - originalQuoteTotal;
    
    const extraItemsTotal = extraItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.netPrice || 0)), 0);
    const totalVariance = equipmentVariance + extraItemsTotal;
    
    return {
      originalQuoteTotal,
      actualConsumptionTotal,
      equipmentVariance,
      extraItemsTotal,
      totalVariance,
    };
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-400" />
            <span className="text-amber-300 font-semibold">You have unsaved changes</span>
          </div>
          <span className="text-sm text-amber-200">Scroll down to save photos and report</span>
        </div>
      )}
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <User size={32} className="text-emerald-500" />
              {client.name}
            </h1>
            <p className="text-slate-400 flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                client.type === 'Private' 
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-purple-500/20 text-purple-300'
              }`}>
                {client.type}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-xs bg-slate-700 px-2 py-1 rounded">Read-only view</span>
            </p>
          </div>
        </div>

        {/* Client Information */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-slate-300">
              <Phone size={18} className="text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="font-semibold">{client.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Mail size={18} className="text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-semibold">{client.email}</p>
              </div>
            </div>
            {client.needs?.siteCity && (
              <div className="flex items-center gap-3 text-slate-300 col-span-2">
                <MapPin size={18} className="text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">Site Location</p>
                  <p className="font-semibold">
                    {client.needs.siteStreet} {client.needs.siteStreetNumber}, {client.needs.siteCity}, {client.needs.siteCounty}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Needs */}
        {client.needs && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Project Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {client.needs.panelCount && (
                <div className="bg-slate-900/50 rounded p-4">
                  <p className="text-xs text-slate-500 mb-1">Solar Panels</p>
                  <p className="text-2xl font-bold text-emerald-400">{client.needs.panelCount}</p>
                </div>
              )}
              {client.needs.panelKw && (
                <div className="bg-slate-900/50 rounded p-4">
                  <p className="text-xs text-slate-500 mb-1">Total Power</p>
                  <p className="text-2xl font-bold text-blue-400">{client.needs.panelKw} kW</p>
                </div>
              )}
              {client.needs.roofType && (
                <div className="bg-slate-900/50 rounded p-4">
                  <p className="text-xs text-slate-500 mb-1">Roof Type</p>
                  <p className="text-lg font-bold text-white">{client.needs.roofType}</p>
                </div>
              )}
            </div>
            {client.needs.technicalNotes && (
              <div className="mt-4 bg-slate-900/50 rounded p-4">
                <p className="text-xs text-slate-500 mb-2">Technical Notes</p>
                <p className="text-sm text-slate-300">{client.needs.technicalNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Onsite Pictures */}
        {client.needs?.siteImages && client.needs.siteImages.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Camera size={24} className="text-emerald-500" />
                Onsite Pictures
              </h2>
              <button
                onClick={() => setShowImages(!showImages)}
                className="text-sm px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {showImages ? 'Hide' : 'Show'} ({client.needs.siteImages.length})
              </button>
            </div>
            {showImages && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {client.needs.siteImages.map((img) => (
                  <div key={img.id} className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700 hover:border-emerald-500 transition-all">
                    <img
                      src={img.url}
                      alt={img.label || 'Site image'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                      {img.category && (
                        <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded mb-1">
                          {img.category}
                        </span>
                      )}
                      {img.label && (
                        <p className="text-xs text-white text-center">{img.label}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(img.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Equipment List with Quantity Tracking */}
        {equipmentData.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Package size={24} className="text-emerald-500" />
              Equipment List & Usage Tracking
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b-2 border-slate-700">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-400 pb-3 px-4">Item</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Quoted Qty</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Actually Used</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Difference</th>
                    <th className="text-right text-xs font-semibold text-slate-400 pb-3 px-4">Value Diff</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentData.map((item) => {
                    const { diff, valueDiff } = calculateVariance(item);
                    return (
                      <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-3 px-4 text-slate-300">{item.description}</td>
                        <td className="py-3 px-4 text-center font-bold text-white">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              value={item.actuallyUsed || 0}
                              onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                              disabled={false}
                              min="0"
                              step="1"
                              className="w-24 bg-slate-900 border-2 border-slate-500 hover:border-emerald-500 rounded px-3 py-2 text-white text-center focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-colors cursor-text"
                            />
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-center font-bold ${
                          diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {diff > 0 ? '+' : ''}{diff} {item.unit}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${
                          valueDiff > 0 ? 'text-red-400' : valueDiff < 0 ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {valueDiff > 0 ? '+' : ''}{valueDiff.toFixed(2)} RON
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.hasBarcode ? (
                            <button
                              onClick={() => handleBarcodeScan(item.id)}
                              className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors text-blue-400"
                              title="Scan barcode"
                            >
                              <Barcode size={18} />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">No barcode</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Extra Items Section */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Extra Materials Used</h3>
                <button
                  onClick={handleAddExtraItem}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  <Plus size={16} />
                  Add Extra Item
                </button>
              </div>

              {extraItems.length > 0 ? (
                <div className="space-y-3">
                  {extraItems.map((item) => (
                    <div key={item.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => handleExtraItemChange(item.id, 'description', e.target.value)}
                          className="col-span-5 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleExtraItemChange(item.id, 'quantity', Number(e.target.value))}
                          className="col-span-2 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={item.unit}
                          onChange={(e) => handleExtraItemChange(item.id, 'unit', e.target.value)}
                          className="col-span-2 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={item.netPrice}
                          onChange={(e) => handleExtraItemChange(item.id, 'netPrice', Number(e.target.value))}
                          className="col-span-2 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button
                          onClick={() => handleRemoveExtraItem(item.id)}
                          className="col-span-1 p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors text-red-400"
                        >
                          <Minus size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-4">No extra materials added</p>
              )}
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveEquipment}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold"
              >
                <Save size={18} />
                Save Equipment Data
              </button>
            </div>
          </div>
        )}

        {/* Summary Section */}
        {(equipmentData.length > 0 || extraItems.length > 0) && (() => {
          const summary = calculateSummary();
          return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <ListChecks size={24} className="text-emerald-500" />
                Project Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Equipment Summary */}
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-400 mb-3">Equipment Usage</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Original Quote Total:</span>
                      <span className="font-bold text-white">{summary.originalQuoteTotal.toFixed(2)} RON</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Actual Consumption:</span>
                      <span className="font-bold text-white">{summary.actualConsumptionTotal.toFixed(2)} RON</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                      <span className="text-slate-300">Equipment Variance:</span>
                      <span className={`font-bold ${
                        summary.equipmentVariance > 0 
                          ? 'text-red-400' 
                          : summary.equipmentVariance < 0 
                          ? 'text-green-400' 
                          : 'text-white'
                      }`}>
                        {summary.equipmentVariance > 0 ? '+' : ''}{summary.equipmentVariance.toFixed(2)} RON
                      </span>
                    </div>
                  </div>
                </div>

                {/* Extra Materials Summary */}
                {extraItems.length > 0 && (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-400 mb-3">Extra Materials</h3>
                    <div className="space-y-2">
                      {extraItems.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-slate-300 truncate">{item.description}</span>
                          <span className="font-semibold text-white whitespace-nowrap ml-2">
                            {item.quantity} {item.unit} × {item.netPrice} = {((item.quantity || 0) * (item.netPrice || 0)).toFixed(2)} RON
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                        <span className="text-slate-300 font-semibold">Extra Items Total:</span>
                        <span className="font-bold text-emerald-400">{summary.extraItemsTotal.toFixed(2)} RON</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Total Variance */}
              <div className="mt-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={20} className={summary.totalVariance > 0 ? 'text-red-400' : 'text-green-400'} />
                    <span className="font-semibold text-white">Total Price Difference:</span>
                  </div>
                  <span className={`text-2xl font-bold ${
                    summary.totalVariance > 0 
                      ? 'text-red-400' 
                      : summary.totalVariance < 0 
                      ? 'text-green-400' 
                      : 'text-white'
                  }`}>
                    {summary.totalVariance > 0 ? '+' : ''}{summary.totalVariance.toFixed(2)} RON
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {summary.totalVariance > 0 
                    ? 'Additional cost above original quote' 
                    : summary.totalVariance < 0 
                    ? 'Savings from original quote' 
                    : 'No variance from original quote'}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Installation Pictures Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Camera size={24} className="text-emerald-500" />
            Installation Pictures
          </h2>
          <p className="text-sm text-slate-400 mb-4">Add photos of the installation after completion</p>

          {/* Upload Button */}
          <label className="block mb-6">
            <input
              type="file"
              onChange={handleInstallationPhotoUpload}
              className="hidden"
              accept="image/*"
            />
            <button
              type="button"
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-emerald-500/50 hover:border-emerald-400"
              onClick={() => document.querySelector('input[type="file"][accept="image/*"]')?.dispatchEvent(new MouseEvent('click'))}
            >
              <Camera size={18} />
              Add Installation Photo
            </button>
          </label>

          {/* Photos Grid */}
          {installationPhotos.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {installationPhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-600 hover:border-emerald-500 transition-all">
                      <img
                        src={photo.url}
                        alt="Installation"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveInstallationPhoto(photo.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Photo Descriptions */}
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Photo Details</h3>
                <div className="space-y-3">
                  {installationPhotos.map((photo) => (
                    <div key={photo.id} className="flex gap-3">
                      <div className="w-16 h-16 rounded bg-slate-800 border border-slate-600 overflow-hidden flex-shrink-0">
                        <img
                          src={photo.url}
                          alt="Installation"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Add description for this photo..."
                          value={photo.description}
                          onChange={(e) => handleUpdatePhotoDescription(photo.id, e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">{new Date(photo.timestamp).toLocaleDateString('ro-RO')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Camera size={48} className="mx-auto mb-2 text-slate-600" />
              <p>No installation photos added yet</p>
            </div>
          )}
        </div>

        {/* Final Report Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText size={24} className="text-emerald-500" />
            Final Installation Report
          </h2>
          <p className="text-sm text-slate-400 mb-4">Document the completion status and any notes</p>

          <textarea
            value={finalReport}
            placeholder="Enter final installation report details:
- Installation status
- Work completed
- Any issues or notes
- Recommendations
- Client sign-off"
            className="w-full h-48 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            onChange={(e) => {
              setFinalReport(e.target.value);
              setHasUnsavedChanges(true);
            }}
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveInstallationData}
              disabled={isSaving || !hasUnsavedChanges}
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Photos & Report'}
            </button>
            <button
              onClick={() => {
                const reportData = {
                  clientName: client?.name,
                  date: new Date().toLocaleDateString('ro-RO'),
                  summary: calculateSummary(),
                  report: finalReport,
                  photosCount: installationPhotos.length,
                };
                console.log('Export Report:', reportData);
                alert('Report prepared for export (PDF export coming in production)');
              }}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Export as PDF
            </button>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText size={24} className="text-emerald-500" />
            Documents
          </h2>

          {/* Upload Form */}
          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <Upload size={16} />
              Upload Document
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as any)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Other">Other</option>
                <option value="CI">Identity Card (CI)</option>
                <option value="CF">Fiscal Certificate (CF)</option>
                <option value="Fact">Invoice (Factura)</option>
                <option value="CUI">CUI</option>
              </select>
              <input
                type="text"
                placeholder="Description (optional)"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <label className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  accept="image/*,.pdf"
                />
                <button
                  type="button"
                  disabled={uploading}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  onClick={() => document.querySelector('input[type="file"]')?.dispatchEvent(new MouseEvent('click'))}
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Choose File
                    </>
                  )}
                </button>
              </label>
            </div>
            <p className="text-xs text-emerald-300">You can upload documents but cannot delete them</p>
          </div>

          {/* Documents List */}
          {client.documents && client.documents.length > 0 ? (
            <div className="space-y-3">
              {client.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-emerald-500/50 transition-all">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText size={20} className="text-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-800 rounded">{doc.type}</span>
                        {doc.description && <span>• {doc.description}</span>}
                        <span>• {new Date(doc.date).toLocaleDateString('ro-RO')}</span>
                        {doc.uploadedBy && (
                          <>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded ${
                              doc.uploadedByRole === 'INSTALLER' 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {doc.uploadedBy} ({doc.uploadedByRole})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-blue-400 hover:text-blue-300"
                      title="Preview"
                    >
                      <Eye size={18} />
                    </button>
                    <a
                      href={doc.url}
                      download={doc.name}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-emerald-400 hover:text-emerald-300"
                      title="Download"
                    >
                      <Download size={18} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FileText size={48} className="mx-auto mb-2 text-slate-600" />
              <p>No documents uploaded yet</p>
            </div>
          )}
        </div>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <FileText size={24} className="text-emerald-500" />
                  <div>
                    <h3 className="text-lg font-bold text-white">{previewDoc.name}</h3>
                    <p className="text-xs text-slate-400">{previewDoc.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-slate-900">
                {previewDoc.url.startsWith('data:image') ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-w-full h-auto mx-auto"
                  />
                ) : previewDoc.url.startsWith('data:application/pdf') ? (
                  <iframe
                    src={previewDoc.url}
                    className="w-full h-full min-h-[600px]"
                    title={previewDoc.name}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText size={48} className="mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400 mb-4">Preview not available for this file type</p>
                    <a
                      href={previewDoc.url}
                      download={previewDoc.name}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      <Download size={18} />
                      Download File
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
