'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Client, ClientType, ClientNote, ClientDocument, ClientSiteImage, InventoryItem, Quote, QuoteLineItem, DocTemplate, UserRole, Category } from '../types';
// Added Loader2 to the lucide-react imports
import { Search, Building2, User, Phone, Mail, MapPin, Plus, ArrowLeft, X, CheckCircle, FileText, Zap, FolderOpen, Upload, Trash2, ExternalLink, Printer, Share2, Download, Save, ClipboardList, Camera, Image as ImageIcon, History, RefreshCcw, Eye, Edit3, ChevronDown, CheckSquare, Square, Package, FileCog, FileOutput, Home, DollarSign, Scale, Wrench, Folder, ArrowUp, Hash, CreditCard, Briefcase, Calculator, Info, Code, Loader2, AlertCircle } from 'lucide-react';
import { FileSystem, getFolderForDocType } from '../services/fileSystemService';
import { ConfirmDialog } from './ConfirmDialog';

interface ClientRegistryProps {
  clients: Client[];
  currentUser: any;
  onAddClient: (client: Client) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  inventory: InventoryItem[];
  savedQuotes: Quote[];
  onSaveQuote: (quote: Quote) => void;
  onDeleteQuote: (id: string) => void;
  docTemplates: DocTemplate[];
}

type ModalStep = 'TYPE_SELECTION' | 'FORM';
type DetailTab = 'DATA' | 'NEEDS' | 'DOCUMENTS' | 'QUOTES' | 'DOC_GEN';

