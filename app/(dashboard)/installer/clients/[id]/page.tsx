'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, User, MapPin, Phone, Mail, FileText, Upload, Download, Eye, Package, AlertCircle, 
  X, Image as ImageIcon, Plus, Minus, Save, Camera, TrendingUp, ListChecks,
  FolderOpen, ChevronDown, ChevronUp, CheckCircle
} from 'lucide-react';
import { ClientDocument, EquipmentTrackingEntry, QuoteLineItem } from '@/types';
import {
  aggregateEquipmentTrackingEntries,
  buildEquipmentTrackingEntryId,
  findMatchingQuoteLineItem,
  startOfLocalDay,
  toWorkDateKey,
} from '@/lib/equipmentTracking';
import { getAssignedInstallerNames, isInstallerAssignedToQuote } from '@/lib/installerAssignments';

interface EnhancedQuoteItem extends QuoteLineItem {
  actuallyUsed?: number;
  quotedQuantity?: number;
  barcode?: string;
  hasBarcode?: boolean;
  originalLineItemId?: string;
}

const SERIAL_REQUIRED_REGEX = /(inverter|invertor|battery|baterie|acumulator)/i;

const normalizeInventoryName = (value?: string) => (value || '').trim().toLocaleLowerCase();

const createBlankTrackingRow = (): EnhancedQuoteItem => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  description: '',
  unit: 'buc',
  quantity: 0,
  quotedQuantity: 0,
  netPrice: 0,
  actuallyUsed: 0,
  selectedSerialNumbers: [],
});

const isMeaningfulTrackingRow = (item: EnhancedQuoteItem) => {
  return Boolean(
    item.description.trim() ||
      item.inventoryItemId ||
      item.actuallyUsed ||
      item.netPrice ||
      (item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0)
  );
};

