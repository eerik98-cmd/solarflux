'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Client, ClientType, ClientNote, ClientSiteImage, InventoryItem, Quote, QuoteLineItem, DocTemplate, Category, ArchivedProject } from '../types';
// Added Loader2 to the lucide-react imports
import { Search, Building2, User, Phone, Mail, MapPin, Plus, ArrowLeft, ArrowRight, X, CheckCircle, FileText, Zap, FolderOpen, Upload, Trash2, ExternalLink, Printer, Save, ClipboardList, Camera, Image as ImageIcon, History, RefreshCcw, ChevronDown, Package, FileCog, FileOutput, Hash, Briefcase, Info, Code, Loader2, AlertCircle, Eye, Edit2, Download, File, CheckSquare, Square } from 'lucide-react';
import { FileSystem, getFolderForDocType } from '../services/fileSystemService';
import { ConfirmDialog } from './ConfirmDialog';

interface ClientRegistryProps {
  clients: Client[];
  currentUser: any;
  onAddClient: (client: Client) => void | Promise<void>;
  onUpdateClient: (client: Client) => void | Promise<void>;
  onDeleteClient: (id: string) => void | Promise<void>;
  inventory: InventoryItem[];
  savedQuotes: Quote[];
  onSaveQuote: (quote: Quote) => void;
  onDeleteQuote: (id: string) => void;
  docTemplates: DocTemplate[];
}

type ModalStep = 'TYPE_SELECTION' | 'FORM';
type DetailTab = 'DATA' | 'NEEDS' | 'DOCUMENTS' | 'QUOTES' | 'DOC_GEN';

const isPdfDoc = (doc: any) =>
  !!doc.url && (doc.url.startsWith('data:application/pdf') || doc.name?.toLowerCase().endsWith('.pdf'));

const PdfPreview: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-auto rounded-lg border border-slate-700 bg-slate-950">
        <iframe
          src={url}
          title={title}
          className="w-full h-full min-h-[600px]"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
};

