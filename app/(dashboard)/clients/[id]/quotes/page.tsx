'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Save, Zap, Package, Info, Plus, Trash2, ChevronDown, ChevronUp, Download, Eye, Sparkles, Users, X, FolderOpen, CheckCircle, AlertCircle, CheckSquare, Square, Mail, Trophy, Award, SendHorizonal, RotateCcw } from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Quote, QuoteLineItem, Category, ClientNeed, EmailTemplate, SmtpSettings } from '@/types';
import { DocumentPreview } from '@/components/DocumentPreview';
import EmailPreviewModal from '@/components/EmailPreviewModal';
import { storage } from '@/services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { StorageService } from '@/services/storageService';
import { replaceEmailVariables, getCommonTemplateData } from '@/lib/emailTemplateUtils';

export default function ClientQuotesPage() {
  const { client } = useClient();
  const { inventory, savedQuotes, saveQuote, deleteQuote, docTemplates, companyDocuments, users } = useData();
  const { currentUser } = useAuth();
  const router = useRouter();
  
  const [quoteProjectName, setQuoteProjectName] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [openSerialPickerId, setOpenSerialPickerId] = useState<string | null>(null);
  const [selectedProjectForQuote, setSelectedProjectForQuote] = useState<string>('current');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<{id?: string, name: string, url: string, description?: string, date?: Date} | null>(null);

  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{message: string; onConfirm: () => void} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendingEmailDocId, setSendingEmailDocId] = useState<string | null>(null);
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [quoteBaselineSnapshot, setQuoteBaselineSnapshot] = useState<string>('');
  const [showUnloadWarning, setShowUnloadWarning] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Table interaction state
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [serialSearchTerm, setSerialSearchTerm] = useState('');

  // Save mode modal
  const [saveModal, setSaveModal] = useState<{ show: boolean } >({ show: false });

  // Email preview modal state
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewData, setEmailPreviewData] = useState<any>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  
  // Document format warning modal
  const [docFormatWarning, setDocFormatWarning] = useState<{
    show: boolean;
    doc: {id: string, name: string, url: string, date: Date} | null;
  }>({ show: false, doc: null });

  // Load email templates and SMTP settings on mount
  useEffect(() => {
    const loadEmailData = async () => {
      try {
        // Load email templates
        const templatesResponse = await fetch('/api/settings/email-templates');
        if (templatesResponse.ok) {
          const data = await templatesResponse.json();
          setEmailTemplates(data.templates || []);
        }

        // Load SMTP settings for signature
        const smtpResponse = await fetch('/api/settings/smtp');
        if (smtpResponse.ok) {
          const data = await smtpResponse.json();
          setSmtpSettings(data.settings);
        }
      } catch (error) {
        console.error('Error loading email data:', error);
      }
    };

    loadEmailData();
  }, []);

  useEffect(() => {
    // Default new quotes to current needs so selected components are visible immediately.
    if (!editingQuoteId && selectedProjectForQuote === 'current' && !quoteProjectName.trim()) {
      setQuoteProjectName(client?.needs?.projectName || '');
    }
  }, [editingQuoteId, selectedProjectForQuote, quoteProjectName, client?.needs?.projectName]);

  const clientQuotes = savedQuotes.filter(q => q.clientId === client.id);
  
  // Get current quote's generated documents
  const currentQuote = editingQuoteId ? clientQuotes.find(q => q.id === editingQuoteId) : null;
  const generatedDocuments = currentQuote?.generatedDocuments || [];
  // Also include documents saved to companyDocuments for this quote (generated from quote-generator page)
  const companyDocsForQuote = editingQuoteId
    ? (companyDocuments as any[]).filter(d => d.quoteId === editingQuoteId)
    : [];
  
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const checkIfItemExists = (inventoryItemId: string) => {
    return quoteItems.some(item => item.inventoryItemId === inventoryItemId);
  };

  const addItemToQuote = (newItem: QuoteLineItem) => {
    if (newItem.inventoryItemId && checkIfItemExists(newItem.inventoryItemId)) {
      // Show confirmation dialog for duplicate item
      setConfirmDialog({
        message: 'This item is already added once. Do you want to add one more?',
        onConfirm: () => {
          setQuoteItems([...quoteItems, newItem]);
          showNotification('Item added to quote', 'success');
          setConfirmDialog(null);
        }
      });
      return;
    }
    setQuoteItems([...quoteItems, newItem]);
    showNotification('Item added to quote', 'success');
  };
  
  const toggleQuoteExpanded = (quoteId: string) => {
    const newExpanded = new Set(expandedQuotes);
    if (newExpanded.has(quoteId)) {
      newExpanded.delete(quoteId);
    } else {
      newExpanded.add(quoteId);
    }
    setExpandedQuotes(newExpanded);
  };

  const quoteTotals = useMemo(() => {
    const subtotalNet = quoteItems.reduce((acc, item) => acc + (item.quantity * item.netPrice), 0);
    const vatTotal = subtotalNet * 0.21;
    const totalGross = subtotalNet + vatTotal;
    return { subtotalNet, vatTotal, totalGross };
  }, [quoteItems]);

  const selectedProjectData = useMemo(() => {
    if (!client) return null;
    if (selectedProjectForQuote === 'current') {
      return client.needs || null;
    }
    if (selectedProjectForQuote.startsWith('archived-')) {
      const idx = Number.parseInt(selectedProjectForQuote.replace('archived-', ''), 10);
      return client.archivedProjects?.[idx]?.data || null;
    }
    return null;
  }, [client, selectedProjectForQuote]);

  if (!client) return null;

  const buildQuoteSnapshot = (payload: {
    title: string;
    items: QuoteLineItem[];
    editingQuoteId: string | null;
  }) => JSON.stringify(payload);

  const hasUnsavedQuoteChanges =
    isEditingQuote &&
    buildQuoteSnapshot({
      title: quoteProjectName,
      items: quoteItems,
      editingQuoteId,
    }) !== quoteBaselineSnapshot;

  useEffect(() => {
    if (!hasUnsavedQuoteChanges) return;

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const interceptNavigation = (originalMethod: History['pushState']) => {
      return function (this: History, ...args: any[]) {
        const targetUrl = args[2];
        if (typeof targetUrl === 'string' || targetUrl instanceof URL) {
          const next = new URL(targetUrl.toString(), window.location.href);
          if (next.href !== window.location.href) {
            setPendingNavigationUrl(next.href);
            setShowUnloadWarning(true);
            return;
          }
        }
        return originalMethod.apply(this, args as [any, string, string | URL | null | undefined]);
      };
    };

    window.history.pushState = interceptNavigation(originalPushState);
    window.history.replaceState = interceptNavigation(originalReplaceState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [hasUnsavedQuoteChanges]);

  const startNewQuote = () => {
    const initialQuoteName = client?.needs?.projectName || '';
    setQuoteItems([]);
    setQuoteProjectName(initialQuoteName);
    setEditingQuoteId(null);
    setSelectedProjectForQuote('current');
    setQuoteBaselineSnapshot(
      buildQuoteSnapshot({
        title: initialQuoteName,
        items: [],
        editingQuoteId: null,
      })
    );
    setIsEditingQuote(true);
    showNotification('New quote started', 'info');
  };

  const handleNewQuoteClick = () => {
    if (isEditingQuote && (quoteItems.length > 0 || !!quoteProjectName.trim() || !!editingQuoteId)) {
      setConfirmDialog({
        message: 'Clear current quote and start a new one?',
        onConfirm: () => {
          startNewQuote();
          setConfirmDialog(null);
        }
      });
      return;
    }
    startNewQuote();
  };

  const handleLoadQuote = (quote: Quote) => {
    const normalizedItems = quote.items.map(i => ({...i, selectedSerialNumbers: i.selectedSerialNumbers || []}));
    const loadedTitle = quote.title || '';

    setQuoteProjectName(loadedTitle);
    setQuoteItems(normalizedItems);
    setEditingQuoteId(quote.id);
    setQuoteBaselineSnapshot(
      buildQuoteSnapshot({
        title: loadedTitle,
        items: normalizedItems,
        editingQuoteId: quote.id,
      })
    );
    setIsEditingQuote(true);
    showNotification('Quote loaded successfully', 'success');
  };

  const handleUnloadQuote = () => {
    if (hasUnsavedQuoteChanges) {
      setPendingNavigationUrl(null);
      setShowUnloadWarning(true);
      return;
    }
    setIsEditingQuote(false);
    setQuoteItems([]);
    setQuoteProjectName('');
    setEditingQuoteId(null);
    setSelectedProjectForQuote('current');
  };

  const handleExitWithoutSavingQuote = () => {
    const target = pendingNavigationUrl;
    setShowUnloadWarning(false);
    setPendingNavigationUrl(null);
    setIsEditingQuote(false);
    setQuoteItems([]);
    setQuoteProjectName('');
    setEditingQuoteId(null);
    setSelectedProjectForQuote('current');
    if (target) {
      window.location.assign(target);
    }
  };

  const handleSaveAndExitQuote = () => {
    const didSave = saveClientQuote(false, true);
    if (!didSave) return;
    const target = pendingNavigationUrl;
    setShowUnloadWarning(false);
    setPendingNavigationUrl(null);
    setIsEditingQuote(false);
    setQuoteItems([]);
    setQuoteProjectName('');
    setEditingQuoteId(null);
    setSelectedProjectForQuote('current');
    if (target) {
      window.location.assign(target);
    }
  };

  const saveClientQuote = (forceNewVersion?: boolean, forceOverwrite?: boolean): string | false => {
    if (!quoteProjectName.trim()) { 
      showNotification("Please enter a quote name", 'error');
      return false;
    }
    
    // If editing an existing quote and we haven't been told what to do, ask
    if (editingQuoteId && !forceNewVersion && !forceOverwrite) {
      const existingQuote = clientQuotes.find(q => q.id === editingQuoteId);
      if (existingQuote && existingQuote.title === quoteProjectName.trim()) {
        setSaveModal({ show: true });
        return false;
      }
    }

    let targetId = editingQuoteId;
    let finalName = quoteProjectName.trim();

    if (forceNewVersion) {
      // Generate a new ID and add version suffix
      targetId = null;
      const baseName = quoteProjectName.trim();
      const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const versionRegex = new RegExp(`^${escapedBase}(?:\\s+v\\d+)?$`);
      const relatedCount = clientQuotes.filter(q => versionRegex.test(q.title)).length;
      finalName = `${baseName} v${relatedCount + 1}`;
    }

    if (!targetId) {
      const existingByName = savedQuotes.find(q => q.clientId === client.id && q.title === finalName);
      targetId = existingByName ? existingByName.id : Date.now().toString();
    }
    
    // Preserve existing status/allocation when saving line items
    const existingQuoteData = clientQuotes.find(q => q.id === targetId);
    const newQuote: Quote = { 
      id: targetId, 
      clientId: client.id, 
      title: finalName, 
      customerName: client.name, 
      date: new Date(), 
      items: [...quoteItems], 
      ...quoteTotals,
      // Preserve existing status/allocation fields
      ...(existingQuoteData ? {
        quoteStatus: existingQuoteData.quoteStatus,
        assignedInstallers: existingQuoteData.assignedInstallers,
        allocatedInstallerId: existingQuoteData.allocatedInstallerId,
        allocatedAt: existingQuoteData.allocatedAt,
        phase: existingQuoteData.phase,
        generatedDocuments: existingQuoteData.generatedDocuments,
        emailSentAt: existingQuoteData.emailSentAt,
        emailSentTo: existingQuoteData.emailSentTo,
        emailSentBy: existingQuoteData.emailSentBy,
      } : {})
    };
    
    saveQuote(newQuote);
    setEditingQuoteId(targetId);
    if (forceNewVersion) setQuoteProjectName(finalName);
    setQuoteBaselineSnapshot(
      buildQuoteSnapshot({
        title: finalName,
        items: [...quoteItems],
        editingQuoteId: targetId,
      })
    );
    showNotification('Quote saved successfully', 'success');
    return targetId;
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

  // Quote status handlers — save directly to Firestore via saveQuote
  const handleMarkQuoteWon = () => {
    if (!currentQuote) return;
    const updatedQuote: Quote = { ...currentQuote, quoteStatus: 'won_unallocated' };
    saveQuote(updatedQuote);
    showNotification('Quote marked as WON! Allocate it to an installer below.', 'success');
  };

  const handleUnmarkQuoteWon = () => {
    if (!currentQuote) return;
    const updatedQuote: Quote = {
      ...currentQuote,
      quoteStatus: currentQuote.emailSentAt ? 'sent' : 'draft',
      assignedInstallers: [],
      allocatedInstallerId: undefined,
      allocatedAt: undefined,
      phase: undefined,
    };
    saveQuote(updatedQuote);
    showNotification('Quote status reset to ' + (currentQuote.emailSentAt ? 'Sent' : 'Draft') + '.', 'info');
  };

  const updateQuoteLine = (id: string, field: keyof QuoteLineItem, value: string | number | string[]) => {
    setQuoteItems(quoteItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeQuoteLine = (id: string) => setQuoteItems(quoteItems.filter(item => item.id !== id));

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(val);

  const handleProductSelect = (itemId: string, product: { id: string; name: string; sellPrice: number }) => {
    setQuoteItems(quoteItems.map(item =>
      item.id === itemId ? {
        ...item,
        inventoryItemId: product.id,
        description: product.name,
        unit: 'pcs',
        netPrice: product.sellPrice,
        selectedSerialNumbers: []
      } : item
    ));
    setFocusedRowId(null);
  };

  const addMountingStructuresToQuote = (needsData?: ClientNeed | null) => {
    const totalPanels = Number(needsData?.panelCount);
    if (!Number.isFinite(totalPanels) || totalPanels <= 0) {
      showNotification('Panel count not configured in Client Needs', 'error');
      return;
    }

    const roofType = needsData?.roofType;
    const selectedOption = needsData?.selectedMountingSystem;
    
    // For non-Tigla roofs, check if user has selected an option
    const isTabla = roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata';
    const isTiglaCeramica = roofType === 'Tigla ceramica';
    
    if (isTabla && !selectedOption) {
      showNotification('Please select a mounting system option in the Needs page', 'error');
      return;
    }
    
    const option = selectedOption || 'rail';
    
    // Determine row configuration from needs
    const rowCount = needsData?.rowCount || 1;
    const rowDistribution = needsData?.rowDistribution || {};
    
    let rowConfigs: number[] = [];
    if (rowCount === 1) {
      rowConfigs = [totalPanels];
    } else {
      const totalDistributed = Object.values(rowDistribution).reduce((sum: number, val) => sum + (val as number), 0);
      if (totalDistributed === totalPanels) {
        rowConfigs = Array.from({length: rowCount}, (_, i) => rowDistribution[i + 1] || 0);
      } else {
        showNotification('Please complete row distribution in Client Needs', 'error');
        return;
      }
    }

    if (rowConfigs.length === 0 || rowConfigs.some(c => c === 0)) {
      showNotification('Please configure row distribution in Client Needs', 'error');
      return;
    }

    // Calculate components
    const numRows = rowConfigs.length;
    const endClamps = numRows * 4; // CEND: 4 per row
    const midClamps = (totalPanels - numRows) * 2; // CMID: (N - R) × 2 (1 per gap per rail)
    
    // Rail calculations
    const selectedPanel = needsData?.panelStockItemId 
      ? inventory.find(i => i.id === needsData.panelStockItemId) 
      : null;
    const panelWidthMm = selectedPanel?.panelWidth || 1134;
    const panelWidth = panelWidthMm / 1000;
    const maxPanelsInRow = Math.max(...rowConfigs);
    const railLengthPerRow = maxPanelsInRow * panelWidth;
    const railLengthWithWaste = railLengthPerRow * 1.1;
    const railsPerRow = 2;
    
    // Look for rail by checking: 1) isRail flag with railLengthM, 2) CRAIL SKU
    const selectedRail = 
      inventory.find(i => i.category === Category.MOUNTING && i.isRail && (i.railLengthM || 0) > 0) ||
      inventory.find(i => i.category === Category.MOUNTING && i.sku?.toUpperCase() === 'CRAIL') ||
      null;
    
    // Get rail length: use explicit railLengthM if set, otherwise try to extract from name pattern (e.g., "5,4 M" or "5.4m")
    let railLengthM = selectedRail?.railLengthM || 0;
    if (!railLengthM && selectedRail?.name) {
      const match = selectedRail.name.match(/(\d+[.,]\d+)\s*[Mm]/);
      if (match) {
        railLengthM = parseFloat(match[1].replace(',', '.'));
      }
    }
    railLengthM = railLengthM || 6; // Final fallback to 6m
    
    const sectionsPerRail = Math.ceil(railLengthWithWaste / railLengthM);
    const railsOf6m = sectionsPerRail * numRows * railsPerRow;
    const combinersPerRail = sectionsPerRail > 1 ? sectionsPerRail - 1 : 0;
    const totalCombiners = combinersPerRail * numRows * railsPerRow;
    const totalRailLength = railsOf6m * railLengthM; // Total rail length in meters
    
    // Calculate hooks based on roof type
    let roofHooks = 0;
    let roofScrews = 0;
    let hookSKU = '';
    
    if (roofType === 'Tigla ceramica') {
      // CHOOK-Tigla: 1 hook every 1m
      roofHooks = Math.ceil(totalRailLength / 1);
      roofScrews = roofHooks * 2; // CHOOKSurub: 2 per hook
      hookSKU = 'CHOOK-Tigla';
    } else if (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata') {
      // CHOOK-Tabla: 1 hook every 1m, no screws
      roofHooks = Math.ceil(totalRailLength / 1);
      hookSKU = 'CHOOK-Tabla';
    }
    
    // Calculate minirails (CMINI)
    const miniRails = totalPanels * 2 + (numRows * 2);
    const miniRailScrews = miniRails * 4; // CMINISurub: 4 per minirail

    // Find matching items from inventory for pricing (exact SKU match only)
    const findMountingItem = (sku: string) => {
      const skuLower = sku.toLowerCase();
      return inventory.find(i => i.category === Category.MOUNTING && i.sku?.toLowerCase() === skuLower);
    };

    // Create line items for mounting structures
    const mountingItems: QuoteLineItem[] = [];
    const timestamp = Date.now();

    // Common items: End and Mid Clamps
    const endClampItem = findMountingItem('CEND');
    mountingItems.push({
      id: `${timestamp}-end-clamps`,
      inventoryItemId: endClampItem?.id,
      description: endClampItem ? `${endClampItem.name} (CEND)` : 'End Clamps (CEND)',
      unit: 'pcs',
      quantity: endClamps,
      netPrice: endClampItem?.sellPrice || 0
    });

    const midClampItem = findMountingItem('CMID');
    mountingItems.push({
      id: `${timestamp}-mid-clamps`,
      inventoryItemId: midClampItem?.id,
      description: midClampItem ? `${midClampItem.name} (CMID)` : 'Mid Clamps (CMID)',
      unit: 'pcs',
      quantity: midClamps,
      netPrice: midClampItem?.sellPrice || 0
    });

    // Add components based on system type
    if (option === 'minirail') {
      // MiniRail System
      const miniRailItem = findMountingItem('CMINI');
      mountingItems.push({
        id: `${timestamp}-minirails`,
        inventoryItemId: miniRailItem?.id,
        description: miniRailItem ? `${miniRailItem.name} (CMINI)` : 'MiniRails (CMINI)',
        unit: 'pcs',
        quantity: miniRails,
        netPrice: miniRailItem?.sellPrice || 0
      });

      const miniRailScrewItem = findMountingItem('CMINISurub');
      mountingItems.push({
        id: `${timestamp}-minirail-screws`,
        inventoryItemId: miniRailScrewItem?.id,
        description: miniRailScrewItem ? `${miniRailScrewItem.name} (CMINISurub)` : 'MiniRail Screws (CMINISurub)',
        unit: 'pcs',
        quantity: miniRailScrews,
        netPrice: miniRailScrewItem?.sellPrice || 0
      });
    } else {
      // Rail System (default for Tigla ceramica or when rail option selected)
      const railItem = selectedRail;
      mountingItems.push({
        id: `${timestamp}-rails`,
        inventoryItemId: railItem?.id,
        description: railItem ? `${railItem.name} (${railLengthM}m Rails)` : `Mounting Rails (${railLengthM}m)`,
        unit: 'pcs',
        quantity: railsOf6m,
        netPrice: railItem?.sellPrice || 0
      });

      if (totalCombiners > 0) {
        const combinerItem = findMountingItem('CCOMB');
        mountingItems.push({
          id: `${timestamp}-combiners`,
          inventoryItemId: combinerItem?.id,
          description: combinerItem ? `${combinerItem.name} (Rail Combiners)` : 'Rail Combiners/Connectors',
          unit: 'pcs',
          quantity: totalCombiners,
          netPrice: combinerItem?.sellPrice || 0
        });
      }

      // Roof Hooks
      if (roofHooks > 0) {
        const hookItem = findMountingItem(hookSKU);
        mountingItems.push({
          id: `${timestamp}-roof-hooks`,
          inventoryItemId: hookItem?.id,
          description: hookItem ? `${hookItem.name} (${hookSKU})` : `Roof Hooks (${hookSKU})`,
          unit: 'pcs',
          quantity: roofHooks,
          netPrice: hookItem?.sellPrice || 0
        });
        
        // Hook Screws (only for Tigla ceramica)
        if (roofScrews > 0) {
          const screwItem = findMountingItem('CHOOKSurub');
          mountingItems.push({
            id: `${timestamp}-hook-screws`,
            inventoryItemId: screwItem?.id,
            description: screwItem ? `${screwItem.name} (CHOOKSurub)` : 'Hook Screws (CHOOKSurub)',
            unit: 'pcs',
            quantity: roofScrews,
            netPrice: screwItem?.sellPrice || 0
          });
        }
      }
    }

    // Check for duplicates in mounting items
    const duplicateItems = mountingItems.filter(item => 
      item.inventoryItemId && checkIfItemExists(item.inventoryItemId)
    );

    if (duplicateItems.length > 0) {
      setConfirmDialog({
        message: `${duplicateItems.length} mounting component(s) are already in the quote. Do you want to add them again?`,
        onConfirm: () => {
          setQuoteItems([...quoteItems, ...mountingItems]);
          const missingPrices = mountingItems.filter(i => i.netPrice === 0).length;
          const systemType = option === 'minirail' ? 'MiniRail System' : 'Rail System';
          if (missingPrices > 0) {
            showNotification(`${systemType} components added! ${missingPrices} item(s) have no price set.`, 'info');
          } else {
            showNotification(`${systemType} components added successfully!`, 'success');
          }
          setConfirmDialog(null);
        }
      });
      return;
    }

    // Add all mounting items to quote
    setQuoteItems([...quoteItems, ...mountingItems]);
    
    // Show confirmation
    const missingPrices = mountingItems.filter(i => i.netPrice === 0).length;
    const systemType = option === 'minirail' ? 'MiniRail System' : 'Rail System';
    if (missingPrices > 0) {
      showNotification(`${systemType} components added! ${missingPrices} item(s) have no price set.`, 'info');
    } else {
      showNotification(`${systemType} components added successfully!`, 'success');
    }
  };

  const generateDocumentFromTemplate = async () => {
    if (!selectedTemplateId) {
      showNotification('Please select a template', 'error');
      return;
    }

    // Auto-save the quote if it hasn't been saved yet
    let quoteId = editingQuoteId;
    if (!quoteId) {
      const savedId = saveClientQuote(false, true);
      if (!savedId) return; // saveClientQuote shows its own error
      quoteId = savedId;
    }

    const template = docTemplates?.find(t => t.id === selectedTemplateId);
    if (!template) {
      showNotification('Template not found', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      // Dynamic imports
      const [PizZipModule, DocxtemplaterModule] = await Promise.all([
        import('pizzip'),
        import('docxtemplater')
      ]);

      const PizZip = (PizZipModule as any).default || PizZipModule;
      const Docxtemplater = (DocxtemplaterModule as any).default || DocxtemplaterModule;

      // Fetch template file from URL or decode base64
      let arrayBuffer: ArrayBuffer;
      
      if (template.content.startsWith('http://') || template.content.startsWith('https://')) {
        // Template is stored as a URL - fetch it
        const response = await fetch(template.content);
        if (!response.ok) {
          throw new Error('Failed to fetch template file');
        }
        arrayBuffer = await response.arrayBuffer();
      } else {
        // Template is stored as base64 data URL
        let base64Content = template.content.trim();
        
        if (base64Content.includes(',')) {
          // Remove data URL prefix if present
          base64Content = base64Content.split(',')[1];
        }
        
        // Remove any whitespace characters
        base64Content = base64Content.replace(/\s/g, '');
        
        // Decode base64 to binary
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      }

      // Create document from template
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true
      });

      const formatCurrency = (num: number) => {
        return new Intl.NumberFormat('ro-RO', {
          style: 'currency',
          currency: 'RON',
          minimumFractionDigits: 2
        }).format(num);
      };

      // Prepare data for template
      const data = {
        customer_name: client?.name || '',
        customer_email: client?.email || '',
        customer_phone: client?.phone || '',
        customer_address: client?.address || '',
        project_title: quoteProjectName || 'Untitled Quote',
        today_date: new Date().toLocaleDateString('ro-RO'),
        subtotal_net: formatCurrency(quoteTotals.subtotalNet),
        vat_total: formatCurrency(quoteTotals.vatTotal),
        total_gross: formatCurrency(quoteTotals.totalGross),
        net_price: formatCurrency(quoteTotals.subtotalNet),
        tva: formatCurrency(quoteTotals.vatTotal),
        total_price: formatCurrency(quoteTotals.totalGross),
        items: quoteItems.map(item => ({
          description: item.description || '',
          qty: item.quantity || 0,
          unit: item.unit || 'pcs',
          net_price: formatCurrency(item.netPrice || 0),
          total_price: formatCurrency((item.quantity || 0) * (item.netPrice || 0)),
          serials: item.selectedSerialNumbers?.join(', ') || ''
        }))
      };

      doc.render(data);
      
      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const fileName = `Quote - ${quoteProjectName || client?.name} - ${new Date().toLocaleDateString('ro-RO').replace(/\//g, '-')}.docx`;
      
      // Upload to Firebase Storage
      if (!storage) {
        throw new Error('Firebase Storage not initialized');
      }

      const timestamp = Date.now();
      const storagePath = `quotes/${quoteId}/documents/${timestamp}_${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      showNotification('Uploading document...', 'info');
      await uploadBytes(storageRef, out);
      const downloadURL = await getDownloadURL(storageRef);

      const newDoc = {
        id: timestamp.toString(),
        name: fileName,
        url: downloadURL,
        date: new Date(),
        generatedBy: currentUser?.username || 'Unknown'
      };

      // Update quote with new document (stored in quote.generatedDocuments)
      const existingQuote = clientQuotes.find(q => q.id === quoteId);
      if (existingQuote) {
        const updatedQuote: Quote = {
          ...existingQuote,
          generatedDocuments: [...(existingQuote.generatedDocuments || []), newDoc]
        };
        saveQuote(updatedQuote);
      }

      // Also save to companyDocuments for cross-listing in quote-generator
      await StorageService.saveItem('companyDocuments', {
        ...newDoc,
        quoteId,
        clientId: client.id,
        description: `Quote document for ${client.name}`
      });

      setIsGenerating(false);
      showNotification('Document generated and saved successfully!', 'success');
      
    } catch (err) {
      console.error('Document generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showNotification(`Failed to generate document: ${errorMessage}`, 'error');
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async (doc: {id: string, name: string, url: string, date: Date}) => {
    if (!client?.email) {
      showNotification('Client does not have an email address', 'error');
      return;
    }

    // Check document format
    const isPdf = doc.name.toLowerCase().endsWith('.pdf') || doc.url.includes('application/pdf');
    const isDocx = doc.name.toLowerCase().endsWith('.docx') || doc.url.includes('officedocument.wordprocessingml');

    if (isPdf) {
      // PDF: proceed directly to email preview
      await prepareEmailPreview(doc);
    } else if (isDocx) {
      // DOCX: show warning modal
      setDocFormatWarning({ show: true, doc });
    } else {
      showNotification('Unsupported document format for email', 'error');
    }
  };

  const prepareEmailPreview = async (doc: {id: string, name: string, url: string, date: Date}) => {
    try {
      // Find appropriate email template (quote category)
      const quoteTemplate = emailTemplates.find(t => t.category === 'quote');
      
      // Prepare template data
      const templateData = getCommonTemplateData(client, currentQuote, undefined, currentUser);
      
      // Use template or default content
      let subject, body;
      if (quoteTemplate) {
        subject = replaceEmailVariables(quoteTemplate.subject, templateData);
        body = replaceEmailVariables(quoteTemplate.body, templateData);
      } else {
        // Fallback to default
        subject = `Quote from SolarFlux - ${client.name}`;
        body = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Quote from SolarFlux</h2>
            <p>Dear ${client.name},</p>
            <p>Please find attached your quote document.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <br/>
            <p>Best regards,<br/><strong>SolarFlux Team</strong></p>
          </div>
        `;
      }

      // Prepare email preview data
      setEmailPreviewData({
        to: client.email,
        subject,
        body,
        attachments: [],
        docToSend: doc,
      });
      
      setShowEmailPreview(true);

    } catch (error) {
      console.error('Error preparing email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(`Failed to prepare email: ${errorMessage}`, 'error');
    }
  };

  const handleConfirmSendEmail = async (emailData: {
    to: string;
    subject: string;
    body: string;
    attachments: any[];
  }) => {
    if (!emailPreviewData?.docToSend) {
      showNotification('No document selected', 'error');
      return;
    }

    const doc = emailPreviewData.docToSend;
    setSendingEmailDocId(doc.id);
    setShowEmailPreview(false);

    try {
      // Fetch the document from Firebase Storage URL
      showNotification('Downloading document...', 'info');
      const response = await fetch(doc.url);
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      const blob = await response.blob();

      // Check if document is PDF or DOCX
      const isPdf = doc.name.toLowerCase().endsWith('.pdf') || doc.url.includes('application/pdf');
      let pdfBase64: string;
      let pdfFileName: string;

      if (isPdf) {
        // Already PDF, just convert to base64
        pdfBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });
        pdfFileName = doc.name;
      } else {
        // DOCX: convert to PDF
        const docxBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });

        showNotification('Converting to PDF...', 'info');
        const convertResponse = await fetch('/api/convert-docx-to-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docxBase64 }),
        });

        if (!convertResponse.ok) {
          const error = await convertResponse.json();
          throw new Error(error.error || 'Failed to convert to PDF');
        }

        const convertData = await convertResponse.json();
        pdfBase64 = convertData.pdfBase64;
        pdfFileName = doc.name.replace('.docx', '.pdf');
      }

      // Send email with PDF using data from modal
      showNotification('Sending email...', 'info');
      const emailResponse = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          body: emailData.body,
          pdfBase64,
          pdfFileName,
          quoteId: editingQuoteId,
        }),
      });

      if (!emailResponse.ok) {
        const error = await emailResponse.json();
        throw new Error(error.error || 'Failed to send email');
      }

      showNotification(`Email sent successfully to ${emailData.to}`, 'success');

      // Save PDF to generatedDocuments and update emailHistory
      if (editingQuoteId) {
        const existingQuote = clientQuotes.find(q => q.id === editingQuoteId);
        if (existingQuote) {
          // If DOCX was converted to PDF, upload the PDF and add to generatedDocuments
          let savedPdfDoc = (existingQuote.generatedDocuments || []).find(d => d.name === pdfFileName);
          if (!isPdf && !savedPdfDoc && storage) {
            try {
              const binaryStr = atob(pdfBase64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
              const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
              const newDocId = Date.now().toString();
              const pdfRef = ref(storage, `quotes/${editingQuoteId}/documents/${newDocId}_${pdfFileName}`);
              await uploadBytes(pdfRef, pdfBlob);
              const pdfUrl = await getDownloadURL(pdfRef);
              savedPdfDoc = { id: newDocId, name: pdfFileName, url: pdfUrl, date: new Date(), generatedBy: currentUser?.username || 'Unknown' };
            } catch (uploadErr) {
              console.error('Failed to save converted PDF to docs:', uploadErr);
            }
          }

          const sentEntry = {
            sentAt: new Date(),
            sentTo: emailData.to,
            sentBy: currentUser?.username || '',
            documentName: pdfFileName,
            documentId: savedPdfDoc ? savedPdfDoc.id : doc.id,
          };
          const updatedDocs = savedPdfDoc && !(existingQuote.generatedDocuments || []).some(d => d.id === savedPdfDoc!.id)
            ? [...(existingQuote.generatedDocuments || []), savedPdfDoc]
            : existingQuote.generatedDocuments;

          const updatedQuote: Quote = {
            ...existingQuote,
            quoteStatus: existingQuote.quoteStatus?.startsWith('won') ? existingQuote.quoteStatus : 'sent',
            emailSentAt: new Date(),
            emailSentTo: emailData.to,
            emailSentBy: currentUser?.username,
            emailHistory: [...(existingQuote.emailHistory || []), sentEntry],
            generatedDocuments: updatedDocs,
          };
          saveQuote(updatedQuote);
        }
      }

    } catch (error) {
      console.error('Email sending error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(`Failed to send email: ${errorMessage}`, 'error');
    } finally {
      setSendingEmailDocId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
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
                {notification.type === 'success' && <CheckCircle size={20} className="flex-shrink-0" />}
                {notification.type === 'error' && <AlertCircle size={20} className="flex-shrink-0" />}
                {notification.type === 'info' && <Info size={20} className="flex-shrink-0" />}
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

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <AlertCircle size={24} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Confirm Action</h3>
                  <p className="text-slate-300 text-sm">{confirmDialog.message}</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUnloadWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <AlertCircle size={24} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">Unsaved Changes</h3>
                  <p className="text-slate-300 text-sm">
                    You have unsaved quote changes. What do you want to do?
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSaveAndExitQuote}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-colors"
                >
                  Save and Exit
                </button>
                <button
                  onClick={handleExitWithoutSavingQuote}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-lg border border-red-500/40 transition-colors"
                >
                  Exit Without Saving
                </button>
                <button
                  onClick={() => {
                    setShowUnloadWarning(false);
                    setPendingNavigationUrl(null);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText size={32} className="text-amber-500" />
            Quotes
          </h1>
          {isEditingQuote && (
            <div className="flex gap-3">
              <button
                onClick={handleUnloadQuote}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <X size={18} /> Unload
              </button>
              <button 
                onClick={() => saveClientQuote()}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save size={18} /> Save Quote
              </button>
            </div>
          )}
        </div>

        {/* Saved Quotes List */}
        {clientQuotes.length > 0 && (
          <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <FolderOpen size={16} className="text-amber-500" />
                Saved Quotes ({clientQuotes.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-700">
              {clientQuotes.slice().reverse().map(quote => {
                const isCurrent = editingQuoteId === quote.id;
                const isExpanded = expandedQuotes.has(quote.id);
                
                return (
                  <div key={quote.id} className="bg-slate-800">
                    {/* Quote Header */}
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-slate-750 transition-colors">
                      <button
                        onClick={() => toggleQuoteExpanded(quote.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div className={`p-1.5 rounded ${isExpanded ? 'bg-slate-700' : 'bg-slate-700/50'}`}>
                          {isExpanded ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-bold text-sm ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                              {quote.title}
                            </p>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded flex items-center gap-1">
                                <CheckCircle size={12} /> EDITING
                              </span>
                            )}
                            {(() => {
                              const qs = quote.quoteStatus;
                              if (!qs || qs === 'draft') return null;
                              const cfgs: Record<string, { label: string; cls: string }> = {
                                sent: { label: 'Sent', cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
                                won_unallocated: { label: 'WON', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
                                won_allocated: { label: 'WON ✓', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
                              };
                              const cfg = cfgs[qs];
                              return cfg ? <span className={`px-2 py-0.5 text-xs font-bold rounded ${cfg.cls}`}>{cfg.label}</span> : null;
                            })()}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Created: {new Date(quote.date).toLocaleDateString()} • Total: {quote.totalGross.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (isEditingQuote && isCurrent) {
                              handleUnloadQuote();
                              return;
                            }
                            handleLoadQuote(quote);
                          }}
                          className={`px-3 py-1.5 border rounded font-bold text-xs transition-colors ${
                            isEditingQuote && isCurrent
                              ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-600'
                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 hover:border-amber-500/50'
                          }`}
                        >
                          {isEditingQuote && isCurrent ? 'Unload' : 'Load'}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              message: `Delete quote "${quote.title}"?`,
                              onConfirm: () => {
                                deleteQuote(quote.id);
                                if (editingQuoteId === quote.id) {
                                  setQuoteItems([]); 
                                  setQuoteProjectName(''); 
                                  setEditingQuoteId(null);
                                  setSelectedProjectForQuote('');
                                }
                                showNotification('Quote deleted', 'success');
                                setConfirmDialog(null);
                              }
                            });
                          }}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Quote Details - Expandable */}
                    {isExpanded && (
                      <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-4">
                            <div>
                              <span className="text-slate-500">Customer:</span>
                              <span className="ml-2 text-white font-semibold">{quote.customerName}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Items:</span>
                              <span className="ml-2 text-white font-semibold">{quote.items.length} items</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Subtotal:</span>
                              <span className="ml-2 text-white font-semibold">{quote.subtotalNet.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">VAT:</span>
                              <span className="ml-2 text-white font-semibold">{quote.vatTotal.toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</span>
                            </div>
                          </div>
                          
                          {/* Items preview */}
                          <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Quote Items:</p>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!isEditingQuote && (
          <div className="flex justify-center">
            <button
              onClick={handleNewQuoteClick}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} /> Create New Quote
            </button>
          </div>
        )}

        {/* Quote Editor */}
        {isEditingQuote && (
        <div className="space-y-8">
          {/* Quote Header */}
          <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <FileText size={20} className="text-amber-500" />
              {editingQuoteId ? 'Edit Quote' : 'Create New Quote'}
            </h3>

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

              {!editingQuoteId && (
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
                  <option value="current">Current Needs</option>
                  {client?.archivedProjects?.map((project, idx) => (
                    <option key={idx} value={`archived-${idx}`}>
                      {project.projectName || `Archived Project ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              )}
            </div>
          </section>

        {/* Project Summary */}
        {selectedProjectData && (
          <div className="bg-gradient-to-br from-amber-500/10 via-slate-800 to-slate-800 border border-amber-500/30 rounded-xl p-6">
            <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
              <Info size={16} /> Project Summary
            </h4>
            <p className="text-white leading-relaxed">
              The client needs a system for <span className="font-bold text-amber-400">{selectedProjectData.connectionType || 'not specified'}</span> connection
              {selectedProjectData.inverterKw && `, ${selectedProjectData.inverterKw}kW inverter`}
              {selectedProjectData.batteryKwh && `, ${selectedProjectData.batteryKwh}kWh storage`}
              {selectedProjectData.panelKw && `, ${selectedProjectData.panelKw}kW solar panels`}. 
              Roof type: <span className="font-bold text-amber-400">{selectedProjectData.roofType || 'not specified'}</span>.
            </p>
          </div>
        )}

        {/* Selected Components */}
        {selectedProjectData && (
          <div className="space-y-4">
            {/* Inverter */}
            {selectedProjectData.selectedInverterId && (() => {
              const selectedInv = inventory.find(i => i.id === selectedProjectData.selectedInverterId && i.category === Category.INVERTERS);
              if (!selectedInv) return null;
              const isAdded = quoteItems.some(qi => qi.inventoryItemId === selectedInv.id);
              return (
                <div className={`border rounded-xl transition-all ${isAdded ? 'bg-slate-800/50 border-slate-700/50 p-2' : 'bg-slate-800 border-slate-700 p-4'}`}>
                  {isAdded ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                      <span className="truncate font-medium text-slate-300">{selectedInv.name}</span>
                      <span className="ml-auto text-slate-500 whitespace-nowrap">Added</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <Zap size={14} className="text-amber-500" />Selected Inverter
                      </h4>
                      <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/50">
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm">{selectedInv.name}</p>
                          <p className="text-xs text-slate-400 mt-1">{selectedInv.inverterPowerKw}kW • {selectedInv.inverterConnectionType} • {selectedInv.quantity} in stock</p>
                          <p className="text-sm text-emerald-400 font-bold mt-1">{selectedInv.sellPrice} RON</p>
                        </div>
                        <button
                          onClick={() => {
                            addItemToQuote({ id: Date.now().toString(), inventoryItemId: selectedInv.id, description: `${selectedInv.name} (${selectedInv.inverterPowerKw}kW)`, unit: 'piece', quantity: 1, netPrice: selectedInv.sellPrice, selectedSerialNumbers: [] });
                          }}
                          className="ml-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs transition-colors whitespace-nowrap"
                        >Add to Quote</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Battery */}
            {selectedProjectData.selectedBatteryId && (() => {
              const selectedBat = inventory.find(i => i.id === selectedProjectData.selectedBatteryId && i.category === Category.BATTERIES);
              if (!selectedBat) return null;
              const isAdded = quoteItems.some(qi => qi.inventoryItemId === selectedBat.id);
              return (
                <div className={`border rounded-xl transition-all ${isAdded ? 'bg-slate-800/50 border-slate-700/50 p-2' : 'bg-slate-800 border-slate-700 p-4'}`}>
                  {isAdded ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                      <span className="truncate font-medium text-slate-300">{selectedBat.name}</span>
                      <span className="ml-auto text-slate-500 whitespace-nowrap">Added</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <Package size={14} className="text-amber-500" />Selected Battery
                      </h4>
                      <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/50">
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm">{selectedBat.name}</p>
                          <p className="text-xs text-slate-400 mt-1">{selectedBat.batteryPowerKwh}kWh • {selectedBat.quantity} in stock</p>
                          <p className="text-sm text-emerald-400 font-bold mt-1">{selectedBat.sellPrice} RON</p>
                        </div>
                        <button
                          onClick={() => {
                            addItemToQuote({ id: Date.now().toString(), inventoryItemId: selectedBat.id, description: `${selectedBat.name} (${selectedBat.batteryPowerKwh}kWh)`, unit: 'piece', quantity: 1, netPrice: selectedBat.sellPrice, selectedSerialNumbers: [] });
                          }}
                          className="ml-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs transition-colors whitespace-nowrap"
                        >Add to Quote</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Grounding Socket Suggestion */}
            {selectedProjectData.groundingStatus === 'nu exista, face Solar Invest' && (() => {
              const groundingProduct = inventory.find(i => i.sku?.toUpperCase() === 'R4');

              if (!groundingProduct) {
                return (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-300 mb-3">Adauga priza de pamant</h4>
                    <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/40">
                      <p className="text-xs text-red-300">
                        Produsul cu SKU <span className="font-bold">R4</span> nu a fost gasit in inventar.
                      </p>
                    </div>
                  </div>
                );
              }

              const isAdded = quoteItems.some(qi => qi.inventoryItemId === groundingProduct.id);
              return (
                <div className={`border rounded-xl transition-all ${isAdded ? 'bg-slate-800/50 border-slate-700/50 p-2' : 'bg-slate-800 border-slate-700 p-4'}`}>
                  {isAdded ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                      <span className="truncate font-medium text-slate-300">{groundingProduct.name}</span>
                      <span className="ml-auto text-slate-500 whitespace-nowrap">Added</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-xs font-bold text-slate-300 mb-3">Adauga priza de pamant</h4>
                      <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/50">
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm">{groundingProduct.name}</p>
                          <p className="text-xs text-slate-400 mt-1">SKU: {groundingProduct.sku} • {groundingProduct.quantity} in stock</p>
                          <p className="text-sm text-emerald-400 font-bold mt-1">{groundingProduct.sellPrice} RON</p>
                        </div>
                        <button
                          onClick={() => {
                            addItemToQuote({ id: Date.now().toString(), inventoryItemId: groundingProduct.id, description: `${groundingProduct.name} (${groundingProduct.sku})`, unit: 'piece', quantity: 1, netPrice: groundingProduct.sellPrice, selectedSerialNumbers: [] });
                          }}
                          className="ml-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs transition-colors whitespace-nowrap"
                        >Add to Quote</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Panels */}
            {selectedProjectData.panelStockItemId && selectedProjectData.panelCount && (() => {
              const selectedPanel = inventory.find(i => i.id === selectedProjectData.panelStockItemId && i.category === Category.PANELS);
              if (!selectedPanel) return null;
              const isAdded = quoteItems.some(qi => qi.inventoryItemId === selectedPanel.id);
              return (
                <div className={`border rounded-xl transition-all ${isAdded ? 'bg-slate-800/50 border-slate-700/50 p-2' : 'bg-slate-800 border-slate-700 p-4'}`}>
                  {isAdded ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                      <span className="truncate font-medium text-slate-300">{selectedPanel.name}</span>
                      <span className="ml-auto text-slate-500 whitespace-nowrap">Added</span>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                        <Package size={14} className="text-amber-500" />Selected Panels
                      </h4>
                      <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/50">
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm">{selectedPanel.name}</p>
                          <p className="text-xs text-slate-400 mt-1">{selectedPanel.powerW}W • {selectedProjectData.panelCount} pieces • {selectedPanel.quantity} in stock</p>
                          <p className="text-sm text-emerald-400 font-bold mt-1">{selectedPanel.sellPrice} RON/piece</p>
                        </div>
                        <button
                          onClick={() => {
                            addItemToQuote({ id: Date.now().toString(), inventoryItemId: selectedPanel.id, description: `${selectedPanel.name} (${selectedPanel.powerW}W)`, unit: 'piece', quantity: selectedProjectData.panelCount!, netPrice: selectedPanel.sellPrice, selectedSerialNumbers: [] });
                          }}
                          className="ml-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-xs transition-colors whitespace-nowrap"
                        >Add to Quote</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          {/* Mounting Structure */}
            {selectedProjectData.panelCount && (() => {
              const mountingSkuPattern = /\((CEND|CMID|CRAIL|CCOMB|CHOOK|CMINI)/i;
              const isMountingAdded = quoteItems.some(qi => mountingSkuPattern.test(qi.description));
              return (
                <div className={`border rounded-xl transition-all ${isMountingAdded ? 'bg-slate-800/50 border-slate-700/50 p-2' : 'bg-slate-800 border-slate-700 p-4'}`}>
                  {isMountingAdded ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                      <span className="font-medium text-slate-300">Mounting Structure</span>
                      <span className="text-slate-500">— {selectedProjectData.panelCount} panels</span>
                      <span className="ml-auto text-slate-500 whitespace-nowrap">Added</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          <Package size={14} className="text-amber-500" />Mounting Structure
                        </h4>
                        <button
                          onClick={() => addMountingStructuresToQuote(selectedProjectData)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-lg text-xs transition-colors flex items-center gap-2"
                        >
                          <Plus size={14} /> Add All to Quote
                        </button>
                      </div>
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-300">
                          Mounting structures calculated for <span className="font-bold">{selectedProjectData.panelCount} panels</span>.
                          Click "Add All to Quote" to include all components.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Quote Items Table - Only show when there are items or when actively editing a quote */}
        {(quoteItems.length > 0 || editingQuoteId || quoteProjectName.trim()) && (
          <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <FileText size={16} className="text-amber-500" />
                Quote Items
              </h3>
              <button 
                onClick={handleAddQuoteLine} 
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded font-bold text-xs transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> Add Line
              </button>
            </div>
            
            <div className="overflow-x-auto p-6">
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
                      No items yet. Click &quot;Add Line&quot; or add components from the project above.
                    </td>
                  </tr>
                ) : (
                  quoteItems.map((item, idx) => {
                    const lineNet = item.quantity * item.netPrice;
                    const inventoryItem = inventory.find(i => i.id === item.inventoryItemId);
                    const hasTrackedSerials = inventoryItem?.serialNumbers && inventoryItem.serialNumbers.length > 0;
                    const selectedCount = item.selectedSerialNumbers?.length || 0;
                    const isSerialPickerOpen = openSerialPickerId === `serial-${item.id}`;

                    // Autocomplete suggestions
                    const showSuggestions = focusedRowId === item.id && item.description.trim().length > 0;
                    const suggestions = showSuggestions
                      ? inventory.filter(p =>
                          p.name.toLowerCase().includes(item.description.toLowerCase()) ||
                          (p.sku || '').toLowerCase().includes(item.description.toLowerCase())
                        ).slice(0, 5)
                      : [];

                    // Serials: filter out ones already used in other rows
                    const serialsUsedElsewhere = quoteItems
                      .filter(i => i.id !== item.id)
                      .flatMap(i => i.selectedSerialNumbers || []);
                    let availableSerials = inventoryItem?.serialNumbers?.filter(
                      sn => !serialsUsedElsewhere.includes(sn)
                    ) || [];
                    if (serialSearchTerm) {
                      availableSerials = availableSerials.filter(sn =>
                        sn.toLowerCase().includes(serialSearchTerm.toLowerCase())
                      );
                    }
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-700/30 group border-b border-slate-700/50 last:border-0">
                        <td className="p-3 text-center text-slate-500 text-sm align-top pt-4">{idx + 1}</td>
                        <td className="p-3 align-top relative">
                          <div className="relative">
                            <textarea 
                              value={item.description}
                              onChange={(e) => updateQuoteLine(item.id, 'description', e.target.value)}
                              onFocus={() => setFocusedRowId(item.id)}
                              onBlur={() => setTimeout(() => setFocusedRowId(null), 200)}
                              placeholder="Description or search inventory..."
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
                                    onMouseDown={(e) => { e.preventDefault(); handleProductSelect(item.id, suggestion); }}
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
                          {/* Serial Number Picker */}
                          {hasTrackedSerials && (
                            <div className="mt-2 relative serial-picker-container">
                              <div className="flex flex-wrap gap-1 items-center">
                                <button
                                  onClick={() => {
                                    setOpenSerialPickerId(isSerialPickerOpen ? null : `serial-${item.id}`);
                                    setSerialSearchTerm('');
                                  }}
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
                                {(item.selectedSerialNumbers || []).map(sn => (
                                  <span key={sn} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                                    {sn}
                                  </span>
                                ))}
                              </div>
                              {isSerialPickerOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 p-2 flex flex-col">
                                  <input
                                    type="text"
                                    placeholder="Search serial..."
                                    value={serialSearchTerm}
                                    onChange={(e) => setSerialSearchTerm(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white mb-2 outline-none"
                                    autoFocus
                                  />
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {availableSerials.map(sn => {
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
                                    {availableSerials.length === 0 && (
                                      <div className="text-center text-[10px] text-slate-500 py-2">No serials found</div>
                                    )}
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
                            className="w-full bg-slate-900/50 border border-slate-600 rounded px-1 py-1.5 text-sm text-center text-white focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </td>
                        <td className="p-3 align-top">
                          <input 
                            type="number"
                            min="1"
                            readOnly={selectedCount > 0}
                            value={item.quantity} 
                            onChange={(e) => updateQuoteLine(item.id, 'quantity', Number(e.target.value))} 
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
                            onChange={(e) => updateQuoteLine(item.id, 'netPrice', Number(e.target.value))} 
                            className="w-full bg-slate-900/50 border border-slate-600 rounded px-1 py-1.5 text-sm text-right text-white focus:ring-1 focus:ring-amber-500 outline-none" 
                          />
                        </td>
                        <td className="p-3 text-right font-medium text-emerald-400 align-top pt-3.5">
                          {formatCurrency(lineNet)}
                        </td>
                        <td className="p-3 align-top text-center pt-2.5">
                          <button 
                            onClick={() => removeQuoteLine(item.id)} 
                            className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
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
          </section>
        )}

        {/* ─── Quote Related Documents ─── */}
        {editingQuoteId && (
          <section className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-blue-400" />
                Quote Related Documents
              </h3>
              {/* Status badge */}
              {(() => {
                const qs = currentQuote?.quoteStatus;
                if (!qs || qs === 'draft') return null;
                const configs: Record<string, { label: string; cls: string }> = {
                  sent: { label: 'Quote Sent', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
                  won_unallocated: { label: 'Quote WON — Not Allocated', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                  won_allocated: { label: `Quote WON — ${currentQuote?.assignedInstallers?.map(i => i.installerNickname).join(', ')}`, cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                };
                const cfg = configs[qs];
                return cfg ? (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>{cfg.label}</span>
                ) : null;
              })()}
            </div>

            {/* Template selection + generate */}
            {docTemplates && docTemplates.length > 0 && (
              <div className="mb-6 pb-6 border-b border-slate-700">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Generate from Template
                    </label>
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
                    onClick={generateDocumentFromTemplate}
                    disabled={!selectedTemplateId || isGenerating || quoteItems.length === 0}
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

            {/* Documents list */}
            {(generatedDocuments.length > 0 || companyDocsForQuote.length > 0) ? (
              <div className="space-y-2">
                {[...generatedDocuments, ...companyDocsForQuote.filter(cd => !generatedDocuments.some(gd => gd.id === cd.id))].map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(doc.date).toLocaleString('ro-RO')}
                        {doc.generatedBy && ` • by ${doc.generatedBy}`}
                      </p>
                      {(() => {
                        const pdfName = doc.name.replace('.docx', '.pdf');
                        const sentEntries = (currentQuote?.emailHistory || []).filter(e =>
                          e.documentId === doc.id || e.documentName === doc.name || e.documentName === pdfName
                        );
                        if (!sentEntries.length) return null;
                        const last = sentEntries[sentEntries.length - 1];
                        return (
                          <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-1">
                            <SendHorizonal size={10} />
                            Quote sent to {last.sentTo} on {new Date(last.sentAt).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(last.sentAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                            {sentEntries.length > 1 && <span className="text-slate-500 ml-1">({sentEntries.length}×)</span>}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setPreviewDoc({ id: doc.id, name: doc.name, url: doc.url, date: new Date(doc.date) })}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Eye size={14} />Preview
                      </button>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = doc.url; link.download = doc.name; link.target = '_blank';
                          document.body.appendChild(link); link.click(); document.body.removeChild(link);
                        }}
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Download size={14} />Download
                      </button>
                      <button
                        onClick={() => handleSendEmail(doc)}
                        disabled={sendingEmailDocId === doc.id || !client?.email}
                        title={!client?.email ? 'Client has no email address' : 'Send PDF offer by email'}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingEmailDocId === doc.id ? (
                          <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
                        ) : (
                          <><SendHorizonal size={14} />Send to Client</>
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmDialog({ message: `Delete "${doc.name}"?`, onConfirm: () => {
                          if (currentQuote) {
                            saveQuote({ ...currentQuote, generatedDocuments: (currentQuote.generatedDocuments || []).filter(d => d.id !== doc.id) });
                            showNotification('Document deleted', 'success');
                          }
                          setConfirmDialog(null);
                        }})}
                        className="p-2 text-red-500 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
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
          </section>
        )}

        {/* ─── Quote Won / Status Section ─── */}
        {editingQuoteId && (() => {
          const qs = currentQuote?.quoteStatus;
          const isWon = qs === 'won_unallocated' || qs === 'won_allocated';

          return (
            <section className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                <Award size={20} className="text-amber-400" />
                Quote Outcome
              </h3>

              {!isWon ? (
                <div className="space-y-4">
                  {/* Status info */}
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    qs === 'sent'
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-slate-900/50 border-slate-700'
                  }`}>
                    {qs === 'sent' ? (
                      <><SendHorizonal size={18} className="text-blue-400 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-blue-300">Quote Sent</p>
                        {currentQuote?.emailSentAt && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Sent to {currentQuote.emailSentTo} on {new Date(currentQuote.emailSentAt).toLocaleDateString('ro-RO')}
                          </p>
                        )}
                      </div></>
                    ) : (
                      <><FileText size={18} className="text-slate-500 shrink-0" />
                      <p className="text-sm text-slate-400">Draft — not yet sent to client</p></>
                    )}
                  </div>
                  {/* Won button */}
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
                  {/* Won status banner */}
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
                            {currentQuote?.assignedInstallers?.map(i => i.installerNickname).join(', ')}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Go to Installation page */}
                  <button
                    onClick={() => router.push(`/clients/${client.id}/installation`)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors border border-slate-600"
                  >
                    <Users size={18} />
                    Manage Installer Allocation on Installation page →
                  </button>

                  {/* Undo Won — SUPER_ADMIN only */}
                  {currentUser?.role === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => setConfirmDialog({
                        message: 'Reset this quote back to Draft/Sent status? This will remove any installer allocation.',
                        onConfirm: () => { handleUnmarkQuoteWon(); setConfirmDialog(null); },
                      })}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded-xl transition-colors text-sm"
                    >
                      <RotateCcw size={15} />
                      Undo Won
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        {/* Document Preview Modal */}
        {previewDoc && (
          <DocumentPreview 
            document={previewDoc as any}
            onClose={() => setPreviewDoc(null)}
            allowEdit={true}
            clientId={client.id}
            folder="quotes"
            onSave={async (newUrl) => {
              if (newUrl && currentQuote && previewDoc?.id) {
                const newName = previewDoc.name;
                const updatedDocuments = (currentQuote.generatedDocuments || []).map(d =>
                  d.id === previewDoc.id ? { ...d, url: newUrl, name: newName } : d
                );
                const updatedQuote: Quote = { ...currentQuote, generatedDocuments: updatedDocuments };
                saveQuote(updatedQuote);
                setPreviewDoc(prev => prev ? { ...prev, url: newUrl, name: newName } : null);
              }
              showNotification('Document saved successfully!', 'success');
            }}
            onPdfCreated={(pdfDoc) => {
              if (currentQuote) {
                const updatedDocuments = [...generatedDocuments, pdfDoc];
                const updatedQuote: Quote = {
                  ...currentQuote,
                  generatedDocuments: updatedDocuments
                };
                saveQuote(updatedQuote);
                showNotification(`PDF created: ${pdfDoc.name}`, 'success');
              }
            }}
            onSendEmail={(doc) => {
              setPreviewDoc(null);
              handleSendEmail(doc);
            }}
          />
        )}

        {/* Email Preview Modal */}
        {showEmailPreview && emailPreviewData && (
          <EmailPreviewModal
            isOpen={showEmailPreview}
            onClose={() => {
              setShowEmailPreview(false);
              setEmailPreviewData(null);
            }}
            onSend={handleConfirmSendEmail}
            initialData={{
              to: emailPreviewData.to,
              subject: emailPreviewData.subject,
              body: emailPreviewData.body,
              attachments: emailPreviewData.attachments || [],
            }}
            signature={smtpSettings?.signature || ''}
          />
        )}

        {/* Save Mode Modal (overwrite vs new version) */}
        {saveModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <Save size={24} className="text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">Save Quote</h3>
                    <p className="text-slate-300 text-sm">
                      A quote named <span className="font-bold text-amber-400">&ldquo;{quoteProjectName}&rdquo;</span> already exists.
                      Do you want to overwrite it or save it as a new version?
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setSaveModal({ show: false });
                      saveClientQuote(false, true);
                    }}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-colors"
                  >
                    Overwrite existing quote
                  </button>
                  <button
                    onClick={() => {
                      setSaveModal({ show: false });
                      saveClientQuote(true, false);
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
                  >
                    Save as new version
                  </button>
                  <button
                    onClick={() => setSaveModal({ show: false })}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Format Warning Modal */}
        {docFormatWarning.show && docFormatWarning.doc && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-amber-500/50 shadow-2xl max-w-md w-full">
              <div className="flex items-start gap-3 p-6 border-b border-slate-700">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={24} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">DOCX Document Detected</h3>
                  <p className="text-sm text-slate-300">
                    This is a DOCX file. For email attachments, it should be converted to PDF format.
                  </p>
                </div>
              </div>
              
              <div className="p-6 space-y-3">
                <button
                  onClick={() => {
                    const doc = docFormatWarning.doc!;
                    setDocFormatWarning({ show: false, doc: null });
                    setPreviewDoc({ id: doc.id, name: doc.name, url: doc.url, date: doc.date });
                  }}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Eye size={18} />
                  Preview & Convert to PDF First
                </button>
                
                <button
                  onClick={async () => {
                    const doc = docFormatWarning.doc!;
                    setDocFormatWarning({ show: false, doc: null });
                    await prepareEmailPreview(doc);
                  }}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Mail size={18} />
                  Convert & Send Now
                </button>
                
                <button
                  onClick={() => setDocFormatWarning({ show: false, doc: null })}
                  className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        )}
      </div>
    </div>
  );
}