export default function InstallerClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { clients, updateClient, savedQuotes, inventory, saveQuote, equipmentTrackingEntries, saveEquipmentTrackingEntry } = useData();
  const { currentUser } = useAuth();
  const clientId = params?.id as string;
  const todayWorkDate = useMemo(() => startOfLocalDay(new Date()), []);

  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'CI' | 'CF' | 'Fact' | 'CUI' | 'Other'>('Other');
  const [uploadDescription, setUploadDescription] = useState('');
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [showImages, setShowImages] = useState(false);
  const [mainEquipmentData, setMainEquipmentData] = useState<EnhancedQuoteItem[]>([]);
  const [mainExtraItems, setMainExtraItems] = useState<EnhancedQuoteItem[]>([]);
  const [equipmentData, setEquipmentData] = useState<EnhancedQuoteItem[]>([]);
  const [installationPhotos, setInstallationPhotos] = useState<Array<{id: string, url: string, description: string, timestamp: Date, uploadedBy?: string, uploadedAt?: Date}>>([]);
  const [finalReport, setFinalReport] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isTrackingEntryOpen, setIsTrackingEntryOpen] = useState(false);
  const [openedTrackingEntryId, setOpenedTrackingEntryId] = useState<string | null>(null);
  const [editingWorkDate, setEditingWorkDate] = useState<Date | null>(null);
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

  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerTickRef = useRef<number | null>(null);

  const client = clients.find(c => c.id === clientId);

  const clientQuotes = useMemo(() => {
    const quotes = savedQuotes.filter(q => q.clientId === clientId);
    return quotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [savedQuotes, clientId]);

  const selectedProject = useMemo(
    () => clientQuotes.find((quote) => quote.id === selectedProjectId) || null,
    [clientQuotes, selectedProjectId]
  );

  const allQuoteItems = useMemo(
    () => selectedProject?.items || [],
    [selectedProject]
  );

  const currentInstallerId = currentUser?.id || currentUser?.nickname || 'unknown-installer';

  const projectTrackingEntries = useMemo(() => {
    if (!selectedProject) return [];
    return equipmentTrackingEntries
      .filter((entry) => entry.quoteId === selectedProject.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [equipmentTrackingEntries, selectedProject]);

  const installerProjectEntries = useMemo(() => {
    if (!currentUser) return [];
    return projectTrackingEntries.filter(
      (entry) => entry.installerId === currentUser.id || entry.installerNickname === currentUser.nickname
    );
  }, [projectTrackingEntries, currentUser]);

  const activeTrackingEntry = useMemo(() => {
    return installerProjectEntries.find(
      (entry) => toWorkDateKey(new Date(entry.workDate)) === toWorkDateKey(todayWorkDate)
    ) || null;
  }, [installerProjectEntries, todayWorkDate]);

  const openedTrackingEntry = useMemo(() => {
    if (!openedTrackingEntryId) {
      return null;
    }

    return installerProjectEntries.find((entry) => entry.id === openedTrackingEntryId) || null;
  }, [installerProjectEntries, openedTrackingEntryId]);

  useEffect(() => {
    if (clientQuotes.length === 0) {
      setSelectedProjectId('');
      return;
    }

    if (selectedProjectId && !clientQuotes.some((quote) => quote.id === selectedProjectId)) {
      setSelectedProjectId('');
    }
  }, [clientQuotes, selectedProjectId]);

  useEffect(() => {
    setIsTrackingEntryOpen(false);
    setOpenedTrackingEntryId(null);
    setEditingWorkDate(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      setMainEquipmentData([]);
      setMainExtraItems([]);
      return;
    }

    const enhanced: EnhancedQuoteItem[] = allQuoteItems.map((item) => {
      const inventoryItem = inventory.find((inv) => inv.id === item.inventoryItemId);
      const savedConsumptionData = (selectedProject.consumptionData || []).find((cd) => cd.id === item.id);

      return {
        ...item,
        actuallyUsed: savedConsumptionData?.actuallyUsed ?? savedConsumptionData?.consumedQty ?? item.quantity,
        selectedSerialNumbers: savedConsumptionData?.selectedSerialNumbers ?? item.selectedSerialNumbers ?? [],
        quotedQuantity: item.quantity,
        barcode: inventoryItem?.barcode,
        hasBarcode: !!inventoryItem?.barcode,
      };
    });

    const savedExtraItems = (selectedProject.extraItems || [])
      .filter((item) => item.isExtra)
      .map((item) => ({
        ...item,
        quantity: item.actuallyUsed ?? item.consumedQty,
        actuallyUsed: item.actuallyUsed ?? item.consumedQty,
      } as EnhancedQuoteItem));

    setMainEquipmentData(enhanced);
    setMainExtraItems(savedExtraItems);
  }, [selectedProject, allQuoteItems, inventory]);

  const toggleProjectExpanded = (quoteId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) {
        next.delete(quoteId);
      } else {
        next.add(quoteId);
      }
      return next;
    });
  };

  // Initialize data for selected project
  useEffect(() => {
    if (!selectedProject || !isTrackingEntryOpen) {
      setEquipmentData([]);
      setInstallationPhotos([]);
      setFinalReport('');
      setGroundingValue('');
      setLowVoltageCableCheck('');
      setHasUnsavedChanges(false);
      setIsInitialized(false);
      return;
    }

    const entryToLoad = openedTrackingEntry || (
      editingWorkDate && toWorkDateKey(editingWorkDate) === toWorkDateKey(todayWorkDate)
        ? activeTrackingEntry
        : null
    );

    if (!entryToLoad) {
      setEquipmentData([createBlankTrackingRow()]);
      setInstallationPhotos([]);
      setFinalReport('');
      setGroundingValue('');
      setLowVoltageCableCheck('');
      setLockedProjectMention('');
      setHasUnsavedChanges(false);
      setIsInitialized(true);
      return;
    }

    const trackedRows = [...entryToLoad.items, ...entryToLoad.extraItems].map((item) => {
      const matchedQuoteItem = findMatchingQuoteLineItem(selectedProject, item);
      const inventoryItem = inventory.find((inv) => inv.id === (item.inventoryItemId || matchedQuoteItem?.inventoryItemId));

      return {
        id: item.id,
        description: item.description,
        unit: item.unit,
        quantity: matchedQuoteItem?.quantity || item.quotedQty || 0,
        quotedQuantity: matchedQuoteItem?.quantity || item.quotedQty || 0,
        netPrice: item.netPrice,
        actuallyUsed: item.consumedQty || item.actuallyUsed || 0,
        selectedSerialNumbers: item.selectedSerialNumbers || [],
        inventoryItemId: item.inventoryItemId || matchedQuoteItem?.inventoryItemId,
        originalLineItemId: matchedQuoteItem?.id || item.originalLineItemId,
        barcode: item.barcode || inventoryItem?.barcode,
        hasBarcode: item.hasBarcode || !!inventoryItem?.barcode,
      } as EnhancedQuoteItem;
    });

    const projectPhotos = (entryToLoad.installationPhotos || []).map(photo => ({
      ...photo,
      description: photo.description ?? '',
      timestamp: new Date(photo.timestamp),
      uploadedAt: photo.uploadedAt ? new Date(photo.uploadedAt) : undefined,
    }));

    setEquipmentData(trackedRows.length > 0 ? trackedRows : [createBlankTrackingRow()]);
    setInstallationPhotos(projectPhotos);
    setFinalReport(entryToLoad.notes || '');
    setGroundingValue(entryToLoad.groundingValue || '');
    setLowVoltageCableCheck(entryToLoad.lowVoltageCableCheck || '');
    setLockedProjectMention('');
    setHasUnsavedChanges(false);
    setIsInitialized(true);
  }, [selectedProject, inventory, isTrackingEntryOpen, openedTrackingEntry, activeTrackingEntry, editingWorkDate, todayWorkDate]);

  const isProjectLocked = !!selectedProject?.adminApprovedAt;

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

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Detect changes in photos or report
  useEffect(() => {
    if (isInitialized) {
      // This will be true if user has made changes
      // We'll set this when photos/report are modified
    }
  }, [isInitialized]);

  const currentEntrySummary = useMemo(() => {
    if (!selectedProject) {
      return {
        mainRows: [] as Array<{ row: EnhancedQuoteItem; matchedQuoteItem: { id: string; description: string; quantity: number; unit: string; netPrice: number; inventoryItemId?: string } }>,
        extraRows: [] as EnhancedQuoteItem[],
        mainRowsTotal: 0,
        extraRowsTotal: 0,
        quotedRowsTotal: 0,
        totalVariance: 0,
      };
    }

    const meaningfulRows = equipmentData.filter(isMeaningfulTrackingRow);
    const mainRows: Array<{ row: EnhancedQuoteItem; matchedQuoteItem: { id: string; description: string; quantity: number; unit: string; netPrice: number; inventoryItemId?: string } }> = [];
    const extraRows: EnhancedQuoteItem[] = [];

    meaningfulRows.forEach((row) => {
      const matchedQuoteItem = findMatchingQuoteLineItem(selectedProject, row);
      if (matchedQuoteItem) {
        mainRows.push({ row, matchedQuoteItem });
      } else {
        extraRows.push(row);
      }
    });

    const mainRowsTotal = mainRows.reduce(
      (sum, item) => sum + ((item.row.actuallyUsed || 0) * (item.row.netPrice || item.matchedQuoteItem.netPrice || 0)),
      0
    );
    const quotedRowsTotal = mainRows.reduce(
      (sum, item) => sum + ((item.row.actuallyUsed || 0) * item.matchedQuoteItem.netPrice),
      0
    );
    const extraRowsTotal = extraRows.reduce((sum, item) => sum + ((item.actuallyUsed || 0) * (item.netPrice || 0)), 0);

    return {
      mainRows,
      extraRows,
      mainRowsTotal,
      extraRowsTotal,
      quotedRowsTotal,
      totalVariance: (mainRowsTotal - quotedRowsTotal) + extraRowsTotal,
    };
  }, [equipmentData, selectedProject]);

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
    if (isProjectLocked) {
      showNotification('Project is closed by admin. Editing is locked until reopen.', 'error');
      return;
    }
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
    if (isProjectLocked) return;
    setEquipmentData(prev =>
      prev.map(item => item.id === itemId ? { ...item, actuallyUsed: value } : item)
    );
    setHasUnsavedChanges(true);
  };

  const handleMainQuantityChange = (itemId: string, value: number) => {
    if (isProjectLocked) return;
    setMainEquipmentData((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, actuallyUsed: value } : item))
    );
    setHasUnsavedChanges(true);
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 3500);
  };

  const parseSerialInput = (raw: string) => {
    return raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const updateSerialInput = (itemId: string, raw: string) => {
    if (isProjectLocked) return;
    const serials = parseSerialInput(raw);
    setEquipmentData(prev => prev.map(item =>
      item.id === itemId ? { ...item, selectedSerialNumbers: serials } : item
    ));
    setHasUnsavedChanges(true);
  };

  const isSerialRequiredItem = (item: EnhancedQuoteItem) => {
    const inv = inventory.find((i) => i.id === item.inventoryItemId);
    const byCategory = inv?.category === 'Inverters' || inv?.category === 'Batteries';
    const byDescription = SERIAL_REQUIRED_REGEX.test(item.description || '');
    return byCategory || byDescription;
  };

  const getRequiredSerialItems = () => {
    return equipmentData.filter((item) => isMeaningfulTrackingRow(item) && isSerialRequiredItem(item));
  };

  const getMissingRequiredSerialItems = () => {
    return getRequiredSerialItems().filter(item => !(item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0));
  };

  const updateMainSerialInput = (itemId: string, raw: string) => {
    if (isProjectLocked) return;
    const serials = parseSerialInput(raw);
    setMainEquipmentData((prev) => prev.map((item) =>
      item.id === itemId ? { ...item, selectedSerialNumbers: serials } : item
    ));
    setHasUnsavedChanges(true);
  };

  const getMainRequiredSerialItems = () => {
    return mainEquipmentData.filter((item) => isSerialRequiredItem(item));
  };

  const getMissingMainRequiredSerialItems = () => {
    return getMainRequiredSerialItems().filter((item) => !(item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0));
  };

  function stopScanner() {
    if (scannerTickRef.current) {
      window.clearInterval(scannerTickRef.current);
      scannerTickRef.current = null;
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach(track => track.stop());
      scannerStreamRef.current = null;
    }
  }

  const closeScanner = () => {
    stopScanner();
    setScannerOpen(false);
    setScannerError(null);
  };

  const appendScannedSerial = (itemId: string, scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;

    setEquipmentData(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const existing = item.selectedSerialNumbers || [];
      if (existing.includes(code)) return item;
      return { ...item, selectedSerialNumbers: [...existing, code] };
    }));
    setHasUnsavedChanges(true);
    showNotification('Serial number scanned and added.', 'success');
    closeScanner();
  };

  const handleCreateDailyTracking = () => {
    if (!selectedProject) {
      showNotification('Please select a project first.', 'error');
      return;
    }
    if (hasUnsavedChanges && !confirm('You have unsaved changes in the current daily entry. Continue anyway?')) {
      return;
    }

    setEditingWorkDate(todayWorkDate);
    setOpenedTrackingEntryId(activeTrackingEntry?.id || null);
    setIsTrackingEntryOpen(true);
  };

  const handleOpenTrackingHistoryEntry = (entry: EquipmentTrackingEntry) => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes in the current daily entry. Continue anyway?')) {
      return;
    }

    setEditingWorkDate(new Date(entry.workDate));
    setOpenedTrackingEntryId(entry.id);
    setIsTrackingEntryOpen(true);
  };

  const handleCloseTrackingEntry = () => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes in the current daily entry. Close it anyway?')) {
      return;
    }

    setIsTrackingEntryOpen(false);
    setOpenedTrackingEntryId(null);
    setEditingWorkDate(null);
  };

  const handleAddTrackingRow = () => {
    if (isProjectLocked) return;
    setEquipmentData((prev) => [...prev, createBlankTrackingRow()]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveTrackingRow = (itemId: string) => {
    if (isProjectLocked) return;
    setEquipmentData((prev) => {
      if (prev.length === 1) {
        return [createBlankTrackingRow()];
      }

      return prev.filter((item) => item.id !== itemId);
    });
    setHasUnsavedChanges(true);
  };

  const handleTrackingRowChange = (
    itemId: string,
    field: keyof EnhancedQuoteItem,
    value: string | number | string[] | undefined
  ) => {
    if (isProjectLocked) return;

    setEquipmentData((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextItem = { ...item, [field]: value };

        if (field === 'description') {
          const matchedInventoryItem = inventory.find(
            (inventoryItem) => normalizeInventoryName(inventoryItem.name) === normalizeInventoryName(String(value))
          );
          if (matchedInventoryItem) {
            nextItem.inventoryItemId = matchedInventoryItem.id;
            nextItem.unit = nextItem.unit || 'buc';
            nextItem.netPrice = nextItem.netPrice || matchedInventoryItem.buyPrice;
            nextItem.barcode = matchedInventoryItem.barcode;
            nextItem.hasBarcode = !!matchedInventoryItem.barcode;
          }

          const matchedQuoteItem = selectedProject ? findMatchingQuoteLineItem(selectedProject, nextItem) : undefined;
          nextItem.originalLineItemId = matchedQuoteItem?.id;
          nextItem.quotedQuantity = matchedQuoteItem?.quantity || 0;
          nextItem.quantity = matchedQuoteItem?.quantity || 0;
          if (matchedQuoteItem && !nextItem.netPrice) {
            nextItem.netPrice = matchedQuoteItem.netPrice;
          }
        }

        return nextItem;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleInventorySelectionChange = (itemId: string, inventoryItemId: string) => {
    if (isProjectLocked) return;

    const inventoryItem = inventory.find((inv) => inv.id === inventoryItemId);
    setEquipmentData((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextItem: EnhancedQuoteItem = {
          ...item,
          inventoryItemId: inventoryItemId || undefined,
          description: inventoryItem ? inventoryItem.name : item.description,
          unit: inventoryItem ? 'buc' : item.unit,
          netPrice: inventoryItem ? inventoryItem.buyPrice : item.netPrice,
          barcode: inventoryItem?.barcode,
          hasBarcode: !!inventoryItem?.barcode,
        };

        const matchedQuoteItem = selectedProject ? findMatchingQuoteLineItem(selectedProject, nextItem) : undefined;
        nextItem.originalLineItemId = matchedQuoteItem?.id;
        nextItem.quotedQuantity = matchedQuoteItem?.quantity || 0;
        nextItem.quantity = matchedQuoteItem?.quantity || 0;

        return nextItem;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleMainAddExtraItem = () => {
    if (isProjectLocked) return;
    setMainExtraItems((prev) => [
      ...prev,
      {
        id: `extra-${Date.now()}`,
        description: '',
        unit: 'buc',
        quantity: 0,
        netPrice: 0,
        actuallyUsed: 0,
      },
    ]);
    setHasUnsavedChanges(true);
  };

  const handleMainRemoveExtraItem = (itemId: string) => {
    if (isProjectLocked) return;
    setMainExtraItems((prev) => prev.filter((item) => item.id !== itemId));
    setHasUnsavedChanges(true);
  };

  const handleMainExtraItemChange = (itemId: string, field: keyof EnhancedQuoteItem, value: string | number) => {
    if (isProjectLocked) return;
    setMainExtraItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextItem = { ...item, [field]: value };
        if (field === 'description') {
          const matchedInventoryItem = inventory.find(
            (inventoryItem) => normalizeInventoryName(inventoryItem.name) === normalizeInventoryName(String(value))
          );
          if (matchedInventoryItem) {
            nextItem.inventoryItemId = matchedInventoryItem.id;
            nextItem.netPrice = nextItem.netPrice || matchedInventoryItem.buyPrice;
            nextItem.barcode = matchedInventoryItem.barcode;
            nextItem.hasBarcode = !!matchedInventoryItem.barcode;
          }
        }

        return nextItem;
      })
    );
    setHasUnsavedChanges(true);
  };

  const calculateMainVariance = (item: EnhancedQuoteItem) => {
    const quoted = item.quotedQuantity || item.quantity;
    const actual = item.actuallyUsed || 0;
    const diff = actual - quoted;
    const valueDiff = diff * item.netPrice;
    return { diff, valueDiff };
  };

  const calculateMainSummary = () => {
    const originalQuoteTotal = mainEquipmentData.reduce((sum, item) => sum + (item.quantity * item.netPrice), 0);
    const actualConsumptionTotal = mainEquipmentData.reduce((sum, item) => sum + ((item.actuallyUsed || 0) * item.netPrice), 0);
    const equipmentVariance = actualConsumptionTotal - originalQuoteTotal;
    const extraItemsTotal = mainExtraItems.reduce((sum, item) => sum + (((item.quantity || 0)) * (item.netPrice || 0)), 0);
    const totalVariance = equipmentVariance + extraItemsTotal;

    return {
      originalQuoteTotal,
      actualConsumptionTotal,
      equipmentVariance,
      extraItemsTotal,
      totalVariance,
    };
  };

  const handleSaveMainEquipment = async () => {
    try {
      if (!selectedProject) {
        alert('Please select a project first.');
        return;
      }
      if (isProjectLocked) {
        showNotification('Project is closed by admin. Editing is locked until reopen.', 'error');
        return;
      }

      const consumptionData = mainEquipmentData.map((item) => ({
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
        consumptionData,
        consumptionDataUpdatedAt: new Date(),
        consumptionDataUpdatedBy: currentUser?.nickname || 'Unknown',
        groundingValue,
        lowVoltageCableCheck: lowVoltageCableCheck || undefined,
        extraItems: mainExtraItems.map((item) => ({
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
      alert('✓ Equipment data saved successfully!');
    } catch (error) {
      console.error('Error saving equipment data:', error);
      alert('Failed to save equipment data');
    }
  };

  const startScanner = async (itemId: string) => {
    if (isProjectLocked) {
      showNotification('Project is closed by admin. Editing is locked until reopen.', 'error');
      return;
    }
    setScannerError(null);
    setScannerOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      scannerStreamRef.current = stream;

      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        await scannerVideoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code']
        });

        scannerTickRef.current = window.setInterval(async () => {
          if (!scannerVideoRef.current || scannerVideoRef.current.readyState < 2) return;

          try {
            const barcodes = await detector.detect(scannerVideoRef.current);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              appendScannedSerial(itemId, barcodes[0].rawValue);
            }
          } catch {
            // Ignore intermittent detector errors while camera is warming up.
          }
        }, 500);
      } else {
        setScannerError('Barcode scanning is not supported in this browser. Enter serial manually.');
      }
    } catch {
      setScannerError('Could not access camera. Please allow camera permission or enter serial manually.');
    }
  };

  const persistTrackingEntry = async ({
    status,
    phase,
    installerDeclaredFinishedAt,
  }: {
    status: EquipmentTrackingEntry['status'];
    phase?: 'planning' | 'in-progress' | 'pending-inspection' | 'completed' | 'archived';
    installerDeclaredFinishedAt?: Date;
  }) => {
    if (!selectedProject) {
      throw new Error('Please select a project first.');
    }

    const workDate = editingWorkDate || todayWorkDate;
    const now = new Date();
    const entryId = buildEquipmentTrackingEntryId(selectedProject.id, currentInstallerId, workDate);
    const meaningfulRows = equipmentData.filter(isMeaningfulTrackingRow);
    const entryItems = meaningfulRows.flatMap((item) => {
      const matchedQuoteItem = findMatchingQuoteLineItem(selectedProject, item);
      if (!matchedQuoteItem) {
        return [];
      }

      return [{
        id: item.id,
        description: item.description || matchedQuoteItem.description,
        quotedQty: matchedQuoteItem.quantity,
        consumedQty: item.actuallyUsed || 0,
        actuallyUsed: item.actuallyUsed || 0,
        selectedSerialNumbers: item.selectedSerialNumbers || [],
        unit: item.unit || matchedQuoteItem.unit,
        netPrice: item.netPrice || matchedQuoteItem.netPrice,
        originalLineItemId: matchedQuoteItem.id,
        inventoryItemId: item.inventoryItemId || matchedQuoteItem.inventoryItemId,
        barcode: item.barcode,
        hasBarcode: item.hasBarcode,
      }];
    });

    const entryExtraItems = meaningfulRows.flatMap((item) => {
      const matchedQuoteItem = findMatchingQuoteLineItem(selectedProject, item);
      if (matchedQuoteItem) {
        return [];
      }

      return [{
        id: item.id,
        description: item.description,
        quotedQty: 0,
        consumedQty: item.actuallyUsed || 0,
        actuallyUsed: item.actuallyUsed || 0,
        selectedSerialNumbers: item.selectedSerialNumbers || [],
        unit: item.unit,
        netPrice: item.netPrice,
        isExtra: true,
        inventoryItemId: item.inventoryItemId,
        barcode: item.barcode,
        hasBarcode: item.hasBarcode,
      }];
    });

    const nextEntry: EquipmentTrackingEntry = {
      id: openedTrackingEntry?.id || activeTrackingEntry?.id || entryId,
      quoteId: selectedProject.id,
      clientId,
      projectTitle: selectedProject.title,
      workDate,
      installerId: currentInstallerId,
      installerNickname: currentUser?.nickname || 'Unknown',
      status,
      items: entryItems,
      extraItems: entryExtraItems,
      installationPhotos,
      notes: finalReport || undefined,
      groundingValue: groundingValue || undefined,
      lowVoltageCableCheck: lowVoltageCableCheck || undefined,
      createdAt: openedTrackingEntry?.createdAt || activeTrackingEntry?.createdAt || now,
      updatedAt: now,
      submittedAt:
        status === 'submitted'
          ? openedTrackingEntry?.submittedAt || activeTrackingEntry?.submittedAt || now
          : openedTrackingEntry?.submittedAt || activeTrackingEntry?.submittedAt,
    };

    await saveEquipmentTrackingEntry(nextEntry);
    setOpenedTrackingEntryId(nextEntry.id);
    setEditingWorkDate(workDate);
    setIsTrackingEntryOpen(true);

    const aggregatedEntries = projectTrackingEntries
      .filter((entry) => entry.id !== nextEntry.id)
      .concat(nextEntry);
    const aggregate = aggregateEquipmentTrackingEntries(selectedProject, aggregatedEntries);

    await saveQuote({
      ...selectedProject,
      ...aggregate,
      phase: phase || selectedProject.phase || 'in-progress',
      installerDeclaredFinishedAt: installerDeclaredFinishedAt || selectedProject.installerDeclaredFinishedAt,
      installerDeclaredFinishedBy: installerDeclaredFinishedAt
        ? currentUser?.nickname || 'Unknown'
        : selectedProject.installerDeclaredFinishedBy,
    });
  };

  const handleSaveEquipment = async () => {
    try {
      if (!selectedProject) {
        alert('Please select a project first.');
        return;
      }
      if (!isTrackingEntryOpen) {
        showNotification('Create or open a daily tracking entry first.', 'error');
        return;
      }
      if (isProjectLocked) {
        showNotification('Project is closed by admin. Editing is locked until reopen.', 'error');
        return;
      }

      await persistTrackingEntry({ status: 'draft', phase: 'in-progress' });
      setHasUnsavedChanges(false);

      alert('✓ Equipment data saved successfully!');
      console.log('Saved consumption data:', { equipmentData });
    } catch (error) {
      console.error('Error saving equipment data:', error);
      alert('Failed to save equipment data');
    }
  };

  const handleBarcodeScan = (itemId: string) => {
    startScanner(itemId);
  };

  const handleInstallationPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProjectLocked) {
      showNotification('Project is closed by admin. Editing is locked until reopen.', 'error');
      return;
    }
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
    if (isProjectLocked) return;
    setInstallationPhotos(prev => prev.filter(p => p.id !== photoId));
    setHasUnsavedChanges(true);
  };

  const handleUpdatePhotoDescription = (photoId: string, description: string) => {
    if (isProjectLocked) return;
    setInstallationPhotos(prev =>
      prev.map(p => p.id === photoId ? { ...p, description } : p)
    );
    setHasUnsavedChanges(true);
  };

  // Save installation photos and report
  const handleSaveInstallationData = async () => {
    try {
      if (!selectedProject) {
        alert('Please select a project first.');
        return;
      }
      if (!isTrackingEntryOpen) {
        showNotification('Create or open a daily tracking entry first.', 'error');
        return;
      }
      if (isProjectLocked) {
        showNotification('Project is closed by admin. Editing is locked until reopen.', 'error');
        return;
      }

      setIsSaving(true);

      await persistTrackingEntry({ status: 'draft', phase: selectedProject.phase || 'in-progress' });

      setHasUnsavedChanges(false);
      alert('✓ Installation photos and report saved successfully!');
    } catch (error) {
      console.error('Error saving installation data:', error);
      alert('Failed to save installation data');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeclareFinish = async () => {
    if (!selectedProject) {
      showNotification('Please select a project first.', 'error');
      return;
    }
    if (!isTrackingEntryOpen) {
      showNotification('Create or open a daily tracking entry first.', 'error');
      return;
    }
    if (isProjectLocked) {
      showNotification('Project is already closed by admin.', 'info');
      return;
    }

    const missingSerialItems = getMissingRequiredSerialItems();
    if (missingSerialItems.length > 0) {
      showNotification('This project has to include serial numbers for inverter and battery before declaring finish.', 'error');
      return;
    }

    try {
      await persistTrackingEntry({
        status: 'submitted',
        phase: 'pending-inspection',
        installerDeclaredFinishedAt: new Date(),
      });
      setHasUnsavedChanges(false);
      showNotification('Project declared finished. Admin has been notified for review.', 'success');
    } catch (error) {
      console.error('Error declaring project finish:', error);
      showNotification('Failed to declare finish. Please try again.', 'error');
    }
  };

  const missingRequiredSerialItems = getMissingRequiredSerialItems();
  const hasMissingRequiredSerials = missingRequiredSerialItems.length > 0;

  const handleSubmitLockedMention = async () => {
    if (!selectedProject) return;
    const message = lockedProjectMention.trim();
    if (!message) {
      showNotification('Please write a mention first.', 'error');
      return;
    }

    setIsSendingMention(true);
    try {
      const mentions = selectedProject.installerMentions || [];
      const mention = {
        id: `${Date.now()}`,
        message,
        createdAt: new Date(),
        createdBy: currentUser?.nickname || 'Unknown',
      };

      await saveQuote({
        ...selectedProject,
        installerMentions: [mention, ...mentions],
      });

      setLockedProjectMention('');
      showNotification('Mention sent to admin notifications.', 'success');
    } catch (error) {
      console.error('Error sending mention:', error);
      showNotification('Failed to send mention. Please try again.', 'error');
    } finally {
      setIsSendingMention(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`rounded-lg border px-4 py-3 shadow-lg min-w-[280px] ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
              : notification.type === 'error'
                ? 'bg-red-500/10 border-red-500/50 text-red-300'
                : 'bg-blue-500/10 border-blue-500/50 text-blue-300'
          }`}>
            {notification.message}
          </div>
        </div>
      )}

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

      {selectedProject && isProjectLocked && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/40 rounded-lg">
          <p className="text-green-300 font-semibold text-sm">
            This project is finished and closed by admin. Editing is disabled until admin reopens it.
          </p>
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

        {/* Client Projects */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <FolderOpen size={16} className="text-emerald-500" />
              Projects ({clientQuotes.length})
            </h3>
          </div>

          {clientQuotes.length > 0 ? (
            <div className="divide-y divide-slate-700">
              {clientQuotes.map((quote) => {
                const isSelected = quote.id === selectedProjectId;
                const isExpanded = expandedProjects.has(quote.id);
                const isAssignedToCurrentInstaller = isInstallerAssignedToQuote(quote, currentUser);

                return (
                  <div key={quote.id} className="bg-slate-800">
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-700/40 transition-colors">
                      <button
                        onClick={() => toggleProjectExpanded(quote.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div className={`p-1.5 rounded ${isExpanded ? 'bg-slate-700' : 'bg-slate-700/50'}`}>
                          {isExpanded ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold text-sm ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                              {quote.title || 'Untitled Project'}
                            </p>
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded flex items-center gap-1">
                                <CheckCircle size={12} /> ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Created: {new Date(quote.date).toLocaleDateString('ro-RO')} • Total: {quote.totalGross.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          const isUnloadingCurrent = quote.id === selectedProjectId;

                          if (hasUnsavedChanges && !confirm('You have unsaved changes for the current project. Continue anyway?')) {
                            return;
                          }

                          setSelectedProjectId(isUnloadingCurrent ? '' : quote.id);
                          setExpandedProjects((prev) => {
                            const next = new Set(prev);
                            if (isUnloadingCurrent) {
                              next.delete(quote.id);
                            } else {
                              next.add(quote.id);
                            }
                            return next;
                          });
                        }}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded font-bold text-xs transition-colors"
                      >
                        {isSelected ? 'Unload' : 'Load'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs mb-4">
                          <div>
                            <span className="text-slate-500">Customer:</span>
                            <span className="ml-2 text-white font-semibold">{quote.customerName}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Items:</span>
                            <span className="ml-2 text-white font-semibold">{quote.items.length}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Phase:</span>
                            <span className="ml-2 text-white font-semibold capitalize">{quote.phase || 'planning'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Installer:</span>
                            <span className="ml-2 text-white font-semibold">{getAssignedInstallerNames(quote).join(', ') || '-'}</span>
                          </div>
                        </div>

                        {isAssignedToCurrentInstaller && (
                          <div className="mb-4">
                            <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Assigned to you
                            </span>
                          </div>
                        )}

                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Project Items:</p>
                          <div className="space-y-1 text-xs">
                            {quote.items.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="flex justify-between text-slate-300">
                                <span className="truncate flex-1 pr-2">{item.description}</span>
                                <span className="text-slate-400">{item.quantity} {item.unit}</span>
                              </div>
                            ))}
                            {quote.items.length > 5 && (
                              <p className="text-slate-500 italic">...and {quote.items.length - 5} more items</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 bg-slate-900/40">
              No projects found for this client.
            </div>
          )}
        </section>

        {!selectedProject && clientQuotes.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-slate-400">
            Select and load a project to view equipment, photos, and report data.
          </div>
        )}

        {/* Project-specific sections */}
        {selectedProject && client.needs && (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-900/50 rounded p-4 border border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Valoare impamantare</p>
                <input
                  type="text"
                  value={groundingValue}
                  onChange={(e) => {
                    setGroundingValue(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  disabled={isProjectLocked}
                  placeholder="Introdu valoarea masurata"
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="bg-slate-900/50 rounded p-4 border border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Verificare cabluri de joasa tensiune</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (isProjectLocked) return;
                      setLowVoltageCableCheck('Corespunde');
                      setHasUnsavedChanges(true);
                    }}
                    disabled={isProjectLocked}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      lowVoltageCableCheck === 'Corespunde'
                        ? 'bg-green-500 text-white'
                        : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                    }`}
                  >
                    Corespunde
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isProjectLocked) return;
                      setLowVoltageCableCheck('Nu corespunde');
                      setHasUnsavedChanges(true);
                    }}
                    disabled={isProjectLocked}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                      lowVoltageCableCheck === 'Nu corespunde'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                    }`}
                  >
                    Nu corespunde
                  </button>
                </div>
              </div>
            </div>

            {client.needs.technicalNotes && (
              <div className="mt-4 bg-slate-900/50 rounded p-4">
                <p className="text-xs text-slate-500 mb-2">Technical Notes</p>
                <p className="text-sm text-slate-300">{client.needs.technicalNotes}</p>
              </div>
            )}
          </div>
        )}

        {selectedProject && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-200">Daily tracking</p>
                <p className="text-xs text-blue-100/80 mt-1">
                  Start today&apos;s daily tracking explicitly and record only what was used today in a blank editable table.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={handleCreateDailyTracking}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <Plus size={16} />
                  {activeTrackingEntry ? "Open Today's Daily Tracking" : 'Create New Daily Tracking'}
                </button>
                {isTrackingEntryOpen && (
                  <button
                    type="button"
                    onClick={handleCloseTrackingEntry}
                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-600"
                  >
                    Close Daily Tracking
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-blue-100/80">
              <div className="rounded-lg border border-blue-500/20 bg-slate-900/40 p-3">
                <p className="text-blue-100/60 mb-1">Today</p>
                <p className="font-semibold text-blue-100">{todayWorkDate.toLocaleDateString('ro-RO')}</p>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-slate-900/40 p-3">
                <p className="text-blue-100/60 mb-1">Project entries</p>
                <p className="font-semibold text-blue-100">{projectTrackingEntries.length}</p>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-slate-900/40 p-3">
                <p className="text-blue-100/60 mb-1">Your entries</p>
                <p className="font-semibold text-blue-100">{installerProjectEntries.length}</p>
              </div>
            </div>

            {installerProjectEntries.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-100/70 mb-2">Your daily entries</p>
                <div className="flex flex-wrap gap-2">
                  {installerProjectEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleOpenTrackingHistoryEntry(entry)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${openedTrackingEntryId === entry.id ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 bg-slate-900/50 text-slate-200 hover:border-slate-500 hover:bg-slate-800'}`}
                    >
                      {new Date(entry.workDate).toLocaleDateString('ro-RO')} • {entry.status}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isTrackingEntryOpen && (
              <>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <ListChecks size={24} className="text-emerald-500" />
                        Daily Summary
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Summary for {new Date(editingWorkDate || todayWorkDate).toLocaleDateString('ro-RO')} based only on this daily entry.
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${openedTrackingEntry?.status === 'submitted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {openedTrackingEntry?.status || activeTrackingEntry?.status || 'draft'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Main Quote Rows</p>
                      <p className="text-2xl font-bold text-white">{currentEntrySummary.mainRows.length}</p>
                      <p className="text-sm text-slate-400 mt-1">{currentEntrySummary.mainRowsTotal.toFixed(2)} RON used today</p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Extra Rows</p>
                      <p className="text-2xl font-bold text-white">{currentEntrySummary.extraRows.length}</p>
                      <p className="text-sm text-slate-400 mt-1">{currentEntrySummary.extraRowsTotal.toFixed(2)} RON added today</p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Daily Difference</p>
                      <p className={`text-2xl font-bold ${currentEntrySummary.totalVariance > 0 ? 'text-red-400' : currentEntrySummary.totalVariance < 0 ? 'text-green-400' : 'text-white'}`}>
                        {currentEntrySummary.totalVariance > 0 ? '+' : ''}{currentEntrySummary.totalVariance.toFixed(2)} RON
                      </p>
                      <p className="text-sm text-slate-400 mt-1">Compared with matched quote pricing</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Package size={24} className="text-emerald-500" />
                        Daily Tracking Table
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Enter today&apos;s used materials manually. Pick from inventory when available, or type freely when not.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleAddTrackingRow}
                        disabled={isProjectLocked}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-600 disabled:opacity-60"
                      >
                        <Plus size={16} />
                        Add Row
                      </button>
                      <button
                        onClick={handleSaveEquipment}
                        disabled={isProjectLocked}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-600 disabled:opacity-60"
                      >
                        <Save size={16} />
                        Save Daily Tracking
                      </button>
                    </div>
                  </div>

                  {missingRequiredSerialItems.length > 0 && (
                    <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                      Serial numbers are mandatory for inverter and battery rows before finishing the project.
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                      <thead className="border-b border-slate-700">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Inventory</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Description</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Unit</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Used Today</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Main / Extra</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Net Price</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Serials</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {equipmentData.map((item) => {
                          const matchedQuoteItem = selectedProject ? findMatchingQuoteLineItem(selectedProject, item) : undefined;
                          const inventoryItem = inventory.find((inv) => inv.id === item.inventoryItemId);
                          const serialRequired = isMeaningfulTrackingRow(item) && isSerialRequiredItem(item);
                          const canShowSerialControls = serialRequired || item.hasBarcode || Boolean(item.selectedSerialNumbers?.length);
                          return (
                            <tr key={item.id} className="align-top hover:bg-slate-700/20">
                              <td className="px-3 py-3">
                                <select
                                  value={item.inventoryItemId || ''}
                                  onChange={(e) => handleInventorySelectionChange(item.id, e.target.value)}
                                  disabled={isProjectLocked}
                                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                  <option value="">Manual item</option>
                                  {inventory.map((inventoryRow) => (
                                    <option key={inventoryRow.id} value={inventoryRow.id}>
                                      {inventoryRow.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleTrackingRowChange(item.id, 'description', e.target.value)}
                                  disabled={isProjectLocked}
                                  placeholder="Enter item name"
                                  list="inventory-item-suggestions"
                                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <input type="text" value={item.unit} onChange={(e) => handleTrackingRowChange(item.id, 'unit', e.target.value)} disabled={isProjectLocked} placeholder="buc / m" className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                              </td>
                              <td className="px-3 py-3 text-center">
                                <input type="number" value={item.actuallyUsed || 0} onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))} disabled={isProjectLocked} min="0" step="0.01" className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-center text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                              </td>
                              <td className="px-3 py-3">
                                {matchedQuoteItem ? (
                                  <div>
                                    <span className="inline-flex rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">Main quote item</span>
                                    <p className="mt-1 text-xs text-slate-400">Quoted {matchedQuoteItem.quantity} {matchedQuoteItem.unit}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-300">Extra material</span>
                                    <p className="mt-1 text-xs text-slate-500">Will be listed outside the main quote.</p>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <input type="number" value={item.netPrice || 0} onChange={(e) => handleTrackingRowChange(item.id, 'netPrice', Number(e.target.value))} disabled={isProjectLocked} min="0" step="0.01" className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-right text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                <p className="mt-1 text-xs text-slate-500">RON</p>
                              </td>
                              <td className="px-3 py-3">
                                {canShowSerialControls ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={(item.selectedSerialNumbers || []).join(', ')}
                                      onChange={(e) => updateSerialInput(item.id, e.target.value)}
                                      disabled={isProjectLocked}
                                      placeholder={serialRequired ? 'Serial number required' : 'Serial number optional'}
                                      className={`w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${serialRequired && (!item.selectedSerialNumbers || item.selectedSerialNumbers.length === 0) ? 'border-red-500/70' : 'border-slate-600'}`}
                                    />
                                    <div className="flex items-center gap-2">
                                      <button type="button" onClick={() => handleBarcodeScan(item.id)} disabled={isProjectLocked} className="inline-flex items-center gap-2 rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/25">
                                        <Camera size={14} />
                                        Scan
                                      </button>
                                      {serialRequired && <span className="text-[11px] font-semibold text-red-300">Required</span>}
                                      {!inventoryItem?.barcode && <span className="text-[11px] text-slate-500">Manual entry allowed</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500">No serials needed</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button type="button" onClick={() => handleRemoveTrackingRow(item.id)} disabled={isProjectLocked} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-60" title="Remove row">
                                  <Minus size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                    <h3 className="text-sm font-semibold text-slate-200 mb-2">Daily Tracking Notes</h3>
                    <textarea
                      value={finalReport}
                      onChange={(e) => {
                        if (isProjectLocked) return;
                        setFinalReport(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      disabled={isProjectLocked}
                      placeholder="Add notes or mention what happened during this daily tracking..."
                      className="w-full h-28 rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                    <p className="mt-2 text-xs text-slate-500">These notes are saved with this daily entry and visible in admin history.</p>
                  </div>
                </div>
              </>
            )}

            <datalist id="inventory-item-suggestions">
              {inventory.map((inventoryItem) => (
                <option key={inventoryItem.id} value={inventoryItem.name} />
              ))}
            </datalist>
          </div>
        )}

        {/* Onsite Pictures */}
        {selectedProject && client.needs?.siteImages && client.needs.siteImages.length > 0 && (
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

        {/* Main Equipment List with Quantity Tracking */}
        {selectedProject && mainEquipmentData.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Package size={24} className="text-emerald-500" />
              Equipment List & Usage Tracking
            </h2>

            {getMissingMainRequiredSerialItems().length > 0 && (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                Serial numbers are mandatory for inverter and battery. Add them before any save or finish action.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b-2 border-slate-700">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-400 pb-3 px-4">Item</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Quoted Qty</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Actually Used</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Difference</th>
                    <th className="text-right text-xs font-semibold text-slate-400 pb-3 px-4">Value Diff</th>
                    <th className="text-center text-xs font-semibold text-slate-400 pb-3 px-4">Serial / Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {mainEquipmentData.map((item) => {
                    const { diff, valueDiff } = calculateMainVariance(item);
                    const invItem = inventory.find((inv) => inv.id === item.inventoryItemId);
                    const serialRequired = isSerialRequiredItem(item);
                    const canShowSerialControls = serialRequired || item.hasBarcode;
                    const serialInputValue = (item.selectedSerialNumbers || []).join(', ');
                    return (
                      <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-3 px-4 text-slate-300">{item.description}</td>
                        <td className="py-3 px-4 text-center font-bold text-white">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              value={item.actuallyUsed || 0}
                              onChange={(e) => handleMainQuantityChange(item.id, Number(e.target.value))}
                              disabled={isProjectLocked}
                              min="0"
                              step="1"
                              className="w-24 bg-slate-900 border-2 border-slate-500 hover:border-emerald-500 rounded px-3 py-2 text-white text-center focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-colors cursor-text disabled:opacity-60"
                            />
                          </div>
                        </td>
                        <td className={`py-3 px-4 text-center font-bold ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                          {diff > 0 ? '+' : ''}{diff} {item.unit}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${valueDiff > 0 ? 'text-red-400' : valueDiff < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                          {valueDiff > 0 ? '+' : ''}{valueDiff.toFixed(2)} RON
                        </td>
                        <td className="py-3 px-4 text-center">
                          {canShowSerialControls ? (
                            <div className="flex flex-col gap-2 items-center">
                              <input
                                type="text"
                                value={serialInputValue}
                                onChange={(e) => updateMainSerialInput(item.id, e.target.value)}
                                disabled={isProjectLocked}
                                placeholder={serialRequired ? 'Serial number (required)' : 'Serial number (optional)'}
                                className={`w-56 bg-slate-900 border rounded px-2 py-1.5 text-white text-xs focus:ring-2 focus:ring-emerald-500 outline-none ${serialRequired && (!item.selectedSerialNumbers || item.selectedSerialNumbers.length === 0) ? 'border-red-500/70' : 'border-slate-600'} disabled:opacity-60`}
                              />
                              <span className="text-[10px] text-slate-500">Main tracker keeps the original project workflow.</span>
                              {serialRequired && (
                                <span className="text-[10px] text-red-300 font-semibold">MUST for inverter/battery</span>
                              )}
                              {!invItem?.barcode && (
                                <span className="text-[10px] text-slate-500">No inventory barcode set. Manual SN is allowed.</span>
                              )}
                            </div>
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

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Extra Materials Used</h3>
                <button
                  onClick={handleMainAddExtraItem}
                  disabled={isProjectLocked}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  <Plus size={16} />
                  Add Extra Item
                </button>
              </div>

              {mainExtraItems.length > 0 ? (
                <div className="space-y-3">
                  {mainExtraItems.map((item) => (
                    <div key={item.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                      <div className="grid grid-cols-12 gap-3 items-center">
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => handleMainExtraItemChange(item.id, 'description', e.target.value)}
                          disabled={isProjectLocked}
                          list="inventory-item-suggestions"
                          className="col-span-5 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleMainExtraItemChange(item.id, 'quantity', Number(e.target.value))}
                          disabled={isProjectLocked}
                          className="col-span-2 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={item.unit}
                          onChange={(e) => handleMainExtraItemChange(item.id, 'unit', e.target.value)}
                          disabled={isProjectLocked}
                          className="col-span-2 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={item.netPrice}
                          onChange={(e) => handleMainExtraItemChange(item.id, 'netPrice', Number(e.target.value))}
                          disabled={isProjectLocked}
                          className="col-span-2 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button
                          onClick={() => handleMainRemoveExtraItem(item.id)}
                          disabled={isProjectLocked}
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

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveMainEquipment}
                disabled={isProjectLocked}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:opacity-60 text-white rounded-lg transition-colors font-semibold"
              >
                <Save size={18} />
                Save Equipment Data
              </button>
            </div>
          </div>
        )}

        {/* Main Summary Section */}
        {selectedProject && (mainEquipmentData.length > 0 || mainExtraItems.length > 0) && (() => {
          const summary = calculateMainSummary();
          return (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <ListChecks size={24} className="text-emerald-500" />
                Project Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <span className={`font-bold ${summary.equipmentVariance > 0 ? 'text-red-400' : summary.equipmentVariance < 0 ? 'text-green-400' : 'text-white'}`}>
                        {summary.equipmentVariance > 0 ? '+' : ''}{summary.equipmentVariance.toFixed(2)} RON
                      </span>
                    </div>
                  </div>
                </div>

                {mainExtraItems.length > 0 && (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-400 mb-3">Extra Materials</h3>
                    <div className="space-y-2">
                      {mainExtraItems.map((item) => (
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

              <div className="mt-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={20} className={summary.totalVariance > 0 ? 'text-red-400' : 'text-green-400'} />
                    <span className="font-semibold text-white">Total Price Difference:</span>
                  </div>
                  <span className={`text-2xl font-bold ${summary.totalVariance > 0 ? 'text-red-400' : summary.totalVariance < 0 ? 'text-green-400' : 'text-white'}`}>
                    {summary.totalVariance > 0 ? '+' : ''}{summary.totalVariance.toFixed(2)} RON
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {summary.totalVariance > 0 ? 'Additional cost above original quote' : summary.totalVariance < 0 ? 'Savings from original quote' : 'No variance from original quote'}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Installation Pictures Section */}
        {selectedProject && isTrackingEntryOpen && (
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
              disabled={isProjectLocked}
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
                      disabled={isProjectLocked}
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
                          disabled={isProjectLocked}
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
        )}

        {/* Final Report Section */}
        {selectedProject && isTrackingEntryOpen && (
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
              if (isProjectLocked) return;
              setFinalReport(e.target.value);
              setHasUnsavedChanges(true);
            }}
            disabled={isProjectLocked}
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveInstallationData}
              disabled={isSaving || isProjectLocked}
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
                  summary: currentEntrySummary,
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

          <div className="mt-3">
            <button
              onClick={handleDeclareFinish}
              disabled={isProjectLocked}
              className="w-full px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:text-slate-300 text-slate-900 rounded-lg transition-colors font-bold"
            >
              Declare Finish
            </button>
          </div>
        </div>
        )}

        {selectedProject && isProjectLocked && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Mention For Admin</h2>
            <p className="text-sm text-slate-400 mb-3">
              Project is closed. If you need changes, leave a mention for admin.
            </p>
            <textarea
              value={lockedProjectMention}
              onChange={(e) => setLockedProjectMention(e.target.value)}
              placeholder="Write your mention..."
              className="w-full h-28 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />
            <button
              onClick={handleSubmitLockedMention}
              disabled={isSendingMention || !lockedProjectMention.trim()}
              className="mt-3 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:text-slate-300 text-slate-900 font-semibold rounded-lg transition-colors"
            >
              {isSendingMention ? 'Sending...' : 'Send Mention'}
            </button>
          </div>
        )}

        {/* Documents Section */}
        {selectedProject && (
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
                disabled={isProjectLocked}
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
                disabled={isProjectLocked}
                className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <label className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading || isProjectLocked}
                  className="hidden"
                  accept="image/*,.pdf"
                />
                <button
                  type="button"
                  disabled={uploading || isProjectLocked}
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
        )}

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
                {previewDoc.url.startsWith('data:image') || previewDoc.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-w-full h-auto mx-auto"
                  />
                ) : previewDoc.url.startsWith('data:application/pdf') || previewDoc.url.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={previewDoc.url.startsWith('data:') ? previewDoc.url : `${previewDoc.url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-full min-h-[600px]"
                    title={previewDoc.name}
                    style={{ border: 'none' }}
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

        {scannerOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold">Scan Serial Number</h3>
                <button onClick={closeScanner} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="bg-black rounded-lg overflow-hidden border border-slate-600">
                <video ref={scannerVideoRef} className="w-full h-[320px] object-cover" muted playsInline />
              </div>
              {scannerError && (
                <p className="text-xs text-red-300 mt-3">{scannerError}</p>
              )}
              <p className="text-xs text-slate-400 mt-3">
                Point the camera at the barcode/QR. If scanning fails, enter the serial manually in the table.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
