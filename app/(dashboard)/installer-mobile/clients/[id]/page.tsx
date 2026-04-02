'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, User, MapPin, Phone, Mail, FileText, Upload, X, Camera, Plus, Minus, Save,
  Package, AlertCircle, CheckCircle, TrendingUp, ListChecks, FolderOpen, ChevronDown, ChevronUp
} from 'lucide-react';
import { ClientDocument, QuoteLineItem } from '@/types';

interface EnhancedQuoteItem extends QuoteLineItem {
  actuallyUsed?: number;
  quotedQuantity?: number;
  barcode?: string;
  hasBarcode?: boolean;
}

const SERIAL_REQUIRED_REGEX = /(inverter|invertor|battery|baterie|acumulator)/i;

export default function InstallerMobileClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clients, updateClient, savedQuotes, inventory, saveQuote } = useData();
  const { currentUser } = useAuth();
  const clientId = params?.id as string;

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'CI' | 'CF' | 'Fact' | 'CUI' | 'Other'>('Other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [equipmentData, setEquipmentData] = useState<EnhancedQuoteItem[]>([]);
  const [extraItems, setExtraItems] = useState<EnhancedQuoteItem[]>([]);
  const [installationPhotos, setInstallationPhotos] = useState<Array<{id: string, url: string, description: string, timestamp: Date, uploadedBy?: string, uploadedAt?: Date}>>([]);
  const [finalReport, setFinalReport] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [groundingValue, setGroundingValue] = useState('');
  const [lowVoltageCableCheck, setLowVoltageCableCheck] = useState<'' | 'Corespunde' | 'Nu corespunde'>('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lockedProjectMention, setLockedProjectMention] = useState('');
  const [isSendingMention, setIsSendingMention] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerTickRef = useRef<number | null>(null);

  const client = clients.find(c => c.id === clientId);

  const clientQuotes = useMemo(() => {
    const quotes = savedQuotes.filter(q => q.clientId === clientId);
    return quotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [savedQuotes, clientId]);

  const selectedProject = useMemo(
    () => clientQuotes.find(q => q.id === selectedProjectId) || null,
    [clientQuotes, selectedProjectId]
  );

  const allQuoteItems = useMemo(() => selectedProject?.items || [], [selectedProject]);

  useEffect(() => {
    if (clientQuotes.length === 0) {
      setSelectedProjectId('');
      return;
    }
    if (selectedProjectId && !clientQuotes.some(q => q.id === selectedProjectId)) {
      setSelectedProjectId('');
    }
  }, [clientQuotes, selectedProjectId]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) { next.delete(section); } else { next.add(section); }
      return next;
    });
  };

  useEffect(() => {
    if (!selectedProject) {
      setEquipmentData([]);
      setExtraItems([]);
      setInstallationPhotos([]);
      setFinalReport('');
      setGroundingValue('');
      setLowVoltageCableCheck('');
      setHasUnsavedChanges(false);
      setIsInitialized(false);
      return;
    }

    const enhanced: EnhancedQuoteItem[] = allQuoteItems.map(item => {
      const inventoryItem = inventory.find(inv => inv.id === item.inventoryItemId);
      const saved = (selectedProject.consumptionData || []).find(cd => cd.id === item.id);
      return {
        ...item,
        actuallyUsed: saved?.actuallyUsed ?? saved?.consumedQty ?? item.quantity,
        selectedSerialNumbers: saved?.selectedSerialNumbers ?? item.selectedSerialNumbers ?? [],
        quotedQuantity: item.quantity,
        barcode: inventoryItem?.barcode,
        hasBarcode: !!inventoryItem?.barcode,
      };
    });

    const savedExtra = (selectedProject.extraItems || [])
      .filter(item => item.isExtra)
      .map(item => ({ ...item, quantity: item.actuallyUsed ?? item.consumedQty } as EnhancedQuoteItem));

    const photos = (selectedProject.installationPhotos || []).map(p => ({
      ...p,
      description: p.description ?? '',
      timestamp: new Date(p.timestamp),
      uploadedAt: p.uploadedAt ? new Date(p.uploadedAt) : undefined,
    }));

    setEquipmentData(enhanced);
    setExtraItems(savedExtra);
    setInstallationPhotos(photos);
    setFinalReport(selectedProject.completionNotes || '');
    setGroundingValue(selectedProject.groundingValue || '');
    setLowVoltageCableCheck(selectedProject.lowVoltageCableCheck || '');
    setLockedProjectMention('');
    setHasUnsavedChanges(false);
    setIsInitialized(true);
  }, [selectedProject, allQuoteItems, inventory]);

  const isProjectLocked = !!selectedProject?.adminApprovedAt;

  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    return () => {
      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (scannerTickRef.current) window.clearInterval(scannerTickRef.current);
    };
  }, []);

  const showNotification = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleQuantityChange = (itemId: string, value: number) => {
    if (isProjectLocked) return;
    setEquipmentData(prev => prev.map(item => item.id === itemId ? { ...item, actuallyUsed: value } : item));
    setHasUnsavedChanges(true);
  };

  const updateSerialInput = (itemId: string, raw: string) => {
    if (isProjectLocked) return;
    const serials = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    setEquipmentData(prev => prev.map(item => item.id === itemId ? { ...item, selectedSerialNumbers: serials } : item));
    setHasUnsavedChanges(true);
  };

  const isSerialRequiredItem = (item: EnhancedQuoteItem) => {
    const inv = inventory.find(i => i.id === item.inventoryItemId);
    return inv?.category === 'Inverters' || inv?.category === 'Batteries' || SERIAL_REQUIRED_REGEX.test(item.description || '');
  };

  const getMissingRequiredSerialItems = () => {
    return equipmentData.filter(item => isSerialRequiredItem(item) && !(item.selectedSerialNumbers?.length > 0));
  };

  const startScanner = async (itemId: string) => {
    if (isProjectLocked) {
      showNotification('Project locked. Editing disabled.', 'error');
      return;
    }
    setScannerError(null);
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      scannerStreamRef.current = stream;
      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        await scannerVideoRef.current.play();
      }
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code'] });
        scannerTickRef.current = window.setInterval(async () => {
          if (!scannerVideoRef.current || scannerVideoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(scannerVideoRef.current);
            if (barcodes?.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim();
              setEquipmentData(prev => prev.map(item => {
                if (item.id !== itemId) return item;
                const existing = item.selectedSerialNumbers || [];
                if (existing.includes(code)) return item;
                return { ...item, selectedSerialNumbers: [...existing, code] };
              }));
              setHasUnsavedChanges(true);
              showNotification('Serial scanned!', 'success');
              closeScanner();
            }
          } catch {}
        }, 500);
      } else {
        setScannerError('Barcode scanning not supported. Enter serial manually.');
      }
    } catch {
      setScannerError('Camera access denied. Enter serial manually.');
    }
  };

  const closeScanner = () => {
    if (scannerTickRef.current) window.clearInterval(scannerTickRef.current);
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach(t => t.stop());
      scannerStreamRef.current = null;
    }
    setScannerOpen(false);
    setScannerError(null);
  };

  const handleInstallationPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProjectLocked) {
      showNotification('Project locked.', 'error');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const base64 = event.target?.result as string;
      setInstallationPhotos([...installationPhotos, {
        id: Date.now().toString(),
        url: base64,
        description: '',
        timestamp: new Date(),
        uploadedBy: currentUser?.nickname,
        uploadedAt: new Date(),
      }]);
      setHasUnsavedChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveInstallationPhoto = (photoId: string) => {
    if (isProjectLocked) return;
    setInstallationPhotos(prev => prev.filter(p => p.id !== photoId));
    setHasUnsavedChanges(true);
  };

  const handleUpdatePhotoDescription = (photoId: string, desc: string) => {
    if (isProjectLocked) return;
    setInstallationPhotos(prev => prev.map(p => p.id === photoId ? { ...p, description: desc } : p));
  };

  const handleAddExtraItem = () => {
    if (isProjectLocked) return;
    setExtraItems([...extraItems, {
      id: `extra-${Date.now()}`,
      description: '',
      unit: 'buc',
      quantity: 0,
      netPrice: 0,
      actuallyUsed: 0,
    }]);
  };

  const handleExtraItemChange = (itemId: string, field: string, value: any) => {
    if (isProjectLocked) return;
    setExtraItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const handleRemoveExtraItem = (itemId: string) => {
    if (isProjectLocked) return;
    setExtraItems(prev => prev.filter(i => i.id !== itemId));
  };

  const calculateVariance = (item: EnhancedQuoteItem) => {
    const quoted = item.quotedQuantity || item.quantity;
    const actual = item.actuallyUsed || 0;
    const diff = actual - quoted;
    const valueDiff = diff * item.netPrice;
    return { diff, valueDiff };
  };

  const calculateSummary = () => {
    const originalTotal = equipmentData.reduce((s, item) => s + (item.quantity * item.netPrice), 0);
    const actualTotal = equipmentData.reduce((s, item) => s + ((item.actuallyUsed || 0) * item.netPrice), 0);
    const variance = actualTotal - originalTotal;
    const extraTotal = extraItems.reduce((s, item) => s + ((item.quantity || 0) * (item.netPrice || 0)), 0);
    return { originalTotal, actualTotal, variance, extraTotal, totalVariance: variance + extraTotal };
  };

  const handleSaveEquipment = async () => {
    if (!selectedProject) {
      showNotification('Select a project first.', 'error');
      return;
    }
    if (isProjectLocked) {
      showNotification('Project locked.', 'error');
      return;
    }
    try {
      const consumption = equipmentData.map(item => ({
        id: item.id,
        description: item.description,
        quotedQty: item.quotedQuantity || item.quantity,
        consumedQty: item.actuallyUsed || 0,
        actuallyUsed: item.actuallyUsed,
        selectedSerialNumbers: item.selectedSerialNumbers || [],
        unit: item.unit,
        netPrice: item.netPrice,
        inventoryItemId: item.inventoryItemId,
        barcode: item.barcode,
        hasBarcode: item.hasBarcode,
      }));

      await saveQuote({
        ...selectedProject,
        consumptionData: consumption,
        consumptionDataUpdatedAt: new Date(),
        consumptionDataUpdatedBy: currentUser?.nickname || 'Unknown',
        groundingValue,
        lowVoltageCableCheck: lowVoltageCableCheck || undefined,
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
      });

      setHasUnsavedChanges(false);
      showNotification('✓ Equipment data saved!', 'success');
    } catch (error) {
      console.error('Error:', error);
      showNotification('Save failed.', 'error');
    }
  };

  const handleSaveInstallationData = async () => {
    if (!selectedProject) return;
    if (isProjectLocked) {
      showNotification('Project locked.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const consumption = equipmentData.map(item => ({
        id: item.id,
        description: item.description,
        quotedQty: item.quotedQuantity || item.quantity,
        consumedQty: item.actuallyUsed || 0,
        actuallyUsed: item.actuallyUsed,
        selectedSerialNumbers: item.selectedSerialNumbers || [],
        unit: item.unit,
        netPrice: item.netPrice,
        inventoryItemId: item.inventoryItemId,
        barcode: item.barcode,
        hasBarcode: item.hasBarcode,
      }));

      await saveQuote({
        ...selectedProject,
        consumptionData: consumption,
        installationPhotos,
        completionNotes: finalReport,
        consumptionDataUpdatedAt: new Date(),
        consumptionDataUpdatedBy: currentUser?.nickname || 'Unknown',
        groundingValue,
        lowVoltageCableCheck: lowVoltageCableCheck || undefined,
      });

      setHasUnsavedChanges(false);
      showNotification('✓ Photos & report saved!', 'success');
    } catch (error) {
      console.error('Error:', error);
      showNotification('Save failed.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeclareFinish = async () => {
    if (!selectedProject) return;
    if (isProjectLocked) return;
    const missing = getMissingRequiredSerialItems();
    if (missing.length > 0) {
      showNotification('Add serial numbers for inverter/battery first.', 'error');
      return;
    }
    try {
      const consumption = equipmentData.map(item => ({
        id: item.id,
        description: item.description,
        quotedQty: item.quotedQuantity || item.quantity,
        consumedQty: item.actuallyUsed || 0,
        actuallyUsed: item.actuallyUsed,
        selectedSerialNumbers: item.selectedSerialNumbers || [],
        unit: item.unit,
        netPrice: item.netPrice,
        inventoryItemId: item.inventoryItemId,
        barcode: item.barcode,
        hasBarcode: item.hasBarcode,
      }));

      await saveQuote({
        ...selectedProject,
        consumptionData: consumption,
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
        installationPhotos,
        completionNotes: finalReport,
        groundingValue,
        lowVoltageCableCheck: lowVoltageCableCheck || undefined,
        phase: 'pending-inspection' as const,
        installerDeclaredFinishedAt: new Date(),
        installerDeclaredFinishedBy: currentUser?.nickname || 'Unknown',
      });

      setHasUnsavedChanges(false);
      showNotification('Project declared finished. Admin notified.', 'success');
    } catch (error) {
      console.error('Error:', error);
      showNotification('Failed to declare finish.', 'error');
    }
  };

  const handleSubmitLockedMention = async () => {
    if (!selectedProject) return;
    const msg = lockedProjectMention.trim();
    if (!msg) {
      showNotification('Write a mention first.', 'error');
      return;
    }
    setIsSendingMention(true);
    try {
      const mentions = selectedProject.installerMentions || [];
      await saveQuote({
        ...selectedProject,
        installerMentions: [
          { id: `${Date.now()}`, message: msg, createdAt: new Date(), createdBy: currentUser?.nickname || 'Unknown' },
          ...mentions,
        ],
      });
      setLockedProjectMention('');
      showNotification('Mention sent to admin.', 'success');
    } catch (error) {
      console.error('Error:', error);
      showNotification('Failed to send mention.', 'error');
    } finally {
      setIsSendingMention(false);
    }
  };

  if (!client) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center px-4">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
          <p className="text-white font-bold">Client Not Found</p>
        </div>
      </div>
    );
  }

  const summary = calculateSummary();
  const missingSerials = getMissingRequiredSerialItems();

  return (
    <div className="min-h-full bg-slate-900 pb-4">
      {notification && (
        <div className="fixed top-3 right-3 z-50">
          <div className={`rounded-xl px-4 py-3 text-sm font-bold ${
            notification.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
              : notification.type === 'error'
              ? 'bg-red-500/20 border border-red-500/50 text-red-300'
              : 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
          }`}>
            {notification.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{client.name}</h1>
          <p className="text-xs text-slate-400">{client.type}</p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="px-4 pt-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Phone size={14} className="text-slate-500 shrink-0" />
            <span>{client.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Mail size={14} className="text-slate-500 shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
          {client.needs?.siteCity && (
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <MapPin size={14} className="text-slate-500 shrink-0" />
              <span className="truncate">{client.needs.siteCity}, {client.needs.siteCounty}</span>
            </div>
          )}
        </div>
      </div>

      {/* Projects List */}
      <div className="px-4 pt-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <FolderOpen size={14} className="text-emerald-500" />
              Projects ({clientQuotes.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-700">
            {clientQuotes.map(quote => {
              const isSelected = quote.id === selectedProjectId;
              const isExpanded = expandedProjects.has(quote.id);
              return (
                <div key={quote.id} className="bg-slate-800">
                  <button
                    onClick={() => {
                      setExpandedProjects(p => {
                        const n = new Set(p);
                        if (n.has(quote.id)) { n.delete(quote.id); } else { n.add(quote.id); }
                        return n;
                      });
                    }}
                    className="w-full px-4 py-3 flex items-center gap-2 hover:bg-slate-700/40 text-left"
                  >
                    <div className="p-1 bg-slate-700">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isSelected ? 'text-emerald-400' : 'text-white'} truncate`}>
                        {quote.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(quote.date).toLocaleDateString('ro-RO')} • {quote.totalGross.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                      </p>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (hasUnsavedChanges && !confirm('Unsaved changes. Continue?')) return;
                        setSelectedProjectId(isSelected ? '' : quote.id);
                      }}
                      className="px-2 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-400 rounded active:bg-emerald-500/30 shrink-0"
                    >
                      {isSelected ? 'Unload' : 'Load'}
                    </button>
                  </button>
                  {isExpanded && (
                    <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700 text-xs space-y-1 text-slate-300">
                      <div><span className="text-slate-500">Phase:</span> <span className="capitalize">{quote.phase || 'planning'}</span></div>
                      <div><span className="text-slate-500">Items:</span> {quote.items.length}</div>
                      {quote.allocatedInstallerId && <div className="text-amber-300">✓ Assigned to you</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedProject && (
        <div className="px-4 pt-4 space-y-4">
          {isProjectLocked && (
            <div className="bg-green-500/10 border border-green-500/40 rounded-xl px-4 py-2 text-xs text-green-300">
              This project is finished and locked by admin.
            </div>
          )}

          {hasUnsavedChanges && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl px-4 py-2 flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle size={14} />
              You have unsaved changes
            </div>
          )}

          {/* Specs */}
          {client.needs && (
            <div>
              <button
                onClick={() => toggleSection('specs')}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
              >
                <span className="font-bold text-white text-sm">Project Specs</span>
                {expandedSections.has('specs') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.has('specs') && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {client.needs.panelCount && (
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Panels</p>
                      <p className="text-lg font-bold text-emerald-400">{client.needs.panelCount}</p>
                    </div>
                  )}
                  {client.needs.panelKw && (
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500">Power</p>
                      <p className="text-lg font-bold text-blue-400">{client.needs.panelKw} kW</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Grounding & Cable Check */}
          <div>
            <button
              onClick={() => toggleSection('checks')}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
            >
              <span className="font-bold text-white text-sm">Quality Checks</span>
              {expandedSections.has('checks') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.has('checks') && (
              <div className="mt-2 space-y-3">
                <input
                  type="text"
                  value={groundingValue}
                  onChange={e => {
                    setGroundingValue(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Grounding value…"
                  disabled={isProjectLocked}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-60"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLowVoltageCableCheck('Corespunde');
                      setHasUnsavedChanges(true);
                    }}
                    className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-colors ${
                      lowVoltageCableCheck === 'Corespunde'
                        ? 'bg-green-500 text-white'
                        : 'bg-green-500/20 text-green-300'
                    }`}
                  >
                    ✓ OK
                  </button>
                  <button
                    onClick={() => {
                      setLowVoltageCableCheck('Nu corespunde');
                      setHasUnsavedChanges(true);
                    }}
                    className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-colors ${
                      lowVoltageCableCheck === 'Nu corespunde'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    ✗ Issue
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Equipment */}
          {equipmentData.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection('equipment')}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
              >
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Package size={14} />
                  Equipment ({equipmentData.length})
                </span>
                {expandedSections.has('equipment') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.has('equipment') && (
                <div className="mt-2 space-y-3">
                  {missingSerials.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2 text-xs text-red-300">
                      Serial numbers required for inverter/battery
                    </div>
                  )}
                  {equipmentData.map(item => (
                    <div key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-semibold text-white">{item.description}</p>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                        <span>Quoted: {item.quantity} {item.unit}</span>
                        <input
                          type="number"
                          value={item.actuallyUsed || 0}
                          onChange={e => handleQuantityChange(item.id, Number(e.target.value))}
                          disabled={isProjectLocked}
                          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                          min="0"
                        />
                      </div>
                      {(item.selectedSerialNumbers?.length || 0) > 0 || isSerialRequiredItem(item) ? (
                        <div className="space-y-1">
                          <textarea
                            value={(item.selectedSerialNumbers || []).join(', ')}
                            onChange={e => updateSerialInput(item.id, e.target.value)}
                            disabled={isProjectLocked}
                            placeholder={isSerialRequiredItem(item) ? 'Serial (required)' : 'Serial (optional)'}
                            rows={2}
                            className={`w-full bg-slate-800 border rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none ${
                              isSerialRequiredItem(item) && !item.selectedSerialNumbers?.length ? 'border-red-500' : 'border-slate-600'
                            }`}
                          />
                          <button
                            onClick={() => startScanner(item.id)}
                            disabled={isProjectLocked}
                            className="w-full py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold active:bg-blue-500/30"
                          >
                            <Camera size={12} className="inline mr-1" />
                            Scan
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <button
                    onClick={handleSaveEquipment}
                    disabled={isProjectLocked}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm active:bg-emerald-700 disabled:opacity-60"
                  >
                    <Save size={14} className="inline mr-1" />
                    Save Equipment
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Extra Items */}
          <div>
            <button
              onClick={() => toggleSection('extra')}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
            >
              <span className="font-bold text-white text-sm">Extra Materials ({extraItems.length})</span>
              {expandedSections.has('extra') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.has('extra') && (
              <div className="mt-2 space-y-2">
                {extraItems.map(item => (
                  <div key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={e => handleExtraItemChange(item.id, 'description', e.target.value)}
                      disabled={isProjectLocked}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity || 0}
                        onChange={e => handleExtraItemChange(item.id, 'quantity', Number(e.target.value))}
                        disabled={isProjectLocked}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={item.unit}
                        onChange={e => handleExtraItemChange(item.id, 'unit', e.target.value)}
                        disabled={isProjectLocked}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.netPrice || 0}
                        onChange={e => handleExtraItemChange(item.id, 'netPrice', Number(e.target.value))}
                        disabled={isProjectLocked}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveExtraItem(item.id)}
                      disabled={isProjectLocked}
                      className="w-full py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold active:bg-red-500/30"
                    >
                      <Minus size={12} className="inline mr-1" />
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddExtraItem}
                  disabled={isProjectLocked}
                  className="w-full py-2 bg-emerald-600/30 text-emerald-400 rounded-lg font-semibold text-sm active:bg-emerald-600/50"
                >
                  <Plus size={14} className="inline mr-1" />
                  Add Extra Item
                </button>
              </div>
            )}
          </div>

          {/* Summary */}
          {(equipmentData.length > 0 || extraItems.length > 0) && (
            <div>
              <button
                onClick={() => toggleSection('summary')}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
              >
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <TrendingUp size={14} />
                  Summary
                </span>
                {expandedSections.has('summary') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.has('summary') && (
                <div className="mt-2 bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Quoted:</span>
                    <span className="font-bold text-white">{summary.originalTotal.toFixed(2)} RON</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Actual:</span>
                    <span className="font-bold text-white">{summary.actualTotal.toFixed(2)} RON</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 flex justify-between">
                    <span className="text-slate-300">Variance:</span>
                    <span className={`font-bold ${summary.variance > 0 ? 'text-red-400' : summary.variance < 0 ? 'text-green-400' : 'text-white'}`}>
                      {summary.variance > 0 ? '+' : ''}{summary.variance.toFixed(2)} RON
                    </span>
                  </div>
                  {extraItems.length > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span>+ Extra:</span>
                      <span className="font-bold">{summary.extraTotal.toFixed(2)} RON</span>
                    </div>
                  )}
                  <div className="border-t border-slate-700 pt-2 flex justify-between">
                    <span className="text-slate-300 font-bold">Total Diff:</span>
                    <span className={`font-bold text-lg ${summary.totalVariance > 0 ? 'text-red-400' : summary.totalVariance < 0 ? 'text-green-400' : 'text-white'}`}>
                      {summary.totalVariance > 0 ? '+' : ''}{summary.totalVariance.toFixed(2)} RON
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          <div>
            <button
              onClick={() => toggleSection('photos')}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
            >
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Camera size={14} />
                Photos ({installationPhotos.length})
              </span>
              {expandedSections.has('photos') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.has('photos') && (
              <div className="mt-2 space-y-2">
                <label className="block">
                  <input
                    type="file"
                    onChange={handleInstallationPhotoUpload}
                    disabled={isProjectLocked}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isProjectLocked}
                    onClick={() => document.querySelector('input[type="file"][accept="image/*"]')?.dispatchEvent(new MouseEvent('click'))}
                    className="w-full py-2 bg-emerald-600/30 text-emerald-400 rounded-lg font-semibold text-sm active:bg-emerald-600/50 disabled:opacity-60"
                  >
                    <Camera size={14} className="inline mr-1" />
                    Add Photo
                  </button>
                </label>
                {installationPhotos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {installationPhotos.map(photo => (
                      <div key={photo.id} className="relative group">
                        <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                          <img src={photo.url} alt="Installation" className="w-full h-full object-cover" />
                        </div>
                        <button
                          onClick={() => handleRemoveInstallationPhoto(photo.id)}
                          disabled={isProjectLocked}
                          className="absolute top-1 right-1 p-1 bg-red-500 rounded opacity-0 group-hover:opacity-100"
                        >
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {installationPhotos.length > 0 && (
                  <div className="space-y-2">
                    {installationPhotos.map(photo => (
                      <input
                        key={photo.id}
                        type="text"
                        placeholder="Photo description…"
                        value={photo.description}
                        onChange={e => handleUpdatePhotoDescription(photo.id, e.target.value)}
                        disabled={isProjectLocked}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Report */}
          <div>
            <button
              onClick={() => toggleSection('report')}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
            >
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <FileText size={14} />
                Completion Report
              </span>
              {expandedSections.has('report') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSections.has('report') && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={finalReport}
                  onChange={e => {
                    setFinalReport(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  disabled={isProjectLocked}
                  placeholder="Installation status, work completed, notes, recommendations…"
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none disabled:opacity-60"
                />
                <button
                  onClick={handleSaveInstallationData}
                  disabled={isSaving || isProjectLocked}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm active:bg-emerald-700 disabled:opacity-60"
                >
                  <Save size={14} className="inline mr-1" />
                  {isSaving ? 'Saving…' : 'Save Report'}
                </button>
                {!isProjectLocked && (
                  <button
                    onClick={handleDeclareFinish}
                    disabled={missingSerials.length > 0}
                    className="w-full py-2 bg-amber-500 text-slate-900 rounded-lg font-semibold text-sm active:bg-amber-400 disabled:opacity-60"
                  >
                    Declare Finished
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Locked mention */}
          {isProjectLocked && (
            <div>
              <button
                onClick={() => toggleSection('mention')}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
              >
                <span className="font-bold text-white text-sm">Mention Admin</span>
                {expandedSections.has('mention') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.has('mention') && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={lockedProjectMention}
                    onChange={e => setLockedProjectMention(e.target.value)}
                    placeholder="Leave a message for admin…"
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                  />
                  <button
                    onClick={handleSubmitLockedMention}
                    disabled={isSendingMention || !lockedProjectMention.trim()}
                    className="w-full py-2 bg-amber-500 text-slate-900 rounded-lg font-semibold text-sm active:bg-amber-400 disabled:opacity-60"
                  >
                    Send Mention
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          {client.documents?.length > 0 && (
            <div>
              <button
                onClick={() => toggleSection('docs')}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-between"
              >
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <FileText size={14} />
                  Documents ({client.documents.length})
                </span>
                {expandedSections.has('docs') ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {expandedSections.has('docs') && (
                <div className="mt-2 space-y-2">
                  {client.documents.map(doc => (
                    <div key={doc.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{doc.name}</p>
                        <p className="text-[10px] text-slate-500">{doc.type}</p>
                      </div>
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1 text-emerald-400 hover:bg-slate-700 rounded"
                      >
                        <Camera size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Document Preview */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-700">
              <p className="text-white font-bold text-sm truncate">{previewDoc.name}</p>
              <button onClick={() => setPreviewDoc(null)} className="p-1 hover:bg-slate-700 rounded">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-900">
              {previewDoc.url.startsWith('data:image') ? (
                <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full h-auto mx-auto" />
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">Preview not available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scanner */}
      {scannerOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">Scan Serial Number</h3>
              <button onClick={closeScanner} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="bg-black rounded-lg overflow-hidden border border-slate-700 mb-2">
              <video ref={scannerVideoRef} className="w-full h-[240px] object-cover" muted playsInline />
            </div>
            {scannerError && <p className="text-xs text-red-300 mb-2">{scannerError}</p>}
            <p className="text-xs text-slate-400">Point camera at barcode. If fails, enter serial manually.</p>
          </div>
        </div>
      )}
    </div>
  );
}