export const ClientRegistry: React.FC<ClientRegistryProps> = ({ 
  clients, currentUser, onAddClient, onUpdateClient, onDeleteClient, inventory, savedQuotes, onSaveQuote, onDeleteQuote, docTemplates
}) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('DATA');
  
  // List State
  const [filterType, setFilterType] = useState<'ALL' | ClientType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('TYPE_SELECTION');
  const [selectedType, setSelectedType] = useState<ClientType>(ClientType.PRIVATE);

  // Form State (New Client)
  const [newClientFormData, setNewClientFormData] = useState<Partial<Client>>({});

  // Editing State (For existing client)
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Notes State
  const [newNote, setNewNote] = useState('');

  // Documents / File System State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('CI');
  const [docInput, setDocInput] = useState(''); 

  // Camera State for Needs Tab
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Quote Tab State
  const [quoteProjectName, setQuoteProjectName] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [openSerialPickerId, setOpenSerialPickerId] = useState<string | null>(null);
  const [serialSearchTerm, setSerialSearchTerm] = useState('');

  // Document Generator State
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedQuoteForGen, setSelectedQuoteForGen] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Needs Tab Specific State (For calculation effects)
  const [tempDescription, setTempDescription] = useState('');

  // State for alternatives dropdown
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Selected inverter, panel and battery state
  const [selectedInverterId, setSelectedInverterId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedPanelQty, setSelectedPanelQty] = useState<number | null>(null);
  const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(null);

  // Archive projects state
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
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

  const filteredClients = clients.filter(client => {
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
            descriptionUpdatedBy: currentUser.nickname,
            descriptionUpdatedAt: new Date()
        }
    });
    setHasChanges(true);
  };

  const handleSaveChanges = () => {
    if (!editingClient) return;
    let finalNeeds = { ...editingClient.needs };
    if (tempDescription !== editingClient.needs?.description) {
        finalNeeds.description = tempDescription;
        finalNeeds.descriptionUpdatedBy = currentUser.nickname;
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
    setHasChanges(true);
  };

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
    if (!editingClient?.needs?.inverterKw) return [];
    const storageType = editingClient.needs.inverterKw ? inventory.find(i => 
      i.category === Category.INVERTERS && 
      Math.abs(i.inverterPowerKw || 0 - editingClient.needs.inverterKw!) <= 2 &&
      i.inverterStorageType
    )?.inverterStorageType : null;

    if (!storageType) return [];

    return inventory.filter(item => {
      if (item.category !== Category.BATTERIES) return false;
      if (item.batteryType === storageType && item.quantity > 0) return true;
      return false;
    });
  }, [editingClient?.needs?.inverterKw, inventory]);

  const handleAddNote = () => {
    if (!editingClient || !newNote.trim()) return;
    const newNoteObj: ClientNote = { id: Date.now().toString(), content: newNote, date: new Date(), author: currentUser.nickname };
    const updatedClient = { ...editingClient, notes: [newNoteObj, ...(editingClient.notes || [])] };
    onUpdateClient(updatedClient);
    setSelectedClient(updatedClient);
    setEditingClient(updatedClient);
    setNewNote('');
  };

  const handleDeleteNote = (noteId: string) => {
    if (!editingClient) return;
    if (currentUser.role !== 'SUPER_ADMIN' && !editingClient.notes?.find(n => n.id === noteId && n.author === currentUser.nickname)) {
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
    let typeLabel = docType;
    let generatedName = `[${internalId}] ${typeLabel} ${editingClient.name}`;
    let description = '';
    if (docType === 'Factura' && docInput.trim()) {
        description = `POD: ${docInput}`;
    } else if (docType === 'Other' && docInput.trim()) {
        generatedName = `[${internalId}] ${docInput.trim()} ${editingClient.name}`;
        description = docInput.trim(); 
    }
    try {
      const newDoc = await FileSystem.saveFile(editingClient, uploadFile, getFolderForDocType(docType), docType as any, generatedName);
      newDoc.description = description;
      const updatedClient = { ...editingClient, documents: [newDoc, ...(editingClient.documents || [])] };
      onUpdateClient(updatedClient);
      setSelectedClient(updatedClient);
      setEditingClient(updatedClient);
      setUploadFile(null);
      setDocInput('');
      setDocType('CI');
    } catch (error) { console.error(error); alert("Failed to upload document"); }
  };

  const handleDeleteDocument = (docId: string) => {
    if (!editingClient) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document? This action cannot be undone.',
      variant: 'danger',
      onConfirm: () => {
        const updatedClient = { ...editingClient, documents: editingClient.documents?.filter(d => d.id !== docId) || [] };
        onUpdateClient(updatedClient);
        setSelectedClient(updatedClient);
        setEditingClient(updatedClient);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const openDocument = (url: string) => {
     const win = window.open();
     if (win) win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  };

  const printDocument = (url: string) => {
    const win = window.open('', '_blank');
    if (win) { win.document.write(`<img src="${url}" onload="window.print();window.close()" />`); win.focus(); }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch (err) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
      } catch (err2) { alert("Could not access camera."); setIsCameraOpen(false); }
    }
  };
  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };
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
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        const newImage: ClientSiteImage = { id: Date.now().toString(), url: reader.result as string, timestamp: new Date() };
        const currentImages = editingClient?.needs?.siteImages || [];
        handleNeedsChange('siteImages', currentImages ? [...currentImages, newImage] : [newImage]);
      };
      reader.readAsDataURL(e.target.files[0]);
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
        handleNeedsChange('siteImages', currentImages.filter(img => img.id !== imageId));
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleAddQuoteLine = () => {
    const newItem: QuoteLineItem = { id: Date.now().toString() + Math.random().toString(), description: '', unit: 'pcs', quantity: 1, netPrice: 0 };
    setQuoteItems([...quoteItems, newItem]);
  };
  const updateQuoteLine = (id: string, field: keyof QuoteLineItem, value: any) => {
    setQuoteItems(quoteItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const selectQuoteProduct = (id: string, product: InventoryItem) => {
    setQuoteItems(quoteItems.map(item => item.id === id ? { ...item, inventoryItemId: product.id, description: product.name, netPrice: product.sellPrice, unit: 'pcs', selectedSerialNumbers: [] } : item));
    setFocusedRowId(null);
  };
  const removeQuoteLine = (id: string) => setQuoteItems(quoteItems.filter(item => item.id !== id));
  const toggleQuoteSerialNumber = (itemId: string, serial: string) => {
    setQuoteItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item;
      const currentSerials = item.selectedSerialNumbers || [];
      const newSerials = currentSerials.includes(serial) ? currentSerials.filter(s => s !== serial) : [...currentSerials, serial];
      return { ...item, selectedSerialNumbers: newSerials, quantity: newSerials.length > 0 ? newSerials.length : item.quantity };
    }));
  };
  const quoteTotals = useMemo(() => {
    const subtotalNet = quoteItems.reduce((acc, item) => acc + (item.quantity * item.netPrice), 0);
    const vatTotal = subtotalNet * 0.21;
    const totalGross = subtotalNet + vatTotal;
    return { subtotalNet, vatTotal, totalGross };
  }, [quoteItems]);
  const handleNewQuoteClick = () => { setQuoteItems([]); setQuoteProjectName(''); setEditingQuoteId(null); };
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
          <button onClick={() => setSelectedClient(null)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"><ArrowLeft size={24} /></button>
          <div><h1 className="text-2xl font-bold text-white leading-tight">{editingClient.name}</h1><div className="flex items-center gap-2 mt-1"><span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(editingClient.status)}`}>{editingClient.status}</span><span className="text-sm text-slate-400 flex items-center gap-1">{editingClient.type === ClientType.CORPORATE ? <Building2 size={14}/> : <User size={14}/>}{editingClient.type}</span></div></div>
          {hasChanges && (
            <div className="ml-auto flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
              <span className="text-sm text-amber-500 italic">Unsaved changes</span>
              <button 
                onClick={handleSaveChanges}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
              >
                <Save size={18} /> Save Changes
              </button>
            </div>
          )}
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 bg-slate-800/50 border-r border-slate-700 p-4 space-y-2">
            {[
              { id: 'DATA', label: 'Client Data', icon: FileText },
              { id: 'NEEDS', label: 'Clients Need', icon: Zap },
              { id: 'DOCUMENTS', label: 'File Manager', icon: FolderOpen },
              { id: 'QUOTES', label: 'Client Quotes', icon: FileText },
              { id: 'DOC_GEN', label: 'Doc Generator', icon: FileCog }
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
                             <input name="internalId" value={editingClient.internalId || ''} onChange={handleEditChange} disabled={currentUser.role !== 'SUPER_ADMIN'} className={`w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none font-mono ${currentUser.role !== 'SUPER_ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="Auto-generated" />
                             {currentUser.role !== 'SUPER_ADMIN' && <span className="text-[10px] text-slate-500 mt-1">Only Super Admins can manually edit the Internal ID.</span>}
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
                      onClick={() => {
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
                        setEditingClient({ ...editingClient, archivedProjects: updatedArchived });
                        setHasChanges(true);
                        // Clear current data
                        const clearedNeeds = { projectName: '', description: '', connectionType: undefined, roofType: undefined, roofTypeOther: undefined, inverterKw: undefined, panelKw: 0, panelCount: 0, panelStockItemId: undefined, storage: '', technicalNotes: '', siteImages: [] };
                        setEditingClient({ ...editingClient, needs: clearedNeeds, archivedProjects: updatedArchived });
                        setTempDescription('');
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors mb-4"
                    >
                      <Save size={18} /> Save Project
                    </button>
                    {archivedProjects.length > 0 && (
                      <div className="space-y-2 border-t border-slate-700 pt-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Archived Projects</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                          {archivedProjects.map(project => (
                            <div 
                              key={project.id}
                              className="flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer group"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-bold text-sm truncate">{project.projectName}</p>
                                <p className="text-xs text-slate-500">{new Date(project.archivedAt).toLocaleDateString()}</p>
                              </div>
                              <div className="flex gap-2 ml-2 pointer-events-auto">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingClient({ ...editingClient, needs: JSON.parse(JSON.stringify(project.data)) });
                                    setTempDescription(project.data.description || '');
                                    setHasChanges(true);
                                  }}
                                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap"
                                >
                                  Load
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const projectId = project.id;
                                    const projectName = project.projectName;
                                    setConfirmDialog({
                                      isOpen: true,
                                      title: 'Delete Archived Project',
                                      message: `Are you sure you want to delete archived project "${projectName}"? This action cannot be undone.`,
                                      variant: 'danger',
                                      onConfirm: () => {
                                        setArchivedProjects(prev => {
                                          const updated = prev.filter(p => p.id !== projectId);
                                          setEditingClient(current => {
                                            return {
                                              ...current,
                                              archivedProjects: updated
                                            };
                                          });
                                          return updated;
                                        });
                                        setHasChanges(true);
                                        setConfirmDialog({ ...confirmDialog, isOpen: false });
                                      }
                                    });
                                  }}
                                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
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
                        {/* Suitable Inverters Found */}
                        {suggestedInverters.length > 0 && !selectedInverterId && (
                          <div className="space-y-3">
                            <p className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={12} /> Suitable Inverters Found</p>
                            {suggestedInverters.map(inv => (
                              <div 
                                key={inv.id}
                                className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all"
                                onClick={() => setSelectedInverterId(inv.id)}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="text-white font-bold">{inv.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">{inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType} • {inv.quantity} in stock</p>
                                    <p className="text-sm text-emerald-400 font-bold mt-2">{inv.sellPrice} RON</p>
                                  </div>
                                  <button 
                                    type="button"
                                    className="ml-4 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded text-xs whitespace-nowrap"
                                  >
                                    Select
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button 
                              type="button"
                              onClick={() => setShowAlternatives(true)}
                              className="w-full px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors"
                            >
                              Choose Different Inverter
                            </button>
                          </div>
                        )}

                        {/* Selected Inverter with Warnings */}
                        {selectedInverterId && (() => {
                          const selected = inventory.find(i => i.id === selectedInverterId && i.category === Category.INVERTERS);
                          if (!selected) return null;
                          
                          const connectionMismatch = editingClient.needs?.connectionType && selected.inverterConnectionType !== editingClient.needs.connectionType;
                          const powerDiff = selected.inverterPowerKw ? selected.inverterPowerKw - (editingClient.needs?.inverterKw || 0) : 0;
                          const hasPowerWarning = Math.abs(powerDiff) > 0.5;
                          
                          return (
                            <div className="mb-4 p-4 bg-slate-900 border-2 border-emerald-500/50 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-white font-bold">{selected.name}</p>
                                  <p className="text-xs text-slate-400 mt-1">{selected.inverterPowerKw}kW • {selected.inverterConnectionType} • {selected.inverterStorageType}</p>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setSelectedInverterId(null)}
                                  className="text-slate-400 hover:text-white"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                              
                              {connectionMismatch && (
                                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/50 rounded text-xs text-red-300 font-bold flex items-center gap-2">
                                  <AlertCircle size={14} /> Wrong bransament type. Selected: {selected.inverterConnectionType}, Project: {editingClient.needs?.connectionType}
                                </div>
                              )}
                              
                              {hasPowerWarning && (
                                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/50 rounded text-xs text-yellow-300 font-bold flex items-center gap-2">
                                  <AlertCircle size={14} /> Inverter capacity is {powerDiff > 0 ? 'bigger' : 'smaller'} than requested by {Math.abs(powerDiff).toFixed(2)}kW
                                </div>
                              )}
                              
                              <button 
                                type="button"
                                onClick={() => setShowAlternatives(!showAlternatives)}
                                className="w-full mt-4 px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors"
                              >
                                Choose Different Inverter
                              </button>
                            </div>
                          );
                        })()}

                        {/* Choose Different Inverter Modal */}
                        {showAlternatives && (
                          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center mb-3">
                              <p className="text-xs font-bold text-slate-400 uppercase">All Available Inverters</p>
                              <button 
                                type="button"
                                onClick={() => setShowAlternatives(false)}
                                className="text-slate-400 hover:text-white"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                              {inventory.filter(i => i.category === Category.INVERTERS && i.quantity > 0).map(inv => (
                                <div 
                                  key={inv.id}
                                  className="flex items-center justify-between bg-slate-800 p-3 rounded border border-slate-700 hover:border-amber-500/50 cursor-pointer transition-all"
                                  onClick={() => {
                                    setSelectedInverterId(inv.id);
                                    setShowAlternatives(false);
                                  }}
                                >
                                  <div className="flex-1">
                                    <p className="text-white font-bold text-sm">{inv.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">{inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType}</p>
                                  </div>
                                  <div className="text-right ml-3">
                                    <p className="text-xs font-bold text-emerald-400">{inv.quantity} in stock</p>
                                    <p className="text-xs text-slate-400">{inv.sellPrice} RON</p>
                                  </div>
                                </div>
                              ))}
                              {inventory.filter(i => i.category === Category.INVERTERS && i.quantity > 0).length === 0 && (
                                <div className="text-center py-4 text-slate-500 text-sm italic">No inverters in stock</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* No Suitable Inverters - Show Dropdown */}
                        {suggestedInverters.length === 0 && !selectedInverterId && (
                          <div className="relative">
                            <button 
                              type="button"
                              onClick={() => setShowAlternatives(!showAlternatives)}
                              className="w-full text-left px-4 py-3 bg-slate-900 border border-amber-500/50 rounded-lg text-amber-400 font-bold flex items-center justify-between hover:bg-slate-800 transition-colors"
                            >
                              <span>❌ No suitable inverters found. Available options:</span>
                              <ChevronDown size={16} className={`transform transition-transform ${showAlternatives ? 'rotate-180' : ''}`} />
                            </button>
                            {showAlternatives && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-amber-500/50 rounded-lg shadow-lg z-10">
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                  {inventory.filter(i => i.category === Category.INVERTERS && i.quantity > 0).map(inv => (
                                    <div 
                                      key={inv.id}
                                      className="flex items-center justify-between bg-slate-800 p-3 border-b border-slate-700 hover:bg-slate-750 cursor-pointer transition-all"
                                      onClick={() => {
                                        setSelectedInverterId(inv.id);
                                        setShowAlternatives(false);
                                      }}
                                    >
                                      <div className="flex-1">
                                        <p className="text-white font-bold text-sm">{inv.name}</p>
                                        <p className="text-xs text-slate-400 mt-1">{inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType}</p>
                                      </div>
                                      <div className="text-right ml-3">
                                        <p className="text-xs font-bold text-emerald-400">{inv.quantity} in stock</p>
                                        <p className="text-xs text-slate-400">{inv.sellPrice} RON</p>
                                      </div>
                                    </div>
                                  ))}
                                  {inventory.filter(i => i.category === Category.INVERTERS && i.quantity > 0).length === 0 && (
                                    <div className="text-center py-4 text-slate-500 text-sm italic">No inverters in stock</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                 </section>
                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2"><Package size={16} className="text-amber-500" />Panels Calculator</h3>
                    <div className="space-y-6">
                      {/* Input: Total Power */}
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

                      {/* Panel Suggestions */}
                      {editingClient.needs?.panelKw && editingClient.needs.panelKw > 0 && (
                        <div className="border-t border-slate-700 pt-4">
                          <p className="text-xs text-slate-400 font-bold mb-3">💡 Panel Combinations Available:</p>
                          <div className="space-y-2">
                            {inventory
                              .filter(i => i.category === Category.PANELS && i.powerW && i.powerW > 0)
                              .map(panel => {
                                const targetWatts = editingClient.needs!.panelKw! * 1000; // Convert kW to W
                                const piecesNeeded = Math.ceil(targetWatts / panel.powerW!);
                                const actualPower = (piecesNeeded * panel.powerW!) / 1000; // Convert back to kW
                                const isSelected = selectedPanelId === panel.id;
                                
                                return (
                                  <div 
                                    key={panel.id} 
                                    className={`p-3 rounded border transition-all flex justify-between items-center cursor-pointer ${
                                      isSelected 
                                        ? 'bg-emerald-500/10 border-emerald-500/50' 
                                        : 'bg-slate-900 border-slate-700 hover:border-amber-500/50'
                                    }`}
                                    onClick={() => {
                                      setSelectedPanelId(panel.id);
                                      setSelectedPanelQty(piecesNeeded);
                                      handleNeedsChange('panelStockItemId', panel.id);
                                      handleNeedsChange('panelCount', piecesNeeded);
                                    }}
                                  >
                                    <div>
                                      <p className={`font-bold text-sm ${isSelected ? 'text-emerald-400' : 'text-white'}`}>{panel.name}</p>
                                      <p className="text-xs text-slate-400">{panel.powerW}W • {piecesNeeded} pieces needed • {actualPower.toFixed(2)}kW total</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-bold text-emerald-400">{panel.quantity} in stock</p>
                                      <p className="text-xs text-slate-400">{panel.sellPrice} RON</p>
                                    </div>
                                  </div>
                                );
                              })
                            }
                            {inventory.filter(i => i.category === Category.PANELS && i.powerW && i.powerW > 0).length === 0 && (
                              <div className="text-center py-4 text-slate-500 text-sm italic">No solar panels in inventory</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selected Configuration */}
                      {editingClient.needs?.panelStockItemId && editingClient.needs?.panelCount && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg">
                          <p className="text-xs font-bold text-emerald-400 mb-2">✓ Selected Configuration</p>
                          <div className="space-y-1">
                            {(() => {
                              const selected = inventory.find(i => i.id === editingClient.needs?.panelStockItemId);
                              if (!selected) return null;
                              const total = (editingClient.needs.panelCount * selected.powerW!) / 1000;
                              return (
                                <>
                                  <p className="text-sm text-white font-bold">{editingClient.needs.panelCount} x {selected.name}</p>
                                  <p className="text-xs text-emerald-300">{selected.powerW}W per panel = {total.toFixed(2)}kW total</p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Manual Pieces Input */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Or Enter Pieces Manually</label>
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
                          placeholder="Number of pieces" 
                        />
                      </div>
                    </div>
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
                    </div>

                    {editingClient.needs?.batteryKwh && selectedInverterId && (() => {
                      const selectedInv = inventory.find(i => i.id === selectedInverterId && i.category === Category.INVERTERS);
                      if (!selectedInv?.inverterStorageType) return null;

                      const batteryType = selectedInv.inverterStorageType;
                      const targetCapacity = editingClient.needs.batteryKwh || 0;
                      
                      // Get compatible batteries
                      const compatible = inventory.filter(i => 
                        i.category === Category.BATTERIES && 
                        i.batteryType === batteryType &&
                        i.quantity > 0
                      );

                      // Get all batteries sorted by capacity difference
                      const allBatteries = inventory.filter(i => 
                        i.category === Category.BATTERIES &&
                        i.quantity > 0
                      ).sort((a, b) => {
                        const diffA = Math.abs((a.batteryPowerKwh || 0) - targetCapacity);
                        const diffB = Math.abs((b.batteryPowerKwh || 0) - targetCapacity);
                        return diffA - diffB;
                      });

                      return (
                        <div className="space-y-4">
                          {/* Selected Battery with Warnings */}
                          {selectedBatteryId && (() => {
                            const selected = inventory.find(i => i.id === selectedBatteryId && i.category === Category.BATTERIES);
                            if (!selected) return null;
                            
                            const typeMismatch = selected.batteryType !== batteryType;
                            const capacityDiff = (selected.batteryPowerKwh || 0) - targetCapacity;
                            const hasCapacityWarning = Math.abs(capacityDiff) > 0.5;
                            
                            return (
                              <div className="mb-4 p-4 bg-slate-900 border-2 border-emerald-500/50 rounded-lg">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="text-white font-bold">{selected.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">{selected.batteryPowerKwh}kWh • {selected.batteryType} • {selected.quantity} in stock</p>
                                  </div>
                                  <button 
                                    onClick={() => setSelectedBatteryId(null)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                
                                {typeMismatch && (
                                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/50 rounded text-xs text-red-300 font-bold flex items-center gap-2">
                                    <AlertCircle size={14} /> Battery type not compatible. Selected: {selected.batteryType}, Needed: {batteryType}
                                  </div>
                                )}
                                
                                {hasCapacityWarning && (
                                  <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/50 rounded text-xs text-yellow-300 font-bold flex items-center gap-2">
                                    <AlertCircle size={14} /> Battery capacity is {capacityDiff > 0 ? 'higher' : 'lower'} than requested by {Math.abs(capacityDiff).toFixed(1)}kWh
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Battery Selection Dropdown */}
                          <div className="relative">
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Select Battery</label>
                            <select 
                              value={selectedBatteryId || ''} 
                              onChange={(e) => setSelectedBatteryId(e.target.value || null)}
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="">-- Choose battery --</option>
                              {compatible.length > 0 && (
                                <optgroup label="Compatible (Sorted by Stock)">
                                  {compatible.sort((a, b) => (b.quantity || 0) - (a.quantity || 0)).map(bat => (
                                    <option key={bat.id} value={bat.id}>{bat.name} ({bat.batteryPowerKwh}kWh) - {bat.quantity} in stock</option>
                                  ))}
                                </optgroup>
                              )}
                              {allBatteries.filter(b => !compatible.find(c => c.id === b.id)).length > 0 && (
                                <optgroup label="Alternatives (Sorted by Stock)">
                                  {allBatteries.filter(b => !compatible.find(c => c.id === b.id)).sort((a, b) => (b.quantity || 0) - (a.quantity || 0)).map(bat => (
                                    <option key={bat.id} value={bat.id}>{bat.name} ({bat.batteryPowerKwh}kWh, {bat.batteryType}) - {bat.quantity} in stock</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                        </div>
                      );
                    })()}
                 </section>

                 <section className="bg-slate-800 p-6 rounded-xl border border-slate-700"><h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><ImageIcon size={16} className="text-amber-500" />Site Pictures</h3><div className="flex gap-4 mb-6"><label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"><Upload size={16} /> Upload<input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" /></label><button onClick={startCamera} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"><Camera size={16} /> Take Photo</button></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{editingClient.needs?.siteImages?.map(img => (<div key={img.id} className="relative group aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700"><img src={img.url} className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(img.url)} /><button onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button></div>))}</div></section>
              </div>
            )}

            {activeTab === 'DOCUMENTS' && (
              <div className="max-w-5xl animate-in fade-in duration-300 h-full flex flex-col pb-12">
                <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-bold text-white flex items-center gap-2"><FolderOpen size={20} className="text-amber-500" />File Manager</h3></div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8"><h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Upload size={16} /> Upload Document</h4><div className="flex flex-col md:flex-row gap-4 items-end"><div className="w-full md:w-1/4"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Type</label><select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500">{editingClient.type === ClientType.PRIVATE ? (<><option value="CI">CI</option><option value="CF">CF</option><option value="Factura">Factura</option><option value="Other">Other</option></>) : (<><option value="CI">CI</option><option value="CUI">CUI</option><option value="Other">Other</option></>)}</select></div>{(docType === 'Factura' || docType === 'Other') && (<div className="w-full md:w-1/3"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{docType === 'Factura' ? 'POD / Description' : 'Name'}</label><input type="text" value={docInput} onChange={(e) => setDocInput(e.target.value)} placeholder="..." className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white outline-none focus:ring-1 focus:ring-amber-500" /></div>)}<div className="flex-1 w-full"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Select File</label><input type="file" onChange={handleFileSelection} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-amber-400 hover:file:bg-slate-600 transition-all" /></div><button onClick={handleUploadDocument} disabled={!uploadFile} className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"><Upload size={18} /> Upload</button></div></div>
                <div className="space-y-4"><h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Attached Documents</h4><div className="grid grid-cols-1 gap-3">{editingClient.documents && editingClient.documents.length > 0 ? (editingClient.documents.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(doc => (<div key={doc.id} className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between group transition-all gap-4"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-600 text-blue-400 flex-shrink-0"><FileText size={20} /></div><div><h5 className="font-bold text-white text-sm">{doc.name}</h5>{doc.description && (<p className="text-xs text-amber-500 mt-0.5 font-medium">{doc.description}</p>)}<p className="text-xs text-slate-500 mt-0.5">{new Date(doc.date).toLocaleDateString()} • {doc.type}</p></div></div><div className="flex gap-2"><button onClick={() => openDocument(doc.url)} title="Preview" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><ExternalLink size={16} /></button><button onClick={() => printDocument(doc.url)} title="Print" className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"><Printer size={16} /></button><button onClick={() => handleDeleteDocument(doc.id)} title="Delete" className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button></div></div>))) : (<div className="text-center py-12 text-slate-500 italic border border-slate-700 border-dashed rounded-xl">No files.</div>)}</div></div>
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
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Quote Name</label>
                        <input type="text" placeholder="..." value={quoteProjectName || editingClient.needs?.projectName || ''} onChange={(e) => setQuoteProjectName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-lg text-white focus:ring-2 focus:ring-amber-500 outline-none" />
                      </div>
                   </div>

                   {/* Suggestions Section */}
                   <div className="space-y-6">
                      {/* Inverter Suggestion */}
                      {editingClient.needs?.inverterKw && suggestedInverters.length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Zap size={16} className="text-amber-500" />Inverter Suggestion</h4>
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
                                      netPrice: inv.sellPrice
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

                      {/* Panels Suggestion */}
                      {editingClient.needs?.panelKw && inventory.filter(i => i.category === Category.PANELS).length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Package size={16} className="text-amber-500" />Solar Panels Suggestion</h4>
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
                                        netPrice: panel.sellPrice
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

                      {/* Battery Suggestion */}
                      {editingClient.needs?.inverterKw && suggestedBatteries.length > 0 && (
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Package size={16} className="text-amber-500" />Battery Suggestion</h4>
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
                                      netPrice: bat.sellPrice
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
                   </div>

                   {/* Quote Items Table */}
                   <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
                      <div className="overflow-visible p-4 flex-1">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="text-xs text-slate-500 border-b border-slate-700 uppercase">
                              <th className="py-2 px-1 text-center w-10">#</th>
                              <th className="py-2 px-1">Description</th>
                              <th className="py-2 px-1 w-24 text-center">Qty</th>
                              <th className="py-2 px-1 w-32 text-right">Total</th>
                              <th className="py-2 px-1 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {quoteItems.length === 0 ? (
                              <tr><td colSpan={5} className="text-center py-8 text-slate-500 italic">No items.</td></tr>
                            ) : (
                              quoteItems.map((item, idx) => (
                                <tr key={item.id} className="border-b border-slate-800">
                                  <td className="py-3 text-center text-slate-500 text-sm align-top">{idx + 1}</td>
                                  <td className="py-3 align-top"><textarea value={item.description} onChange={(e) => updateQuoteLine(item.id, 'description', e.target.value)} rows={1} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white" /></td>
                                  <td className="py-3 align-top"><input type="number" value={item.quantity} onChange={(e) => updateQuoteLine(item.id, 'quantity', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded px-1 py-1 text-center text-sm text-white" /></td>
                                  <td className="py-3 align-top text-right text-sm font-bold text-emerald-400">{(item.quantity * item.netPrice).toLocaleString('ro-RO', {style:'currency', currency:'RON'})}</td>
                                  <td className="py-3 align-top text-center"><button onClick={() => removeQuoteLine(item.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14}/></button></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 bg-slate-800 border-t border-slate-700">
                        <button onClick={handleAddQuoteLine} className="w-full py-2 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-amber-500 font-bold flex justify-center items-center gap-2"><Plus size={18} /> Add Line</button>
                      </div>
                      <div className="bg-slate-900 p-6 border-t border-slate-700 flex justify-end">
                        <div className="w-64 space-y-2">
                          <div className="flex justify-between text-lg font-bold border-t border-slate-700 pt-2 mt-2">
                            <span className="text-amber-500">Total Gross:</span>
                            <span className="text-white">{quoteTotals.totalGross.toLocaleString('ro-RO', {style: 'currency', currency: 'RON'})}</span>
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
      </div>
    );
  }

  // List View (Default)
  return (
    <div className="h-full flex flex-col bg-slate-900 p-8 overflow-hidden">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-white mb-2">Client Registry</h1><p className="text-slate-400">Manage your customer base</p></div>
        {currentUser.role !== 'INSTALLER' && <button onClick={handleOpenModal} className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20"><Plus size={20} /> New Client</button>}
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
                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setSelectedClient(client)} className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10">Open</button>{currentUser.role === 'SUPER_ADMIN' && <button onClick={() => onDeleteClient(client.id)} className="bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-500 p-2 rounded-lg border border-slate-700"><Trash2 size={20} /></button>}</div>
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
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
};