export const ClientRegistry: React.FC<ClientRegistryProps> = ({ 
  clients, currentUser, onAddClient, onUpdateClient, onDeleteClient, inventory, savedQuotes, onSaveQuote, onDeleteQuote, docTemplates
}) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('DATA');
  
  // List State
  const [filterType] = useState<'ALL' | ClientType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('TYPE_SELECTION');
  const [selectedType, setSelectedType] = useState<ClientType>(ClientType.PRIVATE);

  // Form State (New Client)
  const [newClientFormData, setNewClientFormData] = useState<Partial<Client>>({});

  // Editing State (For existing client)
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Notes State
  const [newNote, setNewNote] = useState('');

  // Documents / File System State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('CI');
  const [docInput, setDocInput] = useState('');
  const [docDescription, setDocDescription] = useState(''); 

  // Camera State for Needs Tab
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Quote Tab State
  const [quoteProjectName, setQuoteProjectName] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [openSerialPickerId, setOpenSerialPickerId] = useState<string | null>(null);
  const [selectedProjectForQuote, setSelectedProjectForQuote] = useState<string>('');

  // Document Generator State
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedQuoteForGen, setSelectedQuoteForGen] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Needs Tab Specific State (For calculation effects)
  const [tempDescription, setTempDescription] = useState('');

  // State for alternatives dropdown
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showBatteryAlternatives, setShowBatteryAlternatives] = useState(false);
  const [showPanelAlternatives, setShowPanelAlternatives] = useState(false);

  // Selected inverter, panel and battery state
  const [selectedInverterId, setSelectedInverterId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(null);

  // Saved projects state
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProject[]>([]);
  
  // Missing state variables
  const [hasChanges, setHasChanges] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedPanelQty, setSelectedPanelQty] = useState<number>(0);
  
  // Row configuration state
  const [rowCount, setRowCount] = useState<number>(1);
  const [rowDistribution, setRowDistribution] = useState<{[key: number]: number}>({1: 0});
  
  // Image preview modal state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);
  
  // Document preview and edit modals
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [editingDoc, setEditingDoc] = useState<any>(null);
// Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    thirdButtonLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    onThirdButton?: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  
  useEffect(() => {
    if (selectedClient) {
      setEditingClient(JSON.parse(JSON.stringify(selectedClient))); 
      setTempDescription(selectedClient.needs?.description || '');
      setArchivedProjects(selectedClient.archivedProjects || []);
      setHasChanges(false);
      setQuoteItems([]);
      setQuoteProjectName('');
      setActiveTab('DATA');
      setTemplateFile(null);
      setSelectedTemplateId('');
      setSelectedQuoteForGen('');
      setDocType('CI');
      
      // Restore selected items
      setSelectedInverterId(selectedClient.needs?.selectedInverterId || null);
      setSelectedBatteryId(selectedClient.needs?.selectedBatteryId || null);
      setSelectedPanelId(selectedClient.needs?.panelStockItemId || null);
      setSelectedPanelQty(selectedClient.needs?.panelCount || 0);
      setDocInput('');
      setUploadFile(null);
    }
  }, [selectedClient]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openSerialPickerId && !(event.target as Element).closest('.serial-picker-container')) {
        setOpenSerialPickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSerialPickerId]);

  const filteredClients = (clients || []).filter(client => {
    const matchesType = filterType === 'ALL' || client.type === filterType;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      client.name.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower) ||
      (client.internalId && client.internalId.toLowerCase().includes(searchLower)) ||
      (client.companyName && client.companyName.toLowerCase().includes(searchLower));
    
    return matchesType && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'LEAD': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'CLOSED': return 'bg-slate-700 text-slate-400 border-slate-600';
      default: return 'bg-slate-700 text-slate-400';
    }
  };

  const generateNextInternalId = (type: ClientType): string => {
    const prefix = "SI_";
    const isCorp = type === ClientType.CORPORATE;
    const min = isCorp ? 2000 : 3000;
    const max = isCorp ? 2999 : 3999;
    const existingIds = clients
      .filter(c => c.type === type && c.internalId && c.internalId.startsWith(prefix))
      .map(c => parseInt(c.internalId!.replace(prefix, ''), 10))
      .filter(n => !isNaN(n) && n >= min && n <= max);
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : min;
    return `${prefix}${nextNum}`;
  };

  const handleOpenModal = () => {
    setStep('TYPE_SELECTION');
    setNewClientFormData({ country: 'Romania' });
    setIsModalOpen(true);
  };

  const handleTypeSelect = (type: ClientType) => {
    setSelectedType(type);
    setStep('FORM');
  };

  const handleNewClientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewClientFormData({ ...newClientFormData, [e.target.name]: e.target.value });
  };

  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = selectedType === ClientType.PRIVATE 
      ? `${newClientFormData.lastName || ''} ${newClientFormData.firstName || ''}`.trim()
      : newClientFormData.companyName || 'Unknown Company';
    const addressString = [
      newClientFormData.street, 
      newClientFormData.streetNumber ? `Nr. ${newClientFormData.streetNumber}` : '',
      newClientFormData.city,
      newClientFormData.county,
      newClientFormData.country
    ].filter(Boolean).join(', ');
    const newClient: Client = {
      id: Date.now().toString(),
      internalId: generateNextInternalId(selectedType),
      type: selectedType,
      status: 'LEAD',
      name: displayName,
      address: addressString,
      email: newClientFormData.email || '',
      phone: newClientFormData.phone || '',
      needs: {},
      notes: [],
      documents: [],
      ...newClientFormData
    } as Client;
    await FileSystem.createClientRepository(newClient);
    onAddClient(newClient);
    setIsModalOpen(false);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingClient) return;
    setEditingClient({ ...editingClient, [e.target.name]: e.target.value });
    setHasChanges(true);
  };

  const handleNeedsChange = (field: string, value: any) => {
    if (!editingClient) return;
    setEditingClient({ ...editingClient, needs: { ...editingClient.needs, [field]: value } });
    setHasChanges(true);
  };

  const handleDescriptionChange = (newDesc: string) => {
    setTempDescription(newDesc);
    if (editingClient) setHasChanges(true);
  };

  const saveDescription = () => {
    if (!editingClient || tempDescription === editingClient.needs?.description) return;
    setEditingClient({
        ...editingClient,
        needs: {
            ...editingClient.needs,
            description: tempDescription,
            descriptionUpdatedBy: currentUser?.nickname || 'Unknown',
            descriptionUpdatedAt: new Date()
        }
    });
  };

  // Unused - kept for future use
  /*
  const handleSaveChanges = () => {
    if (!editingClient) return;
    const finalNeeds = { ...editingClient.needs };
    if (tempDescription !== editingClient.needs?.description) {
        finalNeeds.description = tempDescription;
        finalNeeds.descriptionUpdatedBy = currentUser?.nickname || 'Unknown';
        finalNeeds.descriptionUpdatedAt = new Date();
    }
    let updatedName = editingClient.name;
    if (editingClient.type === ClientType.PRIVATE) {
       updatedName = `${editingClient.lastName || ''} ${editingClient.firstName || ''}`.trim();
    } else {
       updatedName = editingClient.companyName || editingClient.name;
    }
    const updatedAddress = [
      editingClient.street, 
      editingClient.streetNumber ? `Nr. ${editingClient.streetNumber}` : '',
      editingClient.city,
      editingClient.county,
      editingClient.country
    ].filter(Boolean).join(', ');
    const finalClient = {
      ...editingClient,
      name: updatedName,
      address: updatedAddress,
      needs: finalNeeds
    };
    onUpdateClient(finalClient);
    setSelectedClient(finalClient);
    setHasChanges(false);
  };
  */

  // Unused - kept for future use
  /*
  const handlePanelCalculation = (type: 'KW_TO_COUNT' | 'COUNT_TO_KW', value: number) => {
    if (!editingClient) return;
    const panelId = editingClient.needs?.panelStockItemId;
    const selectedPanel = inventory.find(i => i.id === panelId);
    if (!selectedPanel || !selectedPanel.powerW) {
        if (type === 'KW_TO_COUNT') handleNeedsChange('panelKw', value);
        else handleNeedsChange('panelCount', value);
        return;
    }
    const powerW = selectedPanel.powerW;
    if (type === 'KW_TO_COUNT') {
        const pieces = Math.ceil((value * 1000) / powerW);
        setEditingClient(prev => prev ? ({
            ...prev,
            needs: { ...prev.needs, panelKw: value, panelCount: pieces }
        }) : null);
    } else {
        const kw = (value * powerW) / 1000;
        setEditingClient(prev => prev ? ({
            ...prev,
            needs: { ...prev.needs, panelCount: value, panelKw: Number(kw.toFixed(3)) }
        }) : null);
    }
  };
  */

  const suggestedInverters = useMemo(() => {
    if (!editingClient?.needs?.inverterKw) return [];
    const connectionType = editingClient.needs.connectionType;
    const targetKw = editingClient.needs.inverterKw;
    const tolerance = 2; // ±2kW range
    
    return inventory.filter(item => {
        if (item.category !== Category.INVERTERS) return false;
        
        // Check connection type compatibility - use inverterConnectionType field
        if (connectionType && item.inverterConnectionType) {
          if (item.inverterConnectionType !== connectionType) return false;
        }
        
        // Check power within ±2kW
        if (item.inverterPowerKw) {
          return Math.abs(item.inverterPowerKw - targetKw) <= tolerance;
        }
        return false;
    });
  }, [editingClient?.needs?.inverterKw, editingClient?.needs?.connectionType, inventory]);

  const suggestedBatteries = useMemo(() => {
    if (!editingClient?.needs?.selectedInverterId) return [];
    
    // Get the selected inverter from inventory
    const selectedInverter = inventory.find(i => i.id === editingClient.needs.selectedInverterId);
    if (!selectedInverter?.inverterStorageType) return [];

    // Filter batteries by matching storage type
    return inventory.filter(item => {
      if (item.category !== Category.BATTERIES) return false;
      if (item.batteryType === selectedInverter.inverterStorageType && item.quantity > 0) return true;
      return false;
    });
  }, [editingClient?.needs?.selectedInverterId, inventory]);

  const handleAddNote = () => {
    if (!editingClient || !newNote.trim()) return;
    const newNoteObj: ClientNote = { id: Date.now().toString(), content: newNote, date: new Date(), author: currentUser?.nickname || 'Unknown' };
    const updatedClient = { ...editingClient, notes: [newNoteObj, ...(editingClient.notes || [])] };
    onUpdateClient(updatedClient);
    setSelectedClient(updatedClient);
    setEditingClient(updatedClient);
    setNewNote('');
  };

  const handleDeleteNote = (noteId: string) => {
    if (!editingClient) return;
    if (currentUser?.role !== 'SUPER_ADMIN' && !editingClient.notes?.find(n => n.id === noteId && n.author === currentUser?.nickname)) {
         alert("You can only delete your own notes."); return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Note',
      message: 'Are you sure you want to delete this note? This action cannot be undone.',
      variant: 'danger',
      onConfirm: () => {
        const updatedClient = { ...editingClient, notes: editingClient.notes?.filter(n => n.id !== noteId) };
        onUpdateClient(updatedClient);
        setSelectedClient(updatedClient);
        setEditingClient(updatedClient);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setUploadFile(e.target.files[0]);
  };

  const handleUploadDocument = async () => {
    if (!editingClient || !uploadFile) return;
    const internalId = editingClient.internalId || 'NO_ID';
    const typeLabel = docType;
    let generatedName = `[${internalId}] ${typeLabel} ${editingClient.name}`;
    let description = docDescription.trim();
    
    // Map docType to valid FileSystem types
    let fsType: 'CI' | 'CF' | 'Fact' | 'Other' = 'Other';
    if (docType === 'CI') fsType = 'CI';
    else if (docType === 'CF') fsType = 'CF';
    else if (docType === 'Factura') {
      fsType = 'Fact';
      if (docInput.trim()) description = description ? `${description} - POD: ${docInput}` : `POD: ${docInput}`;
    } else if (docType === 'CUI') {
      fsType = 'Other';
      generatedName = `[${internalId}] CUI ${editingClient.name}`;
    } else if (docType === 'Other' && docInput.trim()) {
      generatedName = `[${internalId}] ${docInput.trim()} ${editingClient.name}`;
    }
    
    try {
      const newDoc = await FileSystem.saveFile(editingClient, uploadFile, getFolderForDocType(docType), fsType, generatedName);
      newDoc.description = description;
      const updatedClient = { ...editingClient, documents: [newDoc, ...(editingClient.documents || [])] };
      onUpdateClient(updatedClient);
      setSelectedClient(updatedClient);
      setEditingClient(updatedClient);
      setUploadFile(null);
      setDocInput('');
      setDocDescription('');
      setDocType('CI');
    } catch (error) { console.error(error); alert("Failed to upload document"); }
  };

  const handleDeleteDocument = (docId: string) => {
    console.log('handleDeleteDocument called with docId:', docId);
    console.log('Current editingClient:', editingClient);
    console.log('Current documents:', editingClient?.documents);
    
    if (!editingClient) {
      console.log('No editingClient - aborting delete');
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      variant: 'danger',
      onConfirm: () => {
        console.log('Delete confirmed for docId:', docId);
        const updatedClient = { ...editingClient, documents: editingClient.documents?.filter(d => d.id !== docId) || [] };
        console.log('Updated client:', updatedClient);
        console.log('Calling onUpdateClient...');
        onUpdateClient(updatedClient);
        setSelectedClient(updatedClient);
        setEditingClient(updatedClient);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        console.log('Delete complete');
      }
    });
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
    // Simple approach: open in new window with print-ready content
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
    } else if (url.includes('data:text')) {
      const textContent = atob(url.split(',')[1]);
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Document</title>
            <style>
              body { margin: 20px; font-family: monospace; white-space: pre-wrap; }
            </style>
          </head>
          <body><pre>${textContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          <script>setTimeout(() => { window.print(); }, 500);</script>
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
  
  const handleEditDocument = () => {
    if (!editingDoc || !editingClient) return;
    const updatedDocs = editingClient.documents?.map(d => 
      d.id === editingDoc.id ? editingDoc : d
    ) || [];
    const updated = { ...editingClient, documents: updatedDocs };
    onUpdateClient(updated);
    setEditingDoc(null);
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
      } catch { alert("Could not access camera."); }
    }
  };
  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
  };
  // Unused - kept for future use
  /*
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (context) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const imageBase64 = canvasRef.current.toDataURL('image/jpeg');
      const newImage: ClientSiteImage = { id: Date.now().toString(), url: imageBase64, timestamp: new Date() };
      const currentImages = editingClient?.needs?.siteImages || [];
      handleNeedsChange('siteImages', [...currentImages, newImage]);
      stopCamera();
    }
  };
  */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const currentImages = editingClient?.needs?.siteImages || [];
      const newImages: ClientSiteImage[] = [];
      let processed = 0;
      
      Array.from(e.target.files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = () => {
          newImages.push({
            id: `${Date.now()}_${index}`,
            url: reader.result as string,
            timestamp: new Date() as any,
            label: '',
            category: undefined
          });
          processed++;
          
          if (processed === e.target.files!.length) {
            const updatedImages = [...currentImages, ...newImages];
            const updated = { ...editingClient, needs: { ...editingClient.needs, siteImages: updatedImages } };
            setEditingClient(updated);
            onUpdateClient(updated);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };
  const handleDeleteImage = (imageId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Image',
      message: 'Are you sure you want to delete this image? This action cannot be undone.',
      variant: 'danger',
      onConfirm: () => {
        const currentImages = editingClient?.needs?.siteImages || [];
        const updatedImages = currentImages.filter(img => img.id !== imageId);
        const updated = { ...editingClient, needs: { ...editingClient.needs, siteImages: updatedImages } };
        setEditingClient(updated);
        onUpdateClient(updated);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleAddQuoteLine = () => {
    const newItem: QuoteLineItem = { id: Date.now().toString() + Math.random().toString(), description: '', unit: 'pcs', quantity: 1, netPrice: 0 };
    setQuoteItems([...quoteItems, newItem]);
  };
  const updateQuoteLine = (id: string, field: keyof QuoteLineItem, value: string | number) => {
    setQuoteItems(quoteItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  // const selectQuoteProduct = (id: string, product: InventoryItem) => {
  //   setQuoteItems(quoteItems.map(item => item.id === id ? { ...item, inventoryItemId: product.id, description: product.name, netPrice: product.sellPrice, unit: 'pcs', selectedSerialNumbers: [] } : item));
  //   setFocusedRowId(null);
  // };
  const removeQuoteLine = (id: string) => setQuoteItems(quoteItems.filter(item => item.id !== id));
  
  // Function to calculate and add mounting structure components to quote
  const addMountingStructuresToQuote = () => {
    if (!editingClient?.needs?.panelCount) {
      alert('Panel count not configured in Client Needs');
      return;
    }

    const totalPanels = editingClient.needs.panelCount;
    const roofType = editingClient.needs.roofType;
    
    // Determine row configuration
    let rowConfigs: number[] = [];
    if (rowCount === 1) {
      rowConfigs = [totalPanels];
    } else {
      const totalDistributed = Object.values(rowDistribution).reduce((sum, val) => sum + val, 0);
      if (totalDistributed === totalPanels) {
        rowConfigs = Array.from({length: rowCount}, (_, i) => rowDistribution[i + 1] || 0);
      } else {
        alert('Please complete row distribution in Client Needs before adding mounting structures');
        return;
      }
    }

    if (rowConfigs.length === 0 || rowConfigs.some(c => c === 0)) {
      alert('Please configure row distribution in Client Needs');
      return;
    }

    // Calculate components
    const numRows = rowConfigs.length;
    const endClamps = numRows * 4;
    const midClamps = rowConfigs.reduce((sum, panelsInRow) => sum + (panelsInRow - 1) * 2, 0);
    
    // Rail calculations
    const selectedPanel = editingClient.needs.panelStockItemId 
      ? inventory.find(i => i.id === editingClient.needs.panelStockItemId) 
      : null;
    const panelWidth = selectedPanel?.panelWidth || 1.134;
    const maxPanelsInRow = Math.max(...rowConfigs);
    const railLengthPerRow = maxPanelsInRow * panelWidth;
    const railLengthWithWaste = railLengthPerRow * 1.1;
    const railsPerRow = 2;
    const sectionsPerRail = Math.ceil(railLengthWithWaste / 6);
    const railsOf6m = sectionsPerRail * numRows * railsPerRow;
    const combinersPerRail = sectionsPerRail > 1 ? sectionsPerRail - 1 : 0;
    const totalCombiners = combinersPerRail * numRows * railsPerRow;
    
    // Roof attachments
    let attachmentType = 'Roof Attachments (Hooks/Bolts)';
    let attachmentsPerPanel = 4;
    
    if (roofType === 'Tigla ceramica' || roofType === 'Tigla metalica') {
      attachmentType = 'Tile Hooks';
      attachmentsPerPanel = 5;
    } else if (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata') {
      attachmentType = 'Hanger Bolts';
      attachmentsPerPanel = 4;
    } else if (roofType === 'Panou sandwich') {
      attachmentType = 'Sandwich Panel Bolts';
      attachmentsPerPanel = 4;
    }
    
    const totalAttachments = totalPanels * attachmentsPerPanel;

    // Find matching items from inventory for pricing
    const findMountingItem = (name: string, category: Category = Category.MOUNTING) => {
      return inventory.find(i => 
        i.category === category && 
        i.name.toLowerCase().includes(name.toLowerCase())
      );
    };

    // Create line items for mounting structures
    const mountingItems: QuoteLineItem[] = [];
    const timestamp = Date.now();

    // End Clamps
    const endClampItem = findMountingItem('end clamp');
    mountingItems.push({
      id: `${timestamp}-end-clamps`,
      inventoryItemId: endClampItem?.id,
      description: endClampItem ? `${endClampItem.name} (End Clamps)` : 'End Clamps',
      unit: 'pcs',
      quantity: endClamps,
      netPrice: endClampItem?.sellPrice || 0
    });

    // Mid Clamps
    const midClampItem = findMountingItem('mid clamp');
    mountingItems.push({
      id: `${timestamp}-mid-clamps`,
      inventoryItemId: midClampItem?.id,
      description: midClampItem ? `${midClampItem.name} (Mid Clamps)` : 'Mid Clamps',
      unit: 'pcs',
      quantity: midClamps,
      netPrice: midClampItem?.sellPrice || 0
    });

    // Rails
    const railItem = findMountingItem('rail');
    mountingItems.push({
      id: `${timestamp}-rails`,
      inventoryItemId: railItem?.id,
      description: railItem ? `${railItem.name} (6m Rails)` : 'Mounting Rails (6m)',
      unit: 'pcs',
      quantity: railsOf6m,
      netPrice: railItem?.sellPrice || 0
    });

    // Combiners
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

    // Roof Attachments
    const attachmentItem = findMountingItem(attachmentType);
    mountingItems.push({
      id: `${timestamp}-attachments`,
      inventoryItemId: attachmentItem?.id,
      description: attachmentItem ? `${attachmentItem.name}` : attachmentType,
      unit: 'pcs',
      quantity: totalAttachments,
      netPrice: attachmentItem?.sellPrice || 0
    });

    // Add all mounting items to quote
    setQuoteItems([...quoteItems, ...mountingItems]);
    
    // Show confirmation
    const missingPrices = mountingItems.filter(i => i.netPrice === 0).length;
    if (missingPrices > 0) {
      alert(`Mounting structures added! Note: ${missingPrices} item(s) have no price set. Please update prices manually or add the items to inventory.`);
    } else {
      alert('Mounting structures added successfully!');
    }
  };
  // const toggleQuoteSerialNumber = (itemId: string, serial: string) => {
  //   setQuoteItems(prevItems => prevItems.map(item => {
  //     if (item.id !== itemId) return item;
  //     const currentSerials = item.selectedSerialNumbers || [];
  //     const newSerials = currentSerials.includes(serial) ? currentSerials.filter(s => s !== serial) : [...currentSerials, serial];
  //     return { ...item, selectedSerialNumbers: newSerials, quantity: newSerials.length > 0 ? newSerials.length : item.quantity };
  //   }));
  // };
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
    const container = document.querySelector('.quote-scroll-container');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const saveClientQuote = () => {
    if (!editingClient || quoteItems.length === 0 || !quoteProjectName.trim()) { alert("Please ensure project name is set and items are added."); return; }
    let targetId = editingQuoteId;
    if (!targetId) {
        const existingByName = savedQuotes.find(q => q.clientId === editingClient.id && q.title === quoteProjectName.trim());
        targetId = existingByName ? existingByName.id : Date.now().toString();
    }
    const newQuote: Quote = { id: targetId, clientId: editingClient.id, title: quoteProjectName.trim(), customerName: editingClient.name, date: new Date(), items: [...quoteItems], ...quoteTotals };
    onSaveQuote(newQuote);
    setEditingQuoteId(targetId);
    alert('Quote saved successfully.');
  };
  const clientQuotes = savedQuotes.filter(q => q.clientId === editingClient?.id);

  const handleTemplateSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setTemplateFile(e.target.files[0]);
  };
  const handleStoredTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (!id) { setTemplateFile(null); return; }
    const template = docTemplates.find(t => t.id === id);
    if (template) {
        const byteCharacters = atob(template.content.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const file = new File([blob], template.name, { type: blob.type });
        setTemplateFile(file);
    }
  };

  const generateDocument = async () => {
    if (!templateFile || !editingClient) return;
    setIsGenerating(true);
    try {
      const [PizZipModule, DocxtemplaterModule, FileSaverModule] = await Promise.all([
        import('pizzip'),
        import('docxtemplater'),
        import('file-saver')
      ]);

      const PizZip: any = (PizZipModule as any).default || PizZipModule;
      const Docxtemplater: any = (DocxtemplaterModule as any).default || DocxtemplaterModule;
      const saveAs = (FileSaverModule as any).saveAs || (FileSaverModule as any).default || FileSaverModule;

      const reader = new FileReader();
      reader.onload = async function(evt) {
        if (!evt.target?.result) return;
        try {
          const content = evt.target.result as ArrayBuffer;
          const zip = new PizZip(content);
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
          const formatCurrency = (val: number) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(val);
          
          const data: any = {
             client_name: editingClient.name || '',
             internal_id: editingClient.internalId || '',
             client_address: editingClient.address || '',
             client_email: editingClient.email || '',
             client_phone: editingClient.phone || '',
             client_type: editingClient.type || '',
             
             // Private client specific
             first_name: editingClient.firstName || '',
             last_name: editingClient.lastName || '',
             cnp: editingClient.cnp || '',
             dob: editingClient.dateOfBirth || '',
             
             // Corporate client specific
             company_name: editingClient.companyName || '',
             tax_id: editingClient.taxId || '',
             reg_number: editingClient.regNumber || '',
             iban: editingClient.iban || '',
             bank_name: editingClient.bankName || '',
             representative: editingClient.representative || '',
             
             today_date: new Date().toLocaleDateString('ro-RO'),
             items: []
          };

          if (selectedQuoteForGen) {
             const quote = savedQuotes.find(q => q.id === selectedQuoteForGen);
             if (quote) {
               data.quote_title = quote.title || 'Untitled Offer';
               data.quote_date = new Date(quote.date).toLocaleDateString('ro-RO');
               data.subtotal_net = formatCurrency(quote.subtotalNet);
               data.vat_total = formatCurrency(quote.vatTotal);
               data.total_gross = formatCurrency(quote.totalGross);
               data.items = quote.items.map(item => ({
                 description: item.description || '',
                 qty: item.quantity || 0,
                 unit: item.unit || 'pcs',
                 net_price: formatCurrency(item.netPrice || 0),
                 total_price: formatCurrency((item.quantity || 0) * (item.netPrice || 0)),
                 serials: item.selectedSerialNumbers?.join(', ') || ''
               }));
             }
          }

          doc.render(data);
          const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          });
          
          const fileName = `[${editingClient.internalId}] ${selectedQuoteForGen ? 'Offer' : 'Doc'} - ${editingClient.name}.docx`;
          saveAs(out, fileName);

          const legalDoc = await FileSystem.saveFile(editingClient, out, 'legal', 'Other', fileName.replace('.docx', ''));
          const updatedClient = { ...editingClient, documents: [legalDoc, ...(editingClient.documents || [])] };
          onUpdateClient(updatedClient);
          setSelectedClient(updatedClient);
          setEditingClient(updatedClient);

          setIsGenerating(false);
        } catch (error) { console.error(error); alert("Error generating document."); setIsGenerating(false); }
      };
      reader.readAsArrayBuffer(templateFile);
    } catch (err) { console.error(err); alert("Generation failed."); setIsGenerating(false); }
  };

  const PLACEHOLDERS = [
    { tag: '{client_name}', desc: 'Full name or company name' },
    { tag: '{internal_id}', desc: 'System ID (SI_XXXX)' },
    { tag: '{client_address}', desc: 'Full address' },
    { tag: '{client_email}', desc: 'Primary contact email' },
    { tag: '{client_phone}', desc: 'Primary contact phone' },
    { tag: '{tax_id}', desc: 'Corporate Tax ID / CUI' },
    { tag: '{reg_number}', desc: 'Registration Number / J' },
    { tag: '{iban}', desc: 'Bank Account Number' },
    { tag: '{cnp}', desc: 'Private Personal ID' },
    { tag: '{today_date}', desc: 'Current system date' },
    { tag: '{#items}...{/items}', desc: 'Loop for quote items' },
    { tag: '{description}', desc: 'Inside items loop' },
    { tag: '{total_gross}', desc: 'Grand total with VAT' },
  ];

  if (selectedClient && editingClient) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <header className="p-6 border-b border-slate-700 bg-slate-800 flex items-center gap-4">
          <button onClick={() => {
            setSelectedClient(null);
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          }} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={24} /></button>
          <div><h1 className="text-2xl font-bold text-white leading-tight">{editingClient.name}</h1><div className="flex items-center gap-2 mt-1"><span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(editingClient.status)}`}>{editingClient.status}</span><span className="text-sm text-slate-400 flex items-center gap-1">{editingClient.type === ClientType.CORPORATE ? <Building2 size={14}/> : <User size={14}/>}{editingClient.type}</span></div></div>

        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 space-y-2">
            {[
              { id: 'DATA', label: 'Client Data', icon: FileText },
              { id: 'NEEDS', label: 'Clients Need', icon: Zap },
              { id: 'DOCUMENTS', label: 'File Manager', icon: FolderOpen },
              { id: 'QUOTES', label: 'Client Quotes', icon: ClipboardList }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as DetailTab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${activeTab === tab.id ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                <tab.icon size={18} /> <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </aside>

          <div className="flex-1 overflow-y-auto p-8 bg-slate-900 custom-scrollbar quote-scroll-container">
            {activeTab === 'DATA' && (
              <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
                <section className="space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Hash size={20} className="text-amber-500" />Internal Identification</h3>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                         <div className="flex flex-col">
                             <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Registration ID (SI_XXXX)</label>
                             <input name="internalId" value={editingClient.internalId || ''} onChange={handleEditChange} disabled={currentUser?.role !== 'SUPER_ADMIN'} className={`w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none font-mono ${currentUser?.role !== 'SUPER_ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="Auto-generated" />
                             {currentUser?.role !== 'SUPER_ADMIN' && <span className="text-[10px] text-slate-500 mt-1">Only Super Admins can manually edit the Internal ID.</span>}
                         </div>
                    </div>
                </section>
                <section className="space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><User size={20} className="text-amber-500" />Profile Information</h3>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                         {editingClient.type === ClientType.PRIVATE ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Last Name</label><input name="lastName" value={editingClient.lastName || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">First Name</label><input name="firstName" value={editingClient.firstName || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">CNP</label><input name="cnp" value={editingClient.cnp || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Date of Birth</label><input type="date" name="dateOfBirth" value={editingClient.dateOfBirth || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2"><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Company Name</label><input name="companyName" value={editingClient.companyName || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Tax ID</label><input name="taxId" value={editingClient.taxId || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Reg Number</label><input name="regNumber" value={editingClient.regNumber || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Bank Name</label><input name="bankName" value={editingClient.bankName || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">IBAN</label><input name="iban" value={editingClient.iban || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                                <div className="md:col-span-2"><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Legal Representative</label><input name="representative" value={editingClient.representative || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                             </div>
                         )}
                    </div>
                </section>
                <section className="space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><MapPin size={20} className="text-amber-500" />Address</h3>
                     <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Country</label><input name="country" value={editingClient.country || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                            <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">County</label><input name="county" value={editingClient.county || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                            <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">City</label><input name="city" value={editingClient.city || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                            <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Street</label><input name="street" value={editingClient.street || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                            <div><label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Number</label><input name="streetNumber" value={editingClient.streetNumber || ''} onChange={handleEditChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white outline-none" /></div>
                        </div>
                     </div>
                </section>
                <section className="space-y-6 pt-6 border-t border-slate-700">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><ClipboardList size={20} className="text-amber-500" />Internal Notes History</h3>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                        <div className="mb-6 flex gap-2"><textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none resize-none" rows={2} placeholder="Type note..." /><button onClick={handleAddNote} disabled={!newNote.trim()} className="bg-amber-500 text-slate-900 font-bold px-6 rounded-lg">Add</button></div>
                        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                             {editingClient.notes && editingClient.notes.map(note => (
                                <div key={note.id} className="relative pl-6 border-l-2 border-slate-700 pb-1 group">
                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                    <div className="flex justify-between items-start"><div className="text-xs text-slate-500 mb-1 flex items-center gap-2"><span className="text-slate-300 font-bold">{note.author}</span><span>•</span>{new Date(note.date).toLocaleDateString()}</div><button onClick={() => handleDeleteNote(note.id)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button></div>
                                    <p className="text-slate-300 whitespace-pre-wrap text-sm">{note.content}</p>
                                </div>
                             ))}
                        </div>
                    </div>
                </section>
              </div>
            )}
            
            {activeTab === 'NEEDS' && (
              <div className="max-w-4xl animate-in fade-in duration-300 space-y-8">
                 {/* Project Archive section moved to the top */}
                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><FolderOpen size={16} className="text-amber-500" />Project Archive</h3>
                    <button 
                      onClick={async () => {
                        console.log('Saving project - editingClient.needs:', editingClient.needs);
                        console.log('panelStockItemId being saved:', editingClient.needs?.panelStockItemId);
                        
                        if (!editingClient.needs?.projectName?.trim()) {
                          alert('Please enter a project name before archiving.');
                          return;
                        }
                        const projectNameToArchive = editingClient.needs.projectName;
                        // Check if project with this name already exists
                        const existingProjectIndex = archivedProjects.findIndex(p => p.projectName === projectNameToArchive);
                        const archivedProject = {
                          id: existingProjectIndex !== -1 ? archivedProjects[existingProjectIndex].id : Date.now().toString(),
                          projectName: projectNameToArchive,
                          archivedAt: new Date(),
                          data: JSON.parse(JSON.stringify(editingClient.needs))
                        };
                        let updatedArchived;
                        if (existingProjectIndex !== -1) {
                          // Overwrite existing project
                          updatedArchived = [...archivedProjects];
                          updatedArchived[existingProjectIndex] = archivedProject;
                        } else {
                          // Add new project
                          updatedArchived = [archivedProject, ...archivedProjects];
                        }
                        setArchivedProjects(updatedArchived);
                        
                        // Clear current data
                        const clearedNeeds = { projectName: '', description: '', connectionType: undefined, roofType: undefined, roofTypeOther: undefined, inverterKw: undefined, panelKw: 0, panelCount: 0, panelStockItemId: undefined, storage: '', technicalNotes: '', siteImages: [] };
                        const updatedClient = { ...editingClient, needs: clearedNeeds, archivedProjects: updatedArchived };
                        
                        setEditingClient(updatedClient);
                        setSelectedClient(updatedClient);
                        setTempDescription('');
                        
                        // Save to database
                        try {
                          await onUpdateClient(updatedClient);
                          setHasChanges(false);
                        } catch (err) {
                          console.error('Failed to save project', err);
                          alert('Failed to save project. Please try again.');
                        }
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors mb-4"
                    >
                      <Save size={18} /> Save Project
                    </button>
                    {archivedProjects.length > 0 && (
                      <div className="space-y-2 border-t border-slate-700 pt-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Saved Projects</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                          {archivedProjects.map(project => {
                            const isCurrent = editingClient.needs?.projectName === project.projectName;
                            return (
                              <div 
                                key={project.id}
                                className={`p-3 rounded border transition-all cursor-pointer group ${
                                  isCurrent
                                    ? 'bg-emerald-500/10 border-emerald-500/50'
                                    : 'bg-slate-900 border-slate-700 hover:border-amber-500/50'
                                }`}
                                onClick={() => {
                                  // If clicking on the currently loaded project, unload it
                                  if (isCurrent) {
                                    // Check if there are unsaved changes
                                    if (hasChanges) {
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Unsaved Changes',
                                        message: 'You have unsaved changes. Do you want to save before unloading this project?',
                                        variant: 'warning',
                                        confirmLabel: 'Save',
                                        thirdButtonLabel: "Don't Save",
                                        cancelLabel: 'Cancel',
                                        onConfirm: async () => {
                                          // Save changes first
                                          try {
                                            const updatedClient = { ...editingClient };
                                            await onUpdateClient(updatedClient);
                                            setHasChanges(false);
                                            
                                            // Then clear the needs data
                                            const clearedNeeds = {
                                              description: '',
                                              projectName: '',
                                              connectionType: undefined,
                                              roofType: undefined,
                                              inverterKw: undefined,
                                              selectedInverterId: undefined,
                                              batteryKwh: undefined,
                                              selectedBatteryId: undefined,
                                              panelSizeType: undefined,
                                              panelStockItemId: undefined,
                                              panelKw: undefined,
                                              panelCount: undefined,
                                              storage: undefined,
                                              technicalNotes: undefined,
                                              siteImages: []
                                            };
                                            setEditingClient({ ...editingClient, needs: clearedNeeds });
                                            setTempDescription('');
                                            // Reset selection states
                                            setSelectedInverterId(null);
                                            setSelectedBatteryId(null);
                                            setSelectedPanelId(null);
                                            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                                          } catch (err) {
                                            console.error('Failed to save before unloading', err);
                                            alert('Failed to save changes. Please try again.');
                                          }
                                        },
                                        onThirdButton: () => {
                                          // Don't save, just clear the data
                                          const clearedNeeds = {
                                            description: '',
                                            projectName: '',
                                            connectionType: undefined,
                                            roofType: undefined,
                                            inverterKw: undefined,
                                            selectedInverterId: undefined,
                                            batteryKwh: undefined,
                                            selectedBatteryId: undefined,
                                            panelSizeType: undefined,
                                            panelStockItemId: undefined,
                                            panelKw: undefined,
                                            panelCount: undefined,
                                            storage: undefined,
                                            technicalNotes: undefined,
                                            siteImages: []
                                          };
                                          setEditingClient({ ...editingClient, needs: clearedNeeds });
                                          setTempDescription('');
                                          setHasChanges(false);
                                          // Reset selection states
                                          setSelectedInverterId(null);
                                          setSelectedBatteryId(null);
                                          setSelectedPanelId(null);
                                          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                                        },
                                        onCancel: () => {
                                          // Cancel, do nothing
                                          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                                        }
                                      });
                                      return;
                                    }
                                    
                                    // No changes, just clear the data
                                    const clearedNeeds = {
                                      description: '',
                                      projectName: '',
                                      connectionType: undefined,
                                      roofType: undefined,
                                      inverterKw: undefined,
                                      selectedInverterId: undefined,
                                      batteryKwh: undefined,
                                      selectedBatteryId: undefined,
                                      panelSizeType: undefined,
                                      panelStockItemId: undefined,
                                      panelKw: undefined,
                                      panelCount: undefined,
                                      storage: undefined,
                                      technicalNotes: undefined,
                                      siteImages: []
                                    };
                                    setEditingClient({ ...editingClient, needs: clearedNeeds });
                                    setTempDescription('');
                                    // Reset selection states
                                    setSelectedInverterId(null);
                                    setSelectedBatteryId(null);
                                    setSelectedPanelId(null);
                                    return;
                                  }
                                  
                                  // Not current, load the project
                                  const loadedData = JSON.parse(JSON.stringify(project.data));
                                  console.log('Loading project data:', loadedData);
                                  console.log('panelStockItemId from loaded data:', loadedData.panelStockItemId);
                                  const updatedClient = {
                                    ...editingClient,
                                    needs: loadedData
                                  };
                                  setEditingClient(updatedClient);
                                  setTempDescription(loadedData.description || '');
                                  // Restore selection states from loaded data
                                  setSelectedInverterId(loadedData.selectedInverterId || null);
                                  setSelectedBatteryId(loadedData.selectedBatteryId || null);
                                  setSelectedPanelId(loadedData.panelStockItemId || null);
                                  console.log('Setting selectedPanelId to:', loadedData.panelStockItemId || null);
                                  setHasChanges(true);
                                }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    {isCurrent && (
                                      <span className="text-emerald-400 font-bold text-xs flex items-center gap-1 mb-1">
                                        <CheckCircle size={14} /> LOADED
                                      </span>
                                    )}
                                    <p className={`font-bold text-sm truncate ${
                                      isCurrent ? 'text-emerald-400' : 'text-white'
                                    }`}>{project.projectName}</p>
                                    <p className="text-xs text-slate-400 mt-1">Saved: {new Date(project.archivedAt).toLocaleDateString()}</p>
                                    {project.data.inverterKw && (
                                      <p className="text-xs text-slate-500 mt-1">
                                        {project.data.inverterKw}kW Inverter • {project.data.panelKw}kW Panels
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!editingClient) return;
                                      const projectId = project.id;
                                      const projectName = project.projectName;
                                      
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Delete Saved Project',
                                        message: `Are you sure you want to delete saved project "${projectName}"? This action cannot be undone.`,
                                        variant: 'danger',
                                        onConfirm: () => {
                                          const updated = archivedProjects.filter(p => p.id !== projectId);
                                          const updatedClient = {
                                            ...editingClient,
                                            archivedProjects: updated
                                          };

                                          setArchivedProjects(updated);
                                          setEditingClient(updatedClient);
                                          setSelectedClient(updatedClient);
                                          onUpdateClient(updatedClient);
                                          setConfirmDialog({
                                            isOpen: false,
                                            title: '',
                                            message: '',
                                            onConfirm: () => {},
                                          });
                                        }
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded text-xs"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                 </section>
                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 block flex items-center gap-2"><Briefcase size={16} className="text-amber-500" />Project Name</h3>
                    <input type="text" value={editingClient.needs?.projectName || ''} onChange={(e) => handleNeedsChange('projectName', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white outline-none focus:ring-1 focus:ring-amber-500" placeholder="Enter project name..." />
                 </section>
                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 block flex items-center gap-2"><FileText size={16} className="text-amber-500" />Scope of Work</h3>
                    <div className="relative"><textarea value={tempDescription} onChange={(e) => handleDescriptionChange(e.target.value)} onBlur={saveDescription} rows={4} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white outline-none resize-none focus:ring-1 focus:ring-amber-500" placeholder="Enter detailed client requirements here..." />{editingClient.needs?.descriptionUpdatedAt && <div className="absolute bottom-2 right-4 text-[10px] text-slate-500">Updated by <span className="font-bold text-slate-400">{editingClient.needs.descriptionUpdatedBy}</span> on {new Date(editingClient.needs.descriptionUpdatedAt).toLocaleDateString()}</div>}</div>
                 </section>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><label className="text-sm font-bold text-slate-300 mb-3 block">Bransament</label><div className="flex gap-4">{['Monofazat', 'Trifazat'].map(type => (<label key={type} className={`flex-1 cursor-pointer border rounded-lg p-4 flex items-center justify-center transition-all ${editingClient.needs?.connectionType === type ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-700 hover:bg-slate-700'}`}><span className="font-medium">{type}</span><input type="radio" name="connectionType" checked={editingClient.needs?.connectionType === type} onChange={() => handleNeedsChange('connectionType', type)} className="hidden" /></label>))}</div></div>
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700"><label className="text-sm font-bold text-slate-300 mb-3 block">Tip Acoperis</label><select value={editingClient.needs?.roofType || ''} onChange={(e) => handleNeedsChange('roofType', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500 appearance-none"><option value="">-- Select --</option>{['Tigla ceramica', 'Tabla', 'Tigla metalica', 'Tabla ondulata', 'Tabla cutata', 'Panou sandwich', 'Other'].map(opt => (<option key={opt} value={opt}>{opt}</option>))}</select>{editingClient.needs?.roofType === 'Other' && <input type="text" value={editingClient.needs?.roofTypeOther || ''} onChange={(e) => handleNeedsChange('roofTypeOther', e.target.value)} placeholder="Please specify..." className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500 mt-2" />}</div>
                 </div>
                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Zap size={16} className="text-amber-500" />Inverter Requested</h3>
                    {editingClient.needs?.connectionType && (
                      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-xs text-blue-300 font-bold">ℹ️ The Bransament type is <span className="text-blue-200">{editingClient.needs.connectionType}</span>. You should select a <span className="text-blue-200">{editingClient.needs.connectionType}</span> inverter.</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Power (kW)</label>
                        <input type="number" value={editingClient.needs?.inverterKw || ''} onChange={(e) => handleNeedsChange('inverterKw', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. 5" />
                      </div>
                    </div>

                    {editingClient.needs?.inverterKw && (
                      <div className="space-y-4">
                        {/* SCENARIO 1: Suitable Inverters Found */}
                        {suggestedInverters.length > 0 && !selectedInverterId && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                              <CheckCircle size={16} /> Suitable Inverters Found
                            </div>
                            {suggestedInverters.map(inv => (
                              <div 
                                key={inv.id}
                                className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all"
                                onClick={() => {
                                  setSelectedInverterId(inv.id);
                                  handleNeedsChange('selectedInverterId', inv.id);
                                  const updated = { ...editingClient, needs: { ...editingClient.needs, selectedInverterId: inv.id } };
                                  onUpdateClient(updated);
                                }}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="text-white font-bold">{inv.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">{inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType}</p>
                                    <p className="text-xs text-slate-500 mt-1">{inv.quantity} in stock</p>
                                    <p className="text-sm text-emerald-400 font-bold mt-2">{inv.sellPrice} RON</p>
                                  </div>
                                  <button 
                                    type="button"
                                    className="ml-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-lg text-sm whitespace-nowrap transition-colors"
                                  >
                                    Select
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* SCENARIO 2: No Suitable Inverters */}
                        {suggestedInverters.length === 0 && !selectedInverterId && (() => {
                          const connectionType = editingClient.needs?.connectionType;
                          const targetKw = editingClient.needs?.inverterKw || 0;
                          const allInverters = inventory.filter(i => i.category === Category.INVERTERS);
                          const inStockInverters = allInverters.filter(i => i.quantity && i.quantity > 0);
                          const similarInverters = allInverters.filter(i => 
                            i.inverterConnectionType === connectionType && 
                            Math.abs((i.inverterPowerKw || 0) - targetKw) <= 2
                          );
                          
                          let reason = '';
                          if (allInverters.length === 0) {
                            reason = 'No inverters registered in inventory.';
                          } else if (inStockInverters.length === 0) {
                            reason = 'All inverters in inventory are currently out of stock.';
                          } else if (similarInverters.length === 0) {
                            reason = `No inverters match the specifications (${targetKw}kW ${connectionType || 'connection type not selected'}).`;
                          } else {
                            reason = `Inverters matching your requirements (${targetKw}kW ${connectionType || 'connection type not selected'}) are currently out of stock.`;
                          }
                          
                          return (
                            <div className="space-y-3">
                              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-lg mb-2">
                                  <AlertCircle size={20} /> No suitable inverter!
                                </div>
                                <p className="text-sm text-red-300 text-center mb-3">
                                  {reason}
                                </p>
                                {similarInverters.length > 0 && similarInverters.every(i => !i.quantity || i.quantity === 0) && (
                                  <div className="mt-3 pt-3 border-t border-red-500/20">
                                    <p className="text-xs text-red-400/80 text-center">
                                      We have {similarInverters.length} suitable {similarInverters.length === 1 ? 'inverter' : 'inverters'} registered but all are out of stock:
                                    </p>
                                    <div className="mt-2 space-y-1">
                                      {similarInverters.map(inv => (
                                        <p key={inv.id} className="text-xs text-red-300/60 text-center">• {inv.name} ({inv.inverterPowerKw}kW {inv.inverterConnectionType})</p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <button 
                                type="button"
                                onClick={() => setShowAlternatives(true)}
                                className="w-full px-4 py-3 bg-slate-900 border border-amber-500/50 hover:border-amber-500 text-amber-400 hover:text-amber-300 font-bold rounded-lg transition-colors"
                              >
                                Browse All Available Inverters
                              </button>
                            </div>
                          );
                        })()}

                        {/* Selected Inverter Display */}
                        {selectedInverterId && (() => {
                          const selected = inventory.find(i => i.id === selectedInverterId && i.category === Category.INVERTERS);
                          if (!selected) return null;
                          
                          const connectionMismatch = editingClient.needs?.connectionType && selected.inverterConnectionType !== editingClient.needs.connectionType;
                          const powerDiff = selected.inverterPowerKw ? selected.inverterPowerKw - (editingClient.needs?.inverterKw || 0) : 0;
                          const hasPowerWarning = Math.abs(powerDiff) > 0.5;
                          const isOutOfStock = !selected.quantity || selected.quantity === 0;
                          
                          return (
                            <div className="space-y-3">
                              <div className="p-4 rounded-lg border-2 bg-emerald-500/5 border-emerald-500/50">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                                    <CheckCircle size={16} /> SELECTED INVERTER
                                  </span>
                                </div>
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="text-white font-bold">{selected.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">{selected.inverterPowerKw}kW • {selected.inverterConnectionType} • {selected.inverterStorageType}</p>
                                    <p className="text-sm text-emerald-400 font-bold mt-2">{selected.sellPrice} RON</p>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setSelectedInverterId(null);
                                      handleNeedsChange('selectedInverterId', undefined);
                                      const updated = { ...editingClient, needs: { ...editingClient.needs, selectedInverterId: undefined } };
                                      onUpdateClient(updated);
                                    }}
                                    className="text-slate-400 hover:text-white transition-colors"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>
                                
                                {isOutOfStock && (
                                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                    <div className="flex items-start gap-2">
                                      <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                      <div className="text-xs text-red-300">
                                        <p className="font-bold">Out of stock!</p>
                                        <p className="mt-1">This inverter is currently not available in inventory</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {connectionMismatch && (
                                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                    <div className="flex items-start gap-2">
                                      <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                      <div className="text-xs text-red-300">
                                        <p className="font-bold">Wrong connection type!</p>
                                        <p className="mt-1">Selected: <span className="font-bold">{selected.inverterConnectionType}</span></p>
                                        <p>Project needs: <span className="font-bold">{editingClient.needs?.connectionType}</span></p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {hasPowerWarning && (
                                  <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                                    <div className="flex items-start gap-2">
                                      <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                      <p className="text-xs text-yellow-300 font-bold">
                                        Inverter capacity is {powerDiff > 0 ? 'bigger' : 'smaller'} than requested by {Math.abs(powerDiff).toFixed(2)}kW
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <button 
                                type="button"
                                onClick={() => setShowAlternatives(true)}
                                className="w-full px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors"
                              >
                                Choose Different Inverter
                              </button>
                            </div>
                          );
                        })()}

                        {/* Inverter Selection Modal */}
                        {showAlternatives && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
                              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                                <h3 className="text-white font-bold">All Available Inverters</h3>
                                <button 
                                  type="button"
                                  onClick={() => setShowAlternatives(false)}
                                  className="text-slate-400 hover:text-white transition-colors"
                                >
                                  <X size={20} />
                                </button>
                              </div>
                              <div className="p-4 overflow-y-auto custom-scrollbar space-y-2">
                                {inventory.filter(i => i.category === Category.INVERTERS).map(inv => {
                                  const isCurrentSelection = inv.id === selectedInverterId || editingClient.needs?.selectedInverterId === inv.id;
                                  const matchesConnection = editingClient.needs?.connectionType ? inv.inverterConnectionType === editingClient.needs.connectionType : true;
                                  const matchesPower = editingClient.needs?.inverterKw ? Math.abs((inv.inverterPowerKw || 0) - editingClient.needs.inverterKw) <= 2 : true;
                                  const isPerfectMatch = matchesConnection && matchesPower;
                                  const isOutOfStock = !inv.quantity || inv.quantity === 0;
                                  
                                  return (
                                    <div 
                                      key={inv.id}
                                      className={`flex items-center justify-between bg-slate-900 p-4 rounded-lg border cursor-pointer transition-all ${
                                        isCurrentSelection 
                                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                                          : isPerfectMatch && !isOutOfStock
                                          ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                                          : isOutOfStock
                                          ? 'border-red-500/30 hover:border-red-500/50'
                                          : 'border-slate-700 hover:border-amber-500/50'
                                      }`}
                                      onClick={() => {
                                        setSelectedInverterId(inv.id);
                                        handleNeedsChange('selectedInverterId', inv.id);
                                        const updated = { ...editingClient, needs: { ...editingClient.needs, selectedInverterId: inv.id } };
                                        onUpdateClient(updated);
                                        setShowAlternatives(false);
                                      }}
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-white font-bold">{inv.name}</p>
                                          {isPerfectMatch && !isCurrentSelection && !isOutOfStock && (
                                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">MATCH</span>
                                          )}
                                          {isCurrentSelection && (
                                            <span className="text-xs bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-bold">SELECTED</span>
                                          )}
                                          {isOutOfStock && (
                                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">OUT OF STOCK</span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">{inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType}</p>
                                        {!matchesConnection && (
                                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                            <AlertCircle size={10} /> Wrong connection type
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right ml-4">
                                        <p className="text-xs font-bold text-slate-400">{inv.quantity || 0} in stock</p>
                                        <p className="text-sm font-bold text-emerald-400 mt-1">{inv.sellPrice} RON</p>
                                      </div>
                                    </div>
                                  );
                                })}
                                {inventory.filter(i => i.category === Category.INVERTERS).length === 0 && (
                                  <div className="text-center py-8 text-slate-500">
                                    <p className="font-bold mb-1">No inverters in inventory</p>
                                    <p className="text-sm">Please add inverter items to inventory first</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                 </section>
                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Package size={16} className="text-amber-500" />Battery</h3>
                    
                    {selectedInverterId && (() => {
                      const selectedInv = inventory.find(i => i.id === selectedInverterId && i.category === Category.INVERTERS);
                      if (!selectedInv) return null;
                      return (
                        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                          <p className="text-xs text-blue-300 font-bold">
                            ℹ️ You selected a <span className="text-blue-200">{selectedInv.inverterStorageType}</span> inverter. Choose a compatible battery type.
                          </p>
                        </div>
                      );
                    })()}

                    <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Capacity (kWh)</label>
                      <input 
                        type="number" 
                        value={editingClient.needs?.batteryKwh || ''} 
                        onChange={(e) => handleNeedsChange('batteryKwh', Number(e.target.value))} 
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                        placeholder="e.g. 10" 
                      />
                      {(!editingClient.needs?.batteryKwh || editingClient.needs?.batteryKwh === 0) && (
                        <p className="text-xs text-slate-500 mt-2 italic">Leave empty if you don't want a battery</p>
                      )}
                    </div>

                    {!!(editingClient.needs?.batteryKwh && editingClient.needs.batteryKwh > 0 && selectedInverterId) && (() => {
                      const selectedInv = inventory.find(i => i.id === selectedInverterId && i.category === Category.INVERTERS);
                      if (!selectedInv?.inverterStorageType) return null;

                      const batteryType = selectedInv.inverterStorageType;
                      const targetCapacity = editingClient.needs.batteryKwh || 0;
                      
                      // Get suitable batteries (matching type and close capacity)
                      const suitableBatteries = inventory.filter(i => 
                        i.category === Category.BATTERIES && 
                        i.batteryType === batteryType &&
                        i.quantity > 0 &&
                        Math.abs((i.batteryPowerKwh || 0) - targetCapacity) <= 3
                      ).sort((a, b) => {
                        const diffA = Math.abs((a.batteryPowerKwh || 0) - targetCapacity);
                        const diffB = Math.abs((b.batteryPowerKwh || 0) - targetCapacity);
                        return diffA - diffB;
                      });

                      return (
                        <div className="space-y-4">
                          {/* SCENARIO 1: Suitable Batteries Found */}
                          {suitableBatteries.length > 0 && !selectedBatteryId && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                                <CheckCircle size={16} /> Suitable Batteries Found
                              </div>
                              {suitableBatteries.map(bat => (
                                <div 
                                  key={bat.id}
                                  className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all"
                                  onClick={() => {
                                    setSelectedBatteryId(bat.id);
                                    handleNeedsChange('selectedBatteryId', bat.id);
                                    const updated = { ...editingClient, needs: { ...editingClient.needs, selectedBatteryId: bat.id } };
                                    onUpdateClient(updated);
                                  }}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white font-bold">{bat.name}</p>
                                      <p className="text-xs text-slate-400 mt-1">{bat.batteryPowerKwh}kWh • {bat.batteryType}</p>
                                      <p className="text-xs text-slate-500 mt-1">{bat.quantity} in stock</p>
                                      <p className="text-sm text-emerald-400 font-bold mt-2">{bat.sellPrice} RON</p>
                                    </div>
                                    <button 
                                      type="button"
                                      className="ml-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-lg text-sm whitespace-nowrap transition-colors"
                                    >
                                      Select
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* SCENARIO 2: No Suitable Batteries */}
                          {suitableBatteries.length === 0 && !selectedBatteryId && (() => {
                            const targetCapacity = editingClient.needs?.batteryKwh || 0;
                            const allBatteries = inventory.filter(i => i.category === Category.BATTERIES);
                            const inStockBatteries = allBatteries.filter(i => i.quantity && i.quantity > 0);
                            const similarBatteries = allBatteries.filter(i => 
                              i.batteryType === batteryType && 
                              Math.abs((i.batteryPowerKwh || 0) - targetCapacity) <= 3
                            );
                            
                            let reason = '';
                            if (allBatteries.length === 0) {
                              reason = 'No batteries registered in inventory.';
                            } else if (inStockBatteries.length === 0) {
                              reason = 'All batteries in inventory are currently out of stock.';
                            } else if (similarBatteries.length === 0) {
                              reason = `No batteries match the specifications (${targetCapacity}kWh ${batteryType}).`;
                            } else {
                              reason = `Batteries matching your requirements (${targetCapacity}kWh ${batteryType}) are currently out of stock.`;
                            }
                            
                            return (
                              <div className="space-y-3">
                                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                  <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-lg mb-2">
                                    <AlertCircle size={20} /> No suitable battery!
                                  </div>
                                  <p className="text-sm text-red-300 text-center mb-3">
                                    {reason}
                                  </p>
                                  {similarBatteries.length > 0 && similarBatteries.every(i => !i.quantity || i.quantity === 0) && (
                                    <div className="mt-3 pt-3 border-t border-red-500/20">
                                      <p className="text-xs text-red-400/80 text-center">
                                        We have {similarBatteries.length} suitable {similarBatteries.length === 1 ? 'battery' : 'batteries'} registered but all are out of stock:
                                      </p>
                                      <div className="mt-2 space-y-1">
                                        {similarBatteries.map(bat => (
                                          <p key={bat.id} className="text-xs text-red-300/60 text-center">• {bat.name} ({bat.batteryPowerKwh}kWh {bat.batteryType})</p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setShowBatteryAlternatives(true)}
                                  className="w-full px-4 py-3 bg-slate-900 border border-amber-500/50 hover:border-amber-500 text-amber-400 hover:text-amber-300 font-bold rounded-lg transition-colors"
                                >
                                  Browse All Available Batteries
                                </button>
                              </div>
                            );
                          })()}

                          {/* Selected Battery Display */}
                          {selectedBatteryId && (() => {
                            const selected = inventory.find(i => i.id === selectedBatteryId && i.category === Category.BATTERIES);
                            if (!selected) return null;
                            
                            const typeMismatch = selected.batteryType !== batteryType;
                            const capacityDiff = (selected.batteryPowerKwh || 0) - targetCapacity;
                            const hasCapacityWarning = Math.abs(capacityDiff) > 0.5;
                            const isOutOfStock = !selected.quantity || selected.quantity === 0;
                            
                            return (
                              <div className="space-y-3">
                                <div className="p-4 rounded-lg border-2 bg-emerald-500/5 border-emerald-500/50">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                                      <CheckCircle size={16} /> SELECTED BATTERY
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-white font-bold">{selected.name}</p>
                                      <p className="text-xs text-slate-400 mt-1">{selected.batteryPowerKwh}kWh • {selected.batteryType}</p>
                                      <p className="text-sm text-emerald-400 font-bold mt-2">{selected.sellPrice} RON</p>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setSelectedBatteryId(null);
                                        handleNeedsChange('selectedBatteryId', undefined);
                                        const updated = { ...editingClient, needs: { ...editingClient.needs, selectedBatteryId: undefined } };
                                        onUpdateClient(updated);
                                      }}
                                      className="text-slate-400 hover:text-white transition-colors"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                  
                                  {isOutOfStock && (
                                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                      <div className="flex items-start gap-2">
                                        <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-xs text-red-300">
                                          <p className="font-bold">Out of stock!</p>
                                          <p className="mt-1">This battery is currently not available in inventory</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {typeMismatch && (
                                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                      <div className="flex items-start gap-2">
                                        <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-xs text-red-300">
                                          <p className="font-bold">Battery type not compatible!</p>
                                          <p className="mt-1">Selected: <span className="font-bold">{selected.batteryType}</span></p>
                                          <p>Inverter needs: <span className="font-bold">{batteryType}</span></p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {hasCapacityWarning && (
                                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                                      <div className="flex items-start gap-2">
                                        <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-yellow-300 font-bold">
                                          Battery capacity is {capacityDiff > 0 ? 'higher' : 'lower'} than requested by {Math.abs(capacityDiff).toFixed(1)}kWh
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <button 
                                  type="button"
                                  onClick={() => setShowBatteryAlternatives(true)}
                                  className="w-full px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors"
                                >
                                  Choose Different Battery
                                </button>
                              </div>
                            );
                          })()}

                          {/* Battery Selection Modal */}
                          {showBatteryAlternatives && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                              <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
                                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                                  <h3 className="text-white font-bold">All Available Batteries</h3>
                                  <button 
                                    type="button"
                                    onClick={() => setShowBatteryAlternatives(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                  >
                                    <X size={20} />
                                  </button>
                                </div>
                                <div className="p-4 overflow-y-auto custom-scrollbar space-y-2">
                                  {inventory.filter(i => i.category === Category.BATTERIES).map(bat => {
                                    const isCurrentSelection = bat.id === selectedBatteryId || editingClient.needs?.selectedBatteryId === bat.id;
                                    const matchesType = bat.batteryType === batteryType;
                                    const matchesCapacity = Math.abs((bat.batteryPowerKwh || 0) - targetCapacity) <= 3;
                                    const isPerfectMatch = matchesType && matchesCapacity;
                                    const isOutOfStock = !bat.quantity || bat.quantity === 0;
                                    
                                    return (
                                      <div 
                                        key={bat.id}
                                        className={`flex items-center justify-between bg-slate-900 p-4 rounded-lg border cursor-pointer transition-all ${
                                          isCurrentSelection 
                                            ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                                            : isPerfectMatch && !isOutOfStock
                                            ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                                            : isOutOfStock
                                            ? 'border-red-500/30 hover:border-red-500/50'
                                            : 'border-slate-700 hover:border-amber-500/50'
                                        }`}
                                        onClick={() => {
                                          setSelectedBatteryId(bat.id);
                                          handleNeedsChange('selectedBatteryId', bat.id);
                                          const updated = { ...editingClient, needs: { ...editingClient.needs, selectedBatteryId: bat.id } };
                                          onUpdateClient(updated);
                                          setShowBatteryAlternatives(false);
                                        }}
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="text-white font-bold">{bat.name}</p>
                                            {isPerfectMatch && !isCurrentSelection && !isOutOfStock && (
                                              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">MATCH</span>
                                            )}
                                            {isCurrentSelection && (
                                              <span className="text-xs bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-bold">SELECTED</span>
                                            )}
                                            {isOutOfStock && (
                                              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">OUT OF STOCK</span>
                                            )}
                                          </div>
                                          <p className="text-xs text-slate-400 mt-1">{bat.batteryPowerKwh}kWh • {bat.batteryType}</p>
                                          {!matchesType && (
                                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                              <AlertCircle size={10} /> Wrong battery type
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-right ml-4">
                                          <p className="text-xs font-bold text-slate-400">{bat.quantity} in stock</p>
                                          <p className="text-sm font-bold text-emerald-400 mt-1">{bat.sellPrice} RON</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {inventory.filter(i => i.category === Category.BATTERIES).length === 0 && (
                                    <div className="text-center py-8 text-slate-500">
                                      <p className="font-bold mb-1">No batteries in inventory</p>
                                      <p className="text-sm">Please add battery items to inventory first</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                 </section>

                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Package size={16} className="text-amber-500" />Panels Calculator</h3>
                    
                    {/* Total Power Input */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Total Power Required (kW)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={editingClient.needs?.panelKw || ''} 
                          onChange={(e) => handleNeedsChange('panelKw', Number(e.target.value))} 
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                          placeholder="e.g. 6" 
                        />
                      </div>

                      {/* Browse button - always available */}
                      {!selectedPanelId && !editingClient.needs?.panelStockItemId && (!editingClient.needs?.panelKw || editingClient.needs.panelKw === 0) && (
                        <button 
                          type="button"
                          onClick={() => setShowPanelAlternatives(true)}
                          className="w-full px-4 py-3 bg-slate-900 border border-amber-500/50 hover:border-amber-500 text-amber-400 hover:text-amber-300 font-bold rounded-lg transition-colors"
                        >
                          Browse All Available Panels
                        </button>
                      )}

                      {/* Suggestions or browse button when power is entered */}
                      {editingClient.needs?.panelKw && editingClient.needs.panelKw > 0 && (() => {
                        const targetWatts = editingClient.needs.panelKw * 1000;
                        const availablePanels = inventory.filter(i => i.category === Category.PANELS && i.powerW && i.powerW > 0);
                        
                        // Find best match
                        const suggestions = availablePanels
                          .map(panel => {
                            const piecesNeeded = Math.ceil(targetWatts / panel.powerW!);
                            const actualPower = (piecesNeeded * panel.powerW!) / 1000;
                            const stockQuantity = panel.quantity || 0;
                            const isInStock = stockQuantity >= piecesNeeded;
                            return { panel, piecesNeeded, actualPower, stockQuantity, isInStock };
                          })
                          .filter(s => s.isInStock)
                          .sort((a, b) => Math.abs(a.actualPower - editingClient.needs!.panelKw!) - Math.abs(b.actualPower - editingClient.needs!.panelKw!))
                          .slice(0, 3);

                        // Show selected panel if exists
                        if (!selectedPanelId && !editingClient.needs?.panelStockItemId && availablePanels.length === 0) {
                          return (
                            <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg text-center text-slate-500">
                              <p className="text-sm">No panels available in inventory</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {/* Show suggestions if no selection */}
                            {!selectedPanelId && !editingClient.needs?.panelStockItemId && suggestions.length > 0 && (
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-lg">
                                <p className="text-xs text-emerald-400 font-bold mb-3 flex items-center gap-1">
                                  💡 Recommended Panel Combinations:
                                </p>
                                <div className="space-y-2">
                                  {suggestions.map(({ panel, piecesNeeded, actualPower }) => (
                                    <div key={panel.id} className="text-xs text-emerald-300">
                                      • <span className="font-bold">{panel.name}</span> - {piecesNeeded} pieces = {actualPower.toFixed(2)}kW
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show browse button */}
                            <button 
                              type="button"
                              onClick={() => setShowPanelAlternatives(true)}
                              className={`w-full px-4 py-3 border font-bold rounded-lg transition-colors ${
                                selectedPanelId || editingClient.needs?.panelStockItemId
                                  ? 'bg-slate-900 border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400'
                                  : 'bg-slate-900 border-amber-500/50 hover:border-amber-500 text-amber-400 hover:text-amber-300'
                              }`}
                            >
                              {selectedPanelId || editingClient.needs?.panelStockItemId ? 'Choose Different Panels' : 'Browse All Available Panels'}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Selected Panel Display - Always show if panel is selected */}
                      {(selectedPanelId || editingClient.needs?.panelStockItemId) && (() => {
                        const panelId = selectedPanelId || editingClient.needs?.panelStockItemId;
                        const selected = inventory.find(i => i.id === panelId && i.category === Category.PANELS);
                        if (!selected) return null;
                        
                        // Use saved panelCount if available, otherwise calculate from panelKw
                        let piecesNeeded = editingClient.needs?.panelCount || 0;
                        let actualPower = 0;
                        
                        if (editingClient.needs?.panelKw && editingClient.needs.panelKw > 0 && selected.powerW) {
                          const targetWatts = editingClient.needs.panelKw * 1000;
                          piecesNeeded = Math.ceil(targetWatts / selected.powerW);
                          actualPower = (piecesNeeded * selected.powerW) / 1000;
                        } else if (piecesNeeded > 0 && selected.powerW) {
                          actualPower = (piecesNeeded * selected.powerW) / 1000;
                        }
                        
                        const stockQuantity = selected.quantity || 0;
                        const isOutOfStock = stockQuantity === 0;
                        const isLowStock = !isOutOfStock && piecesNeeded > 0 && stockQuantity < piecesNeeded;
                        
                        return (
                          <div className="space-y-3">
                            <div className="p-4 rounded-lg border-2 bg-emerald-500/5 border-emerald-500/50">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                                  <CheckCircle size={16} /> SELECTED PANELS
                                </span>
                              </div>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white font-bold">{selected.name}</p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {selected.powerW}W
                                    {piecesNeeded > 0 && ` • ${piecesNeeded} pieces needed`}
                                    {actualPower > 0 && ` • ${actualPower.toFixed(2)}kW total`}
                                  </p>
                                  <p className="text-sm text-emerald-400 font-bold mt-2">{selected.sellPrice} RON/piece</p>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setSelectedPanelId(null);
                                    setSelectedPanelQty(0);
                                    handleNeedsChange('panelStockItemId', undefined);
                                    handleNeedsChange('panelCount', undefined);
                                    const updated = { ...editingClient, needs: { ...editingClient.needs, panelStockItemId: undefined, panelCount: undefined } };
                                    onUpdateClient(updated);
                                  }}
                                  className="text-slate-400 hover:text-white transition-colors"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                              
                              {isOutOfStock && (
                                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-red-300">
                                      <p className="font-bold">Out of stock!</p>
                                      <p className="mt-1">These panels are currently not available in inventory</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {isLowStock && (
                                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-yellow-300 font-bold">
                                      Low stock! Need {piecesNeeded} but only {stockQuantity} available. Short by {piecesNeeded - stockQuantity} panels.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {editingClient.needs?.panelKw && editingClient.needs.panelKw > 0 && (
                              <button 
                                type="button"
                                onClick={() => setShowPanelAlternatives(true)}
                                className="w-full px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors"
                              >
                                Choose Different Panels
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Manual Pieces Override */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Manual Quantity Override</label>
                        <input 
                          type="number"
                          min="0"
                          value={editingClient.needs?.panelCount || ''} 
                          onChange={(e) => {
                            const newQty = Number(e.target.value);
                            handleNeedsChange('panelCount', newQty);
                            setSelectedPanelQty(newQty);
                          }} 
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                          placeholder="Override calculated quantity" 
                        />
                      </div>

                      {/* Panel Selection Modal */}
                      {showPanelAlternatives && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
                            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                              <h3 className="text-white font-bold">All Available Panels</h3>
                              <button 
                                type="button"
                                onClick={() => setShowPanelAlternatives(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                              >
                                <X size={20} />
                              </button>
                            </div>
                            <div className="p-4 overflow-y-auto custom-scrollbar space-y-2">
                              {inventory
                                .filter(i => i.category === Category.PANELS && i.powerW && i.powerW > 0)
                                .map(panel => {
                                  const hasPowerRequirement = editingClient.needs?.panelKw && editingClient.needs.panelKw > 0;
                                  const targetWatts = hasPowerRequirement ? editingClient.needs!.panelKw! * 1000 : 0;
                                  const piecesNeeded = hasPowerRequirement ? Math.ceil(targetWatts / panel.powerW!) : 0;
                                  const actualPower = hasPowerRequirement ? (piecesNeeded * panel.powerW!) / 1000 : 0;
                                  const isCurrentSelection = panel.id === selectedPanelId || editingClient.needs?.panelStockItemId === panel.id;
                                  const stockQuantity = panel.quantity || 0;
                                  const isInStock = hasPowerRequirement ? stockQuantity >= piecesNeeded : stockQuantity > 0;
                                  const isOutOfStock = stockQuantity === 0;
                                  
                                  return (
                                    <div 
                                      key={panel.id}
                                      className={`flex items-center justify-between bg-slate-900 p-4 rounded-lg border cursor-pointer transition-all ${
                                        isCurrentSelection 
                                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                                          : isInStock
                                          ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                                          : isOutOfStock
                                          ? 'border-red-500/30 hover:border-red-500/50'
                                          : 'border-yellow-500/30 hover:border-yellow-500/50'
                                      }`}
                                      onClick={() => {
                                        const hasPowerRequirement = editingClient.needs?.panelKw && editingClient.needs.panelKw > 0;
                                        const finalPiecesNeeded = hasPowerRequirement 
                                          ? Math.ceil((editingClient.needs!.panelKw! * 1000) / panel.powerW!) 
                                          : 1; // Default to 1 if no power requirement
                                        
                                        console.log('Panel selected in modal:', panel.name, panel.id);
                                        console.log('Setting panelStockItemId:', panel.id, 'panelCount:', finalPiecesNeeded);
                                        setSelectedPanelId(panel.id);
                                        setSelectedPanelQty(finalPiecesNeeded);
                                        handleNeedsChange('panelStockItemId', panel.id);
                                        handleNeedsChange('panelCount', finalPiecesNeeded);
                                        const updated = { ...editingClient, needs: { ...editingClient.needs, panelStockItemId: panel.id, panelCount: finalPiecesNeeded } };
                                        console.log('Updating client with needs:', updated.needs);
                                        onUpdateClient(updated);
                                        setShowPanelAlternatives(false);
                                      }}
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-white font-bold">{panel.name}</p>
                                          {isInStock && !isCurrentSelection && (
                                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">IN STOCK</span>
                                          )}
                                          {isCurrentSelection && (
                                            <span className="text-xs bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-bold">SELECTED</span>
                                          )}
                                          {isOutOfStock && (
                                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">OUT OF STOCK</span>
                                          )}
                                          {!isInStock && !isOutOfStock && (
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-bold">LOW STOCK</span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                          {panel.powerW}W
                                          {piecesNeeded > 0 && ` • ${piecesNeeded} pcs = ${actualPower.toFixed(2)}kW`}
                                        </p>
                                        {!isInStock && !isOutOfStock && (
                                          <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                            <AlertCircle size={10} /> Only {stockQuantity} available, need {piecesNeeded}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right ml-4">
                                        <p className={`text-xs font-bold ${
                                          isOutOfStock ? 'text-red-400' : !isInStock ? 'text-yellow-400' : 'text-emerald-400'
                                        }`}>{stockQuantity} in stock</p>
                                        <p className="text-sm font-bold text-emerald-400 mt-1">{panel.sellPrice} RON</p>
                                      </div>
                                    </div>
                                  );
                                })
                              }
                              {inventory.filter(i => i.category === Category.PANELS && i.powerW && i.powerW > 0).length === 0 && (
                                <div className="text-center py-8 text-slate-500">
                                  <p className="font-bold mb-1">No panels in inventory</p>
                                  <p className="text-sm">Please add panel items to inventory first</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Row Configuration & Structure Calculator */}
                      {editingClient.needs?.panelCount && editingClient.needs.panelCount > 0 && (
                        <div className="border-t border-slate-700 pt-6 space-y-4">
                          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Package size={14} /> Structure Components Calculator
                          </h4>
                          
                          {/* Row Count Input */}
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Panel Placement - Number of Rows</label>
                            <input 
                              type="number"
                              min="1"
                              value={rowCount}
                              onChange={(e) => {
                                const count = Number(e.target.value);
                                if (count >= 1) {
                                  setRowCount(count);
                                  // Initialize row distribution
                                  const newDist: {[key: number]: number} = {};
                                  for (let i = 1; i <= count; i++) {
                                    newDist[i] = rowDistribution[i] || 0;
                                  }
                                  setRowDistribution(newDist);
                                }
                              }}
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                              placeholder="Number of rows" 
                            />
                          </div>

                          {/* Dynamic Row Distribution Inputs */}
                          {rowCount > 1 && (
                            <div className="space-y-2 bg-slate-900 p-4 rounded-lg border border-slate-700">
                              <p className="text-xs text-slate-400 font-bold mb-2">Distribute {editingClient.needs.panelCount} panels across {rowCount} rows:</p>
                              {Array.from({length: rowCount}, (_, i) => i + 1).map(rowNum => (
                                <div key={rowNum} className="flex items-center gap-3">
                                  <label className="text-sm text-slate-300 w-20">Row {rowNum}:</label>
                                  <input 
                                    type="number"
                                    min="0"
                                    value={rowDistribution[rowNum] || ''}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setRowDistribution({...rowDistribution, [rowNum]: val});
                                    }}
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-white outline-none focus:ring-1 focus:ring-amber-500 text-sm" 
                                    placeholder="Panels in this row" 
                                  />
                                </div>
                              ))}
                              {(() => {
                                const totalDistributed = Object.values(rowDistribution).reduce((sum, val) => sum + val, 0);
                                const diff = editingClient.needs!.panelCount! - totalDistributed;
                                return (
                                  <p className={`text-xs font-bold mt-2 ${
                                    diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {diff === 0 ? '✓ All panels distributed' : diff > 0 ? `⚠ ${diff} panels not distributed yet` : `❌ Over by ${Math.abs(diff)} panels`}
                                  </p>
                                );
                              })()}
                            </div>
                          )}

                          {/* Structure Components Calculation */}
                          {(() => {
                            const totalPanels = editingClient.needs!.panelCount!;
                            const roofType = editingClient.needs?.roofType;
                            
                            // Determine panels per row
                            let rowConfigs: number[] = [];
                            if (rowCount === 1) {
                              rowConfigs = [totalPanels];
                            } else {
                              const totalDistributed = Object.values(rowDistribution).reduce((sum, val) => sum + val, 0);
                              if (totalDistributed === totalPanels) {
                                rowConfigs = Array.from({length: rowCount}, (_, i) => rowDistribution[i + 1] || 0);
                              }
                            }

                            // Only calculate if we have valid row configuration
                            if (rowConfigs.length === 0 || rowConfigs.some(c => c === 0)) {
                              return (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                                  <p className="text-xs text-yellow-300">
                                    ⚠ Complete row distribution to calculate structure components
                                  </p>
                                </div>
                              );
                            }

                            // Calculate structure components
                            const numRows = rowConfigs.length;
                            
                            // End clamps: 4 per row (2 on each end of 2 rails)
                            const endClamps = numRows * 4;
                            
                            // Mid clamps: (panels_per_row - 1) * 2 rails per row
                            const midClamps = rowConfigs.reduce((sum, panelsInRow) => {
                              return sum + (panelsInRow - 1) * 2;
                            }, 0);
                            
                            // Rails: Get actual panel dimensions for accurate calculation
                            const selectedPanel = editingClient.needs?.panelStockItemId 
                              ? inventory.find(i => i.id === editingClient.needs!.panelStockItemId) 
                              : null;
                            
                            const panelWidth = selectedPanel?.panelWidth || 1.134; // Default to typical panel width if not set
                            const maxPanelsInRow = Math.max(...rowConfigs);
                            const railLengthPerRow = maxPanelsInRow * panelWidth; // Base length needed per row
                            const railLengthWithWaste = railLengthPerRow * 1.1; // Add 10% for cuts and waste
                            const railsPerRow = 2; // Top and bottom rails
                            
                            // Calculate 6m rail sections needed
                            const sectionsPerRail = Math.ceil(railLengthWithWaste / 6);
                            const railsOf6m = sectionsPerRail * numRows * railsPerRow;
                            
                            // Calculate combiners (rail connectors) needed when joining sections
                            const combinersPerRail = sectionsPerRail > 1 ? sectionsPerRail - 1 : 0;
                            const totalCombiners = combinersPerRail * numRows * railsPerRow;
                            
                            // Estimate cuts needed (one cut per rail that needs trimming)
                            const needsCut = (railLengthWithWaste % 6) !== 0 && sectionsPerRail > 0;
                            const totalCuts = needsCut ? numRows * railsPerRow : 0;
                            
                            // Roof attachments based on roof type
                            let attachmentType = 'Hooks/Bolts';
                            let attachmentsPerPanel = 4;
                            
                            if (roofType === 'Tigla ceramica' || roofType === 'Tigla metalica') {
                              attachmentType = 'Tile Hooks';
                              attachmentsPerPanel = 5;
                            } else if (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata') {
                              attachmentType = 'Hanger Bolts';
                              attachmentsPerPanel = 4;
                            } else if (roofType === 'Panou sandwich') {
                              attachmentType = 'Sandwich Panel Bolts';
                              attachmentsPerPanel = 4;
                            }
                            
                            const totalAttachments = totalPanels * attachmentsPerPanel;

                            return (
                              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg space-y-3">
                                <p className="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
                                  <CheckCircle size={14} /> Structure Components Required
                                </p>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase">End Clamps</p>
                                    <p className="text-lg font-bold text-white">{endClamps} pcs</p>
                                    <p className="text-xs text-slate-500 mt-1">{numRows} rows × 4</p>
                                  </div>
                                  
                                  <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase">Mid Clamps</p>
                                    <p className="text-lg font-bold text-white">{midClamps} pcs</p>
                                    <p className="text-xs text-slate-500 mt-1">Between panels</p>
                                  </div>
                                  
                                  <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase">Rails (6m)</p>
                                    <p className="text-lg font-bold text-white">{railsOf6m} pcs</p>
                                    <p className="text-xs text-slate-500 mt-1">+10% waste included</p>
                                  </div>
                                  
                                  <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase">Rail Combiners</p>
                                    <p className="text-lg font-bold text-white">{totalCombiners} pcs</p>
                                    <p className="text-xs text-slate-500 mt-1">{combinersPerRail > 0 ? `${combinersPerRail} per rail` : 'None needed'}</p>
                                  </div>
                                  
                                  <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase">{attachmentType}</p>
                                    <p className="text-lg font-bold text-white">{totalAttachments} pcs</p>
                                    <p className="text-xs text-slate-500 mt-1">{attachmentsPerPanel} per panel</p>
                                  </div>
                                  
                                  <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                    <p className="text-xs text-slate-400 uppercase">Estimated Cuts</p>
                                    <p className="text-lg font-bold text-white">{totalCuts}</p>
                                    <p className="text-xs text-slate-500 mt-1">{needsCut ? 'Trimming required' : 'No cuts needed'}</p>
                                  </div>
                                </div>

                                {!roofType && (
                                  <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                                    <p className="text-xs text-yellow-300">
                                      ⚠ Roof type not specified. Default calculation used (4 bolts/panel)
                                    </p>
                                  </div>
                                )}

                                {selectedPanel && (!selectedPanel.panelWidth || selectedPanel.panelWidth === 0) && (
                                  <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                                    <p className="text-xs text-yellow-300">
                                      ⚠ Panel dimensions not set in inventory. Using default width (1.134m) for rail calculation. Please update panel dimensions for accurate results.
                                    </p>
                                  </div>
                                )}

                                {/* Row Configuration & Rail Details - Hidden for now */}
                                {false && (
                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                  <p className="text-xs text-blue-200 font-bold mb-2">Row Configuration & Rail Details:</p>
                                  <div className="space-y-3">
                                    {rowConfigs.map((panelCount, idx) => {
                                      const rowRailLength = panelCount * panelWidth;
                                      const rowRailWithWaste = rowRailLength * 1.1;
                                      const rowSections = Math.ceil(rowRailWithWaste / 6);
                                      const rowCombiners = rowSections > 1 ? rowSections - 1 : 0;
                                      const rowNeedsCut = (rowRailWithWaste % 6) !== 0 && rowSections > 0;
                                      const excessLength = (rowSections * 6) - rowRailWithWaste;
                                      
                                      return (
                                        <div key={idx} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                                          <p className="text-sm text-white font-bold mb-2">Row {idx + 1}: {panelCount} panels</p>
                                          <div className="space-y-1 text-xs text-slate-400">
                                            <p>• Rail length needed: {rowRailLength.toFixed(2)}m</p>
                                            <p>• With 10% waste: {rowRailWithWaste.toFixed(2)}m</p>
                                            <p>• Sections per rail: {rowSections} × 6m = {(rowSections * 6).toFixed(1)}m</p>
                                            <p>• Rails needed: {rowSections * 2} pcs (top + bottom)</p>
                                            {rowCombiners > 0 && (
                                              <p className="text-amber-400">• Combiners: {rowCombiners * 2} pcs ({rowCombiners} per rail × 2 rails)</p>
                                            )}
                                            {rowNeedsCut ? (
                                              <p className="text-yellow-400">• Cuts: 2 cuts needed (trim {excessLength.toFixed(2)}m excess from each rail)</p>
                                            ) : (
                                              <p className="text-emerald-400">• Cuts: None - rails fit perfectly</p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                 </section>

                 {/* On-site Pictures Gallery */}
                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                   <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                     <ImageIcon size={16} className="text-amber-500" />
                     On-site Pictures
                   </h3>
                   
                   <div className="flex gap-4 mb-6">
                     <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">
                       <Upload size={16} /> Upload Photos
                       <input 
                         type="file" 
                         accept="image/*" 
                         multiple
                         onChange={handleImageUpload} 
                         className="hidden" 
                       />
                     </label>
                     <button 
                       onClick={startCamera} 
                       className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
                     >
                       <Camera size={16} /> Take Photo
                     </button>
                   </div>

                   {(!editingClient.needs?.siteImages || editingClient.needs.siteImages.length === 0) ? (
                     <div className="text-center py-12 text-slate-500 italic border border-slate-700 border-dashed rounded-xl">
                       <ImageIcon size={40} className="mx-auto mb-3 text-slate-600" />
                       <p>No pictures uploaded yet</p>
                       <p className="text-xs mt-1">Upload photos of the installation site for installers</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {editingClient.needs.siteImages.map((img, idx) => (
                         <div 
                           key={img.id} 
                           className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden hover:border-amber-500/50 transition-all"
                         >
                           {/* Image */}
                           <div 
                             className="relative aspect-video group cursor-pointer" 
                             onClick={(e) => {
                               console.log('Image clicked, URL:', img.url);
                               setPreviewImageIndex(idx);
                               setPreviewImageUrl(img.url);
                             }}
                           >
                             <img 
                               src={img.url} 
                               alt={img.label || "Site photo"}
                               className="w-full h-full object-cover" 
                             />
                             {/* Category Badge */}
                             {img.category && (
                               <span className="absolute top-2 left-2 bg-amber-500 text-slate-900 text-xs px-2 py-1 rounded font-bold shadow-lg">
                                 {img.category}
                               </span>
                             )}
                             {/* Delete Button */}
                             <button 
                               type="button"
                               onClick={(e) => { 
                                 e.stopPropagation();
                                 console.log('Delete clicked for image:', img.id);
                                 handleDeleteImage(img.id); 
                               }} 
                               className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                               title="Delete photo"
                             >
                               <Trash2 size={16} />
                             </button>
                             {/* Click to view hint */}
                             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                               <span className="text-white font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                 Click to enlarge
                               </span>
                             </div>
                           </div>
                           
                           {/* Info Section */}
                           <div className="p-4 space-y-3">
                             {/* Label Input */}
                             <div>
                               <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                               <input
                                 type="text"
                                 value={img.label || ''}
                                 onChange={(e) => {
                                   const updatedImages = editingClient.needs?.siteImages?.map(i => 
                                     i.id === img.id ? { ...i, label: e.target.value } : i
                                   ) || [];
                                   handleNeedsChange('siteImages', updatedImages);
                                 }}
                                 onBlur={() => {
                                   const updated = { ...editingClient, needs: { ...editingClient.needs, siteImages: editingClient.needs?.siteImages } };
                                   onUpdateClient(updated);
                                 }}
                                 placeholder="e.g., Main roof view, Meter location..."
                                 className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                               />
                             </div>
                             
                             {/* Category and Timestamp */}
                             <div className="flex items-center gap-3">
                               <div className="flex-1">
                                 <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Category</label>
                                 <select
                                   value={img.category || ''}
                                   onChange={(e) => {
                                     const updatedImages = editingClient.needs?.siteImages?.map(i => 
                                       i.id === img.id ? { ...i, category: (e.target.value || undefined) as any } : i
                                     ) || [];
                                     handleNeedsChange('siteImages', updatedImages);
                                     const updated = { ...editingClient, needs: { ...editingClient.needs, siteImages: updatedImages } };
                                     onUpdateClient(updated);
                                   }}
                                   className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
                                 >
                                   <option value="">Select...</option>
                                   <option value="Roof">Roof</option>
                                   <option value="Electrical">Electrical</option>
                                   <option value="Access">Access</option>
                                   <option value="Obstacles">Obstacles</option>
                                   <option value="Meter">Meter</option>
                                   <option value="Other">Other</option>
                                 </select>
                               </div>
                               <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Date</label>
                                 <div className="text-xs text-slate-400 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
                                   {new Date(img.timestamp).toLocaleDateString()}
                                 </div>
                               </div>
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                 </section>
              </div>
            )}

            {activeTab === 'DOCUMENTS' && (
              <div className="max-w-5xl animate-in fade-in duration-300 h-full flex flex-col pb-12">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FolderOpen size={20} className="text-amber-500" />
                    File Manager
                  </h3>
                </div>

                {/* Upload Section */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
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
                          {editingClient.type === ClientType.PRIVATE ? (
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

                      {(docType === 'Factura' || docType === 'Other') && (
                        <div className="w-full md:w-1/3">
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                            {docType === 'Factura' ? 'POD / Number' : 'Name'}
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
                    {editingClient.documents && editingClient.documents.length > 0 ? (
                      editingClient.documents.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(doc => (
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
                              onClick={() => {
                                console.log('Delete button clicked for doc:', doc);
                                handleDeleteDocument(doc.id);
                              }} 
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
            )}

            {activeTab === 'QUOTES' && (
               <div className="max-w-6xl animate-in fade-in duration-300 flex flex-col space-y-8 pb-12">
                   {/* Quote Header */}
                   <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={20} className="text-amber-500" />Project Quote</h3>
                        <div className="flex gap-2">
                          <button onClick={handleNewQuoteClick} className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"><RefreshCcw size={16} /> Reset</button>
                          <button onClick={saveClientQuote} className="px-6 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/10"><Save size={18} /> Save</button>
                        </div>
                      </div>

                      {/* Quote Name Section - Simplified */}
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
                              
                              if (value === '') {
                                // No project selected, clear quote name
                                setQuoteProjectName('');
                                return;
                              } else if (value === 'current') {
                                // Current active project
                                setQuoteProjectName(editingClient?.needs?.projectName || '');
                              } else {
                                // Saved project - load its data into current needs
                                const idx = parseInt(value.replace('archived-', ''));
                                const project = editingClient?.archivedProjects?.[idx];
                                if (project && editingClient) {
                                  setQuoteProjectName(project.projectName || `Project ${idx + 1}`);
                                  // Load the saved project data into client needs
                                  const loadedData = JSON.parse(JSON.stringify(project.data));
                                  const updatedClient = {
                                    ...editingClient,
                                    needs: loadedData
                                  };
                                  setEditingClient(updatedClient);
                                  setTempDescription(loadedData.description || '');
                                  // Restore selection states
                                  setSelectedInverterId(loadedData.selectedInverterId || null);
                                  setSelectedBatteryId(loadedData.selectedBatteryId || null);
                                  setSelectedPanelId(loadedData.panelStockItemId || null);
                                }
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                          >
                            <option value="">-- None (Manual Quote) --</option>
                            {editingClient?.needs?.projectName && (
                              <option value="current">
                                {editingClient.needs.projectName}
                              </option>
                            )}
                            {editingClient?.archivedProjects?.map((project, idx) => (
                              <option key={idx} value={`archived-${idx}`}>
                                {project.projectName || `Project ${idx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                   </div>

                   {/* Project Summary - Show when project is selected */}
                   {selectedProjectForQuote && (() => {
                     const projectData = selectedProjectForQuote === 'current' 
                       ? editingClient?.needs 
                       : (() => {
                           const idx = parseInt(selectedProjectForQuote.replace('archived-', ''));
                           return editingClient?.archivedProjects?.[idx]?.data;
                         })();
                     
                     if (!projectData) return null;
                     
                     const connectionType = projectData.connectionType || 'not specified';
                     const inverterKw = projectData.inverterKw || 0;
                     const batteryKwh = projectData.batteryKwh || 0;
                     const panelKw = projectData.panelKw || 0;
                     const roofType = projectData.roofType || 'not specified';
                     
                     return (
                       <div className="bg-gradient-to-br from-amber-500/10 via-slate-800 to-slate-800 border border-amber-500/30 rounded-xl p-6">
                         <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                           <Info size={16} /> Project Summary
                         </h4>
                         <p className="text-white leading-relaxed">
                           The client needs a system for <span className="font-bold text-amber-400">{connectionType}</span> connection{inverterKw > 0 && `, ${inverterKw}kW inverter`}{batteryKwh > 0 && `, ${batteryKwh}kWh storage`}{panelKw > 0 && `, ${panelKw}kW solar panels`}. It has to be installed on a <span className="font-bold text-amber-400">{roofType}</span> roof.
                         </p>
                       </div>
                     );
                   })()}

                   {/* Suggestions Section - Only show when project is selected */}
                   {selectedProjectForQuote && (
                   <div className="space-y-6">
                      {/* Selected Inverter Display */}
                      {editingClient.needs?.selectedInverterId && (() => {
                        const selectedInv = inventory.find(i => i.id === editingClient.needs?.selectedInverterId && i.category === Category.INVERTERS);
                        if (!selectedInv) return null;
                        
                        return (
                          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                              <Zap size={16} className="text-amber-500" />Selected Inverter
                            </h4>
                            <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/50">
                              <div className="flex-1">
                                <p className="text-white font-bold">{selectedInv.name}</p>
                                <p className="text-xs text-slate-400 mt-1">{selectedInv.inverterPowerKw}kW • {selectedInv.inverterConnectionType} • {selectedInv.inverterStorageType} • {selectedInv.quantity} in stock</p>
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

                      {/* Inverter Suggestion - Only if not selected */}
                      {!editingClient.needs?.selectedInverterId && editingClient.needs?.inverterKw && suggestedInverters.length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Zap size={16} className="text-amber-500" />Inverter Suggestions</h4>
                          <div className="space-y-3">
                            {suggestedInverters.map(inv => (
                              <div key={inv.id} className="flex items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-all">
                                <div className="flex-1">
                                  <p className="text-white font-bold">{inv.name}</p>
                                  <p className="text-xs text-slate-400 mt-1">{inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType} • {inv.quantity} in stock</p>
                                  <p className="text-sm text-emerald-400 font-bold mt-2">{inv.sellPrice} RON</p>
                                </div>
                                <button
                                  onClick={() => {
                                    const newLine: QuoteLineItem = {
                                      id: Date.now().toString(),
                                      inventoryItemId: inv.id,
                                      description: `${inv.name} (${inv.inverterPowerKw}kW)`,
                                      unit: 'piece',
                                      quantity: 1,
                                      netPrice: inv.sellPrice,
                                      selectedSerialNumbers: []
                                    };
                                    setQuoteItems([...quoteItems, newLine]);
                                  }}
                                  className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
                                >
                                  Add to Quote
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Selected Panel Display */}
                      {editingClient.needs?.panelStockItemId && (() => {
                        const selectedPanel = inventory.find(i => i.id === editingClient.needs?.panelStockItemId && i.category === Category.PANELS);
                        if (!selectedPanel) return null;
                        
                        const panelPowerW = selectedPanel.powerW || 0;
                        const piecesNeeded = editingClient.needs?.panelCount || 0;
                        const totalPower = (piecesNeeded * panelPowerW) / 1000;
                        
                        return (
                          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                              <Package size={16} className="text-amber-500" />Selected Solar Panels
                            </h4>
                            <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/50">
                              <div className="flex-1">
                                <p className="text-white font-bold">{selectedPanel.name}</p>
                                <p className="text-xs text-slate-400 mt-1">{selectedPanel.powerW}W • {piecesNeeded} pieces = {totalPower.toFixed(2)}kW • {selectedPanel.quantity} available</p>
                                <div className="mt-3 flex items-center gap-2">
                                  <label className="text-xs font-bold text-slate-400">Qty:</label>
                                  <input 
                                    type="number" 
                                    min="1"
                                    defaultValue={piecesNeeded}
                                    id={`selected-panel-qty-${selectedPanel.id}`}
                                    className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                                  />
                                </div>
                                <p className="text-sm text-emerald-400 font-bold mt-2">{selectedPanel.sellPrice} RON/piece</p>
                              </div>
                              <button
                                onClick={() => {
                                  const qtyInput = document.getElementById(`selected-panel-qty-${selectedPanel.id}`) as HTMLInputElement;
                                  const qty = qtyInput ? parseInt(qtyInput.value) || piecesNeeded : piecesNeeded;
                                  const newLine: QuoteLineItem = {
                                    id: Date.now().toString(),
                                    inventoryItemId: selectedPanel.id,
                                    description: `${selectedPanel.name} - ${selectedPanel.powerW}W (${qty} pieces)`,
                                    unit: 'piece',
                                    quantity: qty,
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

                      {/* Panels Suggestion - Only if not selected */}
                      {!editingClient.needs?.panelStockItemId && editingClient.needs?.panelKw && inventory.filter(i => i.category === Category.PANELS).length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Package size={16} className="text-amber-500" />Solar Panels Suggestions</h4>
                          <div className="space-y-3">
                            {inventory.filter(i => i.category === Category.PANELS && i.powerW && i.quantity > 0).map(panel => {
                              const panelPowerW = panel.powerW || 0;
                              const targetWatts = editingClient.needs?.panelKw! * 1000;
                              const piecesNeeded = Math.ceil(targetWatts / panelPowerW);
                              const totalPower = (piecesNeeded * panelPowerW) / 1000;
                              const isSelected = editingClient.needs?.panelStockItemId === panel.id;
                              
                              return (
                                <div key={panel.id} className={`flex items-center justify-between p-4 rounded-lg border transition-all ${isSelected ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-900 border-slate-700 hover:border-amber-500/50'}`}>
                                  <div className="flex-1">
                                    <p className="text-white font-bold">{panel.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">{panel.powerW}W • {piecesNeeded} pieces needed for {totalPower.toFixed(2)}kW • {panel.quantity} available</p>
                                    <div className="mt-3 flex items-center gap-2">
                                      <label className="text-xs font-bold text-slate-400">Qty:</label>
                                      <input 
                                        type="number" 
                                        min="1"
                                        defaultValue={piecesNeeded}
                                        id={`panel-qty-${panel.id}`}
                                        className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center"
                                      />
                                    </div>
                                    <p className="text-sm text-emerald-400 font-bold mt-2">{panel.sellPrice} RON/piece</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const qtyInput = document.getElementById(`panel-qty-${panel.id}`) as HTMLInputElement;
                                      const qty = qtyInput ? parseInt(qtyInput.value) || piecesNeeded : piecesNeeded;
                                      const newLine: QuoteLineItem = {
                                        id: Date.now().toString(),
                                        inventoryItemId: panel.id,
                                        description: `${panel.name} - ${panel.powerW}W (${qty} pieces)`,
                                        unit: 'piece',
                                        quantity: qty,
                                        netPrice: panel.sellPrice,
                                        selectedSerialNumbers: []
                                      };
                                      setQuoteItems([...quoteItems, newLine]);
                                    }}
                                    className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
                                  >
                                    Add to Quote
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Selected Battery Display */}
                      {editingClient.needs?.selectedBatteryId && (() => {
                        const selectedBat = inventory.find(i => i.id === editingClient.needs?.selectedBatteryId && i.category === Category.BATTERIES);
                        if (!selectedBat) return null;
                        
                        return (
                          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                              <Package size={16} className="text-amber-500" />Selected Battery
                            </h4>
                            <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/50">
                              <div className="flex-1">
                                <p className="text-white font-bold">{selectedBat.name}</p>
                                <p className="text-xs text-slate-400 mt-1">{selectedBat.batteryPowerKwh}kWh • {selectedBat.batteryType} • {selectedBat.quantity} in stock</p>
                                <p className="text-sm text-emerald-400 font-bold mt-2">{selectedBat.sellPrice} RON</p>
                              </div>
                              <button
                                onClick={() => {
                                  const newLine: QuoteLineItem = {
                                    id: Date.now().toString(),
                                    inventoryItemId: selectedBat.id,
                                    description: `${selectedBat.name} (${selectedBat.batteryPowerKwh}kWh ${selectedBat.batteryType})`,
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

                      {/* Battery Suggestion - Only if not selected */}
                      {!editingClient.needs?.selectedBatteryId && editingClient.needs?.selectedInverterId && suggestedBatteries.length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Package size={16} className="text-amber-500" />Battery Suggestions</h4>
                          <div className="space-y-3">
                            {suggestedBatteries.map(bat => (
                              <div key={bat.id} className="flex items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-amber-500/50 transition-all">
                                <div className="flex-1">
                                  <p className="text-white font-bold">{bat.name}</p>
                                  <p className="text-xs text-slate-400 mt-1">{bat.batteryPowerKwh}kWh • {bat.batteryType} • {bat.quantity} in stock</p>
                                  <p className="text-sm text-emerald-400 font-bold mt-2">{bat.sellPrice} RON</p>
                                </div>
                                <button
                                  onClick={() => {
                                    const newLine: QuoteLineItem = {
                                      id: Date.now().toString(),
                                      inventoryItemId: bat.id,
                                      description: `${bat.name} (${bat.batteryPowerKwh}kWh ${bat.batteryType})`,
                                      unit: 'piece',
                                      quantity: 1,
                                      netPrice: bat.sellPrice,
                                      selectedSerialNumbers: []
                                    };
                                    setQuoteItems([...quoteItems, newLine]);
                                  }}
                                  className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
                                >
                                  Add to Quote
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mounting Structure Suggestion */}
                      {editingClient.needs?.panelCount && editingClient.needs.panelCount > 0 && (() => {
                        const totalPanels = editingClient.needs.panelCount;
                        const roofType = editingClient.needs.roofType;
                        
                        // Check if row distribution is configured
                        let rowConfigs: number[] = [];
                        if (rowCount === 1) {
                          rowConfigs = [totalPanels];
                        } else {
                          const totalDistributed = Object.values(rowDistribution).reduce((sum, val) => sum + val, 0);
                          if (totalDistributed === totalPanels) {
                            rowConfigs = Array.from({length: rowCount}, (_, i) => rowDistribution[i + 1] || 0);
                          }
                        }

                        const isConfigured = rowConfigs.length > 0 && !rowConfigs.some(c => c === 0);

                        if (!isConfigured) {
                          return (
                            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                              <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                                <Package size={16} className="text-amber-500" />
                                Mounting Structure
                              </h4>
                              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                                <p className="text-sm text-yellow-300">
                                  ⚠ Complete row distribution in Client Needs tab to calculate mounting structures
                                </p>
                              </div>
                            </div>
                          );
                        }

                        // Calculate components
                        const numRows = rowConfigs.length;
                        const endClamps = numRows * 4;
                        const midClamps = rowConfigs.reduce((sum, panelsInRow) => sum + (panelsInRow - 1) * 2, 0);
                        
                        const selectedPanel = editingClient.needs.panelStockItemId 
                          ? inventory.find(i => i.id === editingClient.needs.panelStockItemId) 
                          : null;
                        const panelWidth = selectedPanel?.panelWidth || 1.134;
                        const maxPanelsInRow = Math.max(...rowConfigs);
                        const railLengthPerRow = maxPanelsInRow * panelWidth;
                        const railLengthWithWaste = railLengthPerRow * 1.1;
                        const railsPerRow = 2;
                        const sectionsPerRail = Math.ceil(railLengthWithWaste / 6);
                        const railsOf6m = sectionsPerRail * numRows * railsPerRow;
                        const combinersPerRail = sectionsPerRail > 1 ? sectionsPerRail - 1 : 0;
                        const totalCombiners = combinersPerRail * numRows * railsPerRow;
                        
                        let attachmentType = 'Roof Attachments';
                        let attachmentsPerPanel = 4;
                        
                        if (roofType === 'Tigla ceramica' || roofType === 'Tigla metalica') {
                          attachmentType = 'Tile Hooks';
                          attachmentsPerPanel = 5;
                        } else if (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata') {
                          attachmentType = 'Hanger Bolts';
                          attachmentsPerPanel = 4;
                        } else if (roofType === 'Panou sandwich') {
                          attachmentType = 'Sandwich Panel Bolts';
                          attachmentsPerPanel = 4;
                        }
                        
                        const totalAttachments = totalPanels * attachmentsPerPanel;

                        return (
                          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                <Package size={16} className="text-amber-500" />
                                Mounting Structure
                              </h4>
                              <button
                                onClick={addMountingStructuresToQuote}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-lg"
                              >
                                <Plus size={16} /> Add All to Quote
                              </button>
                            </div>
                            
                            {/* Text Summary */}
                            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                              <p className="text-white leading-relaxed">
                                For <span className="font-bold text-blue-400">{totalPanels} panels</span> in <span className="font-bold text-blue-400">{numRows} rows</span>, you need:
                              </p>
                              <ul className="mt-2 space-y-1 text-sm text-white ml-4">
                                <li>• <span className="font-bold text-blue-400">{endClamps}</span> end clamps (4 per row)</li>
                                <li>• <span className="font-bold text-blue-400">{midClamps}</span> mid clamps (2 per panel connection)</li>
                                <li>• <span className="font-bold text-blue-400">{railsOf6m}</span> rails of 6m (2 per row)</li>
                                {totalCombiners > 0 && <li>• <span className="font-bold text-blue-400">{totalCombiners}</span> rail combiners/connectors</li>}
                                <li>• <span className="font-bold text-blue-400">{totalAttachments}</span> {attachmentType.toLowerCase()} ({attachmentsPerPanel} per panel)</li>
                              </ul>
                            </div>

                            {!roofType && (
                              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <p className="text-xs text-yellow-300">
                                  ⚠ Roof type not specified. Using default calculation (4 bolts/panel)
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                   </div>
                   )}

                   {/* Quote Items Table */}
                   <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
                      <div className="overflow-visible p-6 flex-1">
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
                                const showSuggestions = openSerialPickerId === `quote-${item.id}` && item.description.trim().length > 0;
                                const suggestions = showSuggestions 
                                  ? inventory.filter(p => 
                                      p.name.toLowerCase().includes(item.description.toLowerCase()) || 
                                      p.sku.toLowerCase().includes(item.description.toLowerCase())
                                    ).slice(0, 5) 
                                  : [];
                                
                                const serialsUsedElsewhere = quoteItems
                                  .filter(i => i.id !== item.id)
                                  .flatMap(i => i.selectedSerialNumbers || []);
                                
                                const availableSerials = inventoryItem?.serialNumbers?.filter(
                                  sn => !serialsUsedElsewhere.includes(sn)
                                ) || [];
                                
                                const selectedCount = item.selectedSerialNumbers?.length || 0;
                                const isSerialPickerOpen = openSerialPickerId === `serial-${item.id}`;
                                
                                return (
                                  <tr key={item.id} className="hover:bg-slate-700/30 group border-b border-slate-700/50 last:border-0">
                                    <td className="p-3 text-center text-slate-500 text-sm align-top pt-4">
                                      {idx + 1}
                                    </td>
                                    <td className="p-3 align-top relative">
                                      <div className="relative">
                                        <textarea 
                                          value={item.description}
                                          onChange={(e) => updateQuoteLine(item.id, 'description', e.target.value)}
                                          onFocus={() => setOpenSerialPickerId(`quote-${item.id}`)}
                                          onBlur={() => setTimeout(() => setOpenSerialPickerId(null), 200)}
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
                                                onClick={() => {
                                                  setQuoteItems(quoteItems.map(qi => 
                                                    qi.id === item.id ? {
                                                      ...qi,
                                                      inventoryItemId: suggestion.id,
                                                      description: suggestion.name,
                                                      unit: 'pcs',
                                                      netPrice: suggestion.sellPrice,
                                                      selectedSerialNumbers: []
                                                    } : qi
                                                  ));
                                                  setOpenSerialPickerId(null);
                                                }}
                                                className="p-2.5 hover:bg-slate-700 cursor-pointer flex justify-between items-center border-b border-slate-700/50 last:border-0"
                                              >
                                                <div>
                                                  <div className="text-sm text-white font-medium">{suggestion.name}</div>
                                                  <div className="text-xs text-slate-400">{suggestion.sku}</div>
                                                </div>
                                                <div className="text-xs font-bold text-emerald-400">
                                                  {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(suggestion.sellPrice)}
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
                                              onClick={() => setOpenSerialPickerId(isSerialPickerOpen ? null : `serial-${item.id}`)}
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
                                              <div className="max-h-32 overflow-y-auto space-y-1">
                                                {availableSerials.map(sn => {
                                                  const isSelected = (item.selectedSerialNumbers || []).includes(sn);
                                                  return (
                                                    <div 
                                                      key={sn}
                                                      onClick={() => {
                                                        setQuoteItems(prevItems => prevItems.map(qi => {
                                                          if (qi.id !== item.id) return qi;
                                                          const currentSerials = qi.selectedSerialNumbers || [];
                                                          const newSerials = currentSerials.includes(sn)
                                                            ? currentSerials.filter(s => s !== sn)
                                                            : [...currentSerials, sn];
                                                          return {
                                                            ...qi,
                                                            selectedSerialNumbers: newSerials,
                                                            quantity: newSerials.length > 0 ? newSerials.length : qi.quantity
                                                          };
                                                        }));
                                                      }}
                                                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${isSelected ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-slate-700 text-slate-300'}`}
                                                    >
                                                      {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                                                      <span className="font-mono">{sn}</span>
                                                    </div>
                                                  );
                                                })}
                                                {availableSerials.length === 0 && <div className="text-center text-[10px] text-slate-500 py-2">No serials available</div>}
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
                        <button onClick={handleAddQuoteLine} className="w-full py-3 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-amber-500 hover:text-amber-300 font-bold flex justify-center items-center gap-2 transition-colors"><Plus size={18} /> Add Line</button>
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
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><History size={20} className="text-slate-400" />History</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clientQuotes.slice().reverse().map(q => (
                          <div key={q.id} className="bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl p-4 transition-all relative group">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-white truncate pr-6">{q.title}</h4>
                              <button 
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Delete Quote',
                                    message: `Are you sure you want to delete quote "${q.title}"? This action cannot be undone.`,
                                    variant: 'danger',
                                    onConfirm: () => {
                                      onDeleteQuote(q.id);
                                      setConfirmDialog({ ...confirmDialog, isOpen: false });
                                    }
                                  });
                                }} 
                                className="text-slate-600 hover:text-red-400 cursor-pointer pointer-events-auto"
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
            )}

            {activeTab === 'DOC_GEN' && (
              <div className="max-w-6xl animate-in fade-in duration-300 space-y-8 pb-12">
                 <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                       <FileCog size={20} className="text-amber-500" />
                       Document Generator
                    </h3>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                   {/* Generator UI */}
                   <div className="lg:col-span-7 space-y-6">
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
                        <div className="flex items-center gap-4 mb-6">
                           <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold border border-amber-500/20">1</div>
                           <h4 className="font-bold text-white">Choose Template</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Library Template</label>
                            <select 
                               onChange={handleStoredTemplateSelect} 
                               value={selectedTemplateId} 
                               className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-1 focus:ring-amber-500 outline-none"
                            >
                               <option value="">-- Select from Settings --</option>
                               {docTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                              <div className="w-full border-t border-slate-700"></div>
                            </div>
                            <div className="relative flex justify-center">
                              <span className="px-2 bg-slate-800 text-xs text-slate-500 font-bold uppercase">OR</span>
                            </div>
                          </div>

                          <label className="block w-full border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-amber-500/50 cursor-pointer group transition-all">
                            <Upload className="mx-auto text-slate-500 group-hover:text-amber-500 mb-2" size={24} />
                            <p className="text-sm text-slate-400">Click to upload custom <span className="text-white font-bold">.docx</span> file</p>
                            {templateFile && !selectedTemplateId && (
                                <div className="mt-2 text-xs text-emerald-400 font-bold flex items-center justify-center gap-1">
                                    <CheckCircle size={14} /> {templateFile.name}
                                </div>
                            )}
                            <input type="file" accept=".docx" onChange={handleTemplateSelection} className="hidden" />
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
                        <div className="flex items-center gap-4 mb-6">
                           <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold border border-blue-500/20">2</div>
                           <h4 className="font-bold text-white">Attach Quote Data (Optional)</h4>
                        </div>
                        <select 
                           value={selectedQuoteForGen} 
                           onChange={(e) => setSelectedQuoteForGen(e.target.value)}
                           className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                           <option value="">-- No quote (Contract Only) --</option>
                           {clientQuotes.map(q => <option key={q.id} value={q.id}>{q.title} ({new Date(q.date).toLocaleDateString()})</option>)}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-2 italic">Attaching a quote enables itemized lists and pricing placeholders.</p>
                      </div>

                      <button 
                         onClick={generateDocument} 
                         disabled={!templateFile || isGenerating} 
                         className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-slate-900 font-bold rounded-xl text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
                      >
                         {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <FileOutput size={24} />}
                         {isGenerating ? 'Generating...' : 'Build Document'}
                      </button>
                   </div>

                   {/* Placeholder Guide Side Panel */}
                   <div className="lg:col-span-5 space-y-6">
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                         <div className="flex items-center gap-2 mb-4">
                            <Code className="text-amber-500" size={20} />
                            <h4 className="font-bold text-white uppercase text-xs tracking-widest">Placeholder Guide</h4>
                         </div>
                         <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            Use these tags in your <span className="text-white font-mono">.docx</span> file. They will be replaced automatically.
                         </p>
                         <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                            {PLACEHOLDERS.map(p => (
                               <div key={p.tag} className="flex flex-col p-2 rounded bg-slate-900 border border-slate-700/50">
                                  <code className="text-amber-400 font-bold text-xs mb-1">{p.tag}</code>
                                  <span className="text-[10px] text-slate-500">{p.desc}</span>
                               </div>
                            ))}
                            
                            <div className="mt-6 pt-4 border-t border-slate-700">
                               <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Item Loop Example:</h5>
                               <div className="bg-slate-950 p-3 rounded font-mono text-[9px] text-slate-400 leading-tight border border-slate-800">
                                  <p>{'{#items}'}</p>
                                  <p className="pl-4">Name: {'{description}'}</p>
                                  <p className="pl-4">Price: {'{total_price}'}</p>
                                  <p>{'{/items}'}</p>
                               </div>
                            </div>
                         </div>
                      </div>
                      
                      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3">
                         <Info size={20} className="text-blue-500 flex-shrink-0" />
                         <p className="text-xs text-blue-300 leading-relaxed">
                            Generated documents are automatically saved to the <strong>File Manager</strong> in the <strong>Legal</strong> folder for audit trailing.
                         </p>
                      </div>
                   </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                <div>
                  <h3 className="text-lg font-bold text-white">{previewDoc.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{previewDoc.description} • {new Date(previewDoc.date).toLocaleDateString()}</p>
                </div>
                <button onClick={() => setPreviewDoc(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all flex-shrink-0">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 p-6 bg-slate-900 min-h-[500px] flex flex-col">
                {previewDoc.url?.includes('data:image') || (previewDoc.url?.startsWith('http') && (previewDoc.name?.toLowerCase().endsWith('.jpg') || previewDoc.name?.toLowerCase().endsWith('.jpeg') || previewDoc.name?.toLowerCase().endsWith('.png') || previewDoc.name?.toLowerCase().endsWith('.gif') || previewDoc.name?.toLowerCase().endsWith('.webp'))) ? (
                  <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full max-h-full object-contain rounded-lg mx-auto" />
                ) : isPdfDoc(previewDoc) || (previewDoc.url?.startsWith('http') && (previewDoc.name?.toLowerCase().endsWith('.pdf') || previewDoc.type === 'CI' || previewDoc.type === 'CF' || previewDoc.type === 'Fact')) ? (
                  <PdfPreview url={previewDoc.url} title={previewDoc.name} />
                ) : previewDoc.url?.includes('data:text') ? (
                  <div className="bg-slate-800 rounded-lg p-6 max-h-full overflow-auto border border-slate-700 w-full">
                    <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">
                      {atob(previewDoc.url.split(',')[1])}
                    </pre>
                  </div>
                ) : previewDoc.url?.startsWith('http') ? (
                  <iframe src={previewDoc.url} title={previewDoc.name} className="w-full h-full min-h-[500px] rounded-lg border border-slate-700" />
                ) : (
                  <div className="text-center text-slate-400 flex flex-col items-center gap-4 justify-center h-full">
                    <File size={64} className="text-slate-600" />
                    <div>
                      <p className="font-semibold text-white mb-2">{previewDoc.name}</p>
                      <p className="text-sm">Preview not available for this file type</p>
                      <button onClick={() => downloadDocument(previewDoc.url, previewDoc.name)} className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-all">
                        Download File
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 p-4 border-t border-slate-700 bg-slate-800 justify-end">
                <button onClick={() => downloadDocument(previewDoc.url, previewDoc.name)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all">
                  <Download size={16} /> Download
                </button>
                <button onClick={() => printDocument(previewDoc.url)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all">
                  <Printer size={16} /> Print
                </button>
                <button onClick={() => setPreviewDoc(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Document Edit Modal */}
        {editingDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditingDoc(null)}>
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h3 className="text-lg font-bold text-white">Edit Document</h3>
                <button onClick={() => setEditingDoc(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Document Name</label>
                  <input
                    type="text"
                    value={editingDoc.name || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Document name..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Description</label>
                  <input
                    type="text"
                    value={editingDoc.description || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, description: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Optional description..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Type</label>
                  <select
                    value={editingDoc.type || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="CI">CI</option>
                    <option value="CF">CF</option>
                    <option value="CUI">CUI</option>
                    <option value="Factura">Factura</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
                <button
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditDocument}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-bold transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewImageUrl && editingClient.needs?.siteImages && editingClient.needs.siteImages.length > 0 && (() => {
          const currentImage = editingClient.needs.siteImages[previewImageIndex];
          const totalImages = editingClient.needs.siteImages.length;
          
          const goToNext = () => {
            const nextIndex = (previewImageIndex + 1) % totalImages;
            setPreviewImageIndex(nextIndex);
            setPreviewImageUrl(editingClient.needs.siteImages[nextIndex].url);
          };
          
          const goToPrevious = () => {
            const prevIndex = (previewImageIndex - 1 + totalImages) % totalImages;
            setPreviewImageIndex(prevIndex);
            setPreviewImageUrl(editingClient.needs.siteImages[prevIndex].url);
          };
          
          return (
            <div 
              className="fixed inset-0 bg-black/95 z-50 flex flex-col"
              onClick={() => setPreviewImageUrl(null)}
            >
              {/* Header with details */}
              <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 p-4 flex items-center justify-between flex-shrink-0">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">{currentImage.label || 'Site Photo'}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                    {currentImage.category && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        {currentImage.category}
                      </span>
                    )}
                    <span>Uploaded: {new Date(currentImage.timestamp).toLocaleString()}</span>
                    {currentImage.uploadedBy && <span>By: {currentImage.uploadedBy}</span>}
                    <span className="text-amber-500 font-medium">{previewImageIndex + 1} / {totalImages}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImageUrl(null);
                  }}
                  className="text-white hover:text-amber-500 bg-slate-800/80 hover:bg-slate-700 rounded-full p-3 transition-all"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Image container with fixed height */}
              <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                <div 
                  className="w-full h-full flex items-center justify-center p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Previous button */}
                  {totalImages > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevious();
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-800/90 hover:bg-slate-700 text-white p-4 rounded-full transition-all shadow-2xl z-10 hover:scale-110"
                    >
                      <ArrowLeft size={32} />
                    </button>
                  )}
                  
                  {/* Image with fixed container */}
                  <div className="relative w-full h-full max-w-7xl max-h-[calc(100vh-250px)] flex items-center justify-center">
                    <img 
                      src={previewImageUrl} 
                      alt={currentImage.label || 'Preview'} 
                      className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
                    />
                  </div>
                  
                  {/* Next button */}
                  {totalImages > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNext();
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-800/90 hover:bg-slate-700 text-white p-4 rounded-full transition-all shadow-2xl z-10 hover:scale-110"
                    >
                      <ArrowRight size={32} />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Thumbnail strip */}
              {totalImages > 1 && (
                <div className="bg-slate-900/90 backdrop-blur-sm border-t border-slate-700 p-4 flex-shrink-0">
                  <div className="flex gap-2 justify-center overflow-x-auto max-w-6xl mx-auto pb-2">
                    {editingClient.needs.siteImages.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageIndex(idx);
                          setPreviewImageUrl(img.url);
                        }}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === previewImageIndex
                            ? 'border-amber-500 scale-110 shadow-lg shadow-amber-500/50'
                            : 'border-slate-600 hover:border-slate-400 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img 
                          src={img.url} 
                          alt={img.label || `Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Confirm Dialog for client detail actions */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmLabel={confirmDialog.confirmLabel}
          cancelLabel={confirmDialog.cancelLabel}
          thirdButtonLabel={confirmDialog.thirdButtonLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel || (() => setConfirmDialog({ ...confirmDialog, isOpen: false }))}
          onThirdButton={confirmDialog.onThirdButton}
        />
      </div>
    );
  }

  // List View (Default)
  return (
    <div className="h-full flex flex-col bg-slate-900 p-8 overflow-hidden">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-white mb-2">Client Registry</h1><p className="text-slate-400">Manage your customer base</p></div>
        {currentUser?.role !== 'INSTALLER' && <button onClick={handleOpenModal} className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20"><Plus size={20} /> New Client</button>}
      </header>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex flex-col md:flex-row gap-4">
           <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} /><input type="text" placeholder="Search clients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white outline-none" /></div>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
           {filteredClients.map(client => (
             <div key={client.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 hover:border-amber-500/50 transition-colors group">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">{client.type === ClientType.CORPORATE ? <Building2 size={24}/> : <User size={24}/>}</div>
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white truncate">{client.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${getStatusColor(client.status)}`}>{client.status}</span>
                    {client.internalId && <span className="text-[10px] bg-slate-800 border border-slate-600 px-2 py-0.5 rounded text-slate-400 font-mono">{client.internalId}</span>}
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-500">
                    {client.email && <div className="flex items-center gap-1"><Mail size={14}/> {client.email}</div>}
                    {client.phone && <div className="flex items-center gap-1"><Phone size={14}/> {client.phone}</div>}
                  </div>
                </div>
                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setSelectedClient(client)} className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10">Open</button>{currentUser?.role === 'SUPER_ADMIN' && <button onClick={() => onDeleteClient(client.id)} className="bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-500 p-2 rounded-lg border border-slate-700"><Trash2 size={20} /></button>}</div>
             </div>
           ))}
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-4xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Add New Client</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              {step === 'TYPE_SELECTION' ? (
                <div className="grid grid-cols-2 gap-6 h-64">
                  <button onClick={() => handleTypeSelect(ClientType.PRIVATE)} className="h-full bg-slate-900 border-2 border-slate-700 hover:border-amber-500 rounded-2xl flex flex-col items-center justify-center gap-4 group transition-all">
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-amber-500/10"><User size={40} className="text-slate-400 group-hover:text-amber-500 transition-colors"/></div>
                    <div><span className="text-xl font-bold text-white block">Private</span><span className="text-sm text-slate-500">Individual customer (SI_3000+)</span></div>
                  </button>
                  <button onClick={() => handleTypeSelect(ClientType.CORPORATE)} className="h-full bg-slate-900 border-2 border-slate-700 hover:border-blue-500 rounded-2xl flex flex-col items-center justify-center gap-4 group transition-all">
                     <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-blue-500/10"><Building2 size={40} className="text-slate-400 group-hover:text-blue-500 transition-colors"/></div>
                     <div><span className="text-xl font-bold text-white block">Corporate</span><span className="text-sm text-slate-500">Company entity (SI_2000+)</span></div>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveNewClient} className="space-y-8">
                  <div>
                     <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">{selectedType === ClientType.PRIVATE ? 'Personal Details' : 'Company Details'}</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{selectedType === ClientType.PRIVATE ? (<><div><label className="text-xs font-medium text-slate-400 mb-1 block">Last Name</label><input required name="lastName" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">First Name</label><input required name="firstName" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">CNP</label><input name="cnp" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div></>) : (<><div className="md:col-span-2"><label className="text-xs font-medium text-slate-400 mb-1 block">Company Name</label><input required name="companyName" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">Tax ID</label><input name="taxId" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">Reg Number</label><input name="regNumber" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">Bank Name</label><input name="bankName" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">IBAN</label><input name="iban" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">Representative</label><input name="representative" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div></>)}</div>
                  </div>
                  <div>
                      <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">Address</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4"><div className="lg:col-span-2"><label className="text-xs font-medium text-slate-400 mb-1 block">Country</label><input name="country" defaultValue="Romania" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div className="lg:col-span-2"><label className="text-xs font-medium text-slate-400 mb-1 block">County</label><input name="county" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div className="lg:col-span-2"><label className="text-xs font-medium text-slate-400 mb-1 block">City</label><input required name="city" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div className="lg:col-span-5"><label className="text-xs font-medium text-slate-400 mb-1 block">Street Name</label><input required name="street" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div className="lg:col-span-1"><label className="text-xs font-medium text-slate-400 mb-1 block">Number</label><input required name="streetNumber" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div></div>
                  </div>
                  <div>
                      <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">Contact Info</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-medium text-slate-400 mb-1 block">Phone Number</label><input required name="phone" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div><div><label className="text-xs font-medium text-slate-400 mb-1 block">Email Address</label><input name="email" type="email" onChange={handleNewClientInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div></div>
                  </div>
                  <div className="pt-6 flex justify-between items-center border-t border-slate-700"><button type="button" onClick={() => setStep('TYPE_SELECTION')} className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-2"><ArrowLeft size={16}/> Change Type</button><div className="flex gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600">Cancel</button><button type="submit" className="px-8 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20">Create Client</button></div></div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        thirdButtonLabel={confirmDialog.thirdButtonLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel || (() => setConfirmDialog({ ...confirmDialog, isOpen: false }))}
        onThirdButton={confirmDialog.onThirdButton}
      />

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 text-white hover:text-amber-500 bg-slate-800/80 hover:bg-slate-700 rounded-full p-3 transition-all z-10"
          >
            <X size={24} />
          </button>
          <div 
            className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={previewImageUrl} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
