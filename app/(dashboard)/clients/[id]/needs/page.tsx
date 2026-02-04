'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, Zap, Package, FolderOpen, Save, Briefcase, CheckCircle, 
  AlertCircle, X, ImageIcon, Upload, Camera, Trash2, ChevronLeft, ChevronRight, MapPin, RefreshCcw
} from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Category, ClientSiteImage, ArchivedProject } from '@/types';

export default function ClientNeedsPage() {
  const { client, updateClient } = useClient();
  const { inventory } = useData();
  const { currentUser } = useAuth();
  
  const [tempDescription, setTempDescription] = useState('');
  const [selectedInverterId, setSelectedInverterId] = useState<string | null>(null);
  const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [showPanelAlternatives, setShowPanelAlternatives] = useState(false);
  const [rowCount, setRowCount] = useState<number>(1);
  const [rowDistribution, setRowDistribution] = useState<{[key: number]: number}>({1: 0});
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProject[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showBatteryAlternatives, setShowBatteryAlternatives] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (client) {
      setTempDescription(client.needs?.description || '');
      setArchivedProjects(client.archivedProjects || []);
      setSelectedInverterId(client.needs?.selectedInverterId || null);
      setSelectedBatteryId(client.needs?.selectedBatteryId || null);
      setSelectedPanelId(client.needs?.panelStockItemId || null);
    }
  }, [client]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Keyboard navigation for image preview
  useEffect(() => {
    if (previewImageIndex === null || !client?.needs?.siteImages) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && previewImageIndex > 0) {
        setPreviewImageIndex(previewImageIndex - 1);
      } else if (e.key === 'ArrowRight' && previewImageIndex < client.needs.siteImages.length - 1) {
        setPreviewImageIndex(previewImageIndex + 1);
      } else if (e.key === 'Escape') {
        setPreviewImageIndex(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [previewImageIndex, client?.needs?.siteImages]);

  if (!client) return null;

  const handleNeedsChange = async (field: string, value: any) => {
    await updateClient({ needs: { ...client.needs, [field]: value } });
  };

  const saveDescription = async () => {
    if (tempDescription === client.needs?.description) return;
    await updateClient({
      needs: {
        ...client.needs,
        description: tempDescription,
        descriptionUpdatedBy: currentUser?.nickname || 'Unknown',
        descriptionUpdatedAt: new Date()
      }
    });
  };

  const suggestedInverters = useMemo(() => {
    if (!client?.needs?.inverterKw) return [];
    const connectionType = client.needs.connectionType;
    const targetKw = client.needs.inverterKw;
    const tolerance = 2;
    
    return inventory.filter(item => {
      if (item.category !== Category.INVERTERS) return false;
      if (connectionType && item.inverterConnectionType && item.inverterConnectionType !== connectionType) return false;
      if (item.inverterPowerKw) {
        return Math.abs(item.inverterPowerKw - targetKw) <= tolerance && (item.quantity || 0) > 0;
      }
      return false;
    });
  }, [client?.needs?.inverterKw, client?.needs?.connectionType, inventory]);

  const suggestedBatteries = useMemo(() => {
    if (!client?.needs?.selectedInverterId) return [];
    const selectedInverter = inventory.find(i => i.id === client.needs.selectedInverterId);
    if (!selectedInverter?.inverterStorageType) return [];

    return inventory.filter(item => {
      if (item.category !== Category.BATTERIES) return false;
      if (item.batteryType === selectedInverter.inverterStorageType && (item.quantity || 0) > 0) return true;
      return false;
    });
  }, [client?.needs?.selectedInverterId, inventory]);

  const suggestedPanels = useMemo(() => {
    if (!client?.needs?.panelKw || client.needs.panelKw <= 0) return [];
    const targetWatts = client.needs.panelKw * 1000;
    
    return inventory
      .filter(item => item.category === Category.PANELS && item.powerW && item.powerW > 0)
      .map(panel => {
        const piecesNeeded = Math.ceil(targetWatts / panel.powerW!);
        const actualPower = (piecesNeeded * panel.powerW!) / 1000;
        const stockQuantity = panel.quantity || 0;
        const isInStock = stockQuantity >= piecesNeeded;
        const isOutOfStock = stockQuantity === 0;
        
        return { ...panel, piecesNeeded, actualPower, isInStock, isOutOfStock, stockQuantity };
      })
      .filter(p => p.stockQuantity > 0) // Show only items in stock
      .sort((a, b) => {
        // Sort by stock availability first, then by power match
        if (a.isInStock && !b.isInStock) return -1;
        if (!a.isInStock && b.isInStock) return 1;
        return Math.abs(a.actualPower - client.needs!.panelKw!) - Math.abs(b.actualPower - client.needs!.panelKw!);
      });
  }, [client?.needs?.panelKw, inventory]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const currentImages = client?.needs?.siteImages || [];
      const newImages: ClientSiteImage[] = [];
      let processed = 0;
      
      Array.from(e.target.files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = async () => {
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
            await updateClient({ needs: { ...client.needs, siteImages: updatedImages } });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (confirm('Are you sure you want to delete this image?')) {
      const currentImages = client?.needs?.siteImages || [];
      const updatedImages = currentImages.filter(img => img.id !== imageId);
      await updateClient({ needs: { ...client.needs, siteImages: updatedImages } });
    }
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
      } catch { alert("Could not access camera."); setIsCameraOpen(false); }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const cfDocs = (client.documents || []).filter(doc => doc.type === 'CF');
  const facturaDocs = (client.documents || []).filter(doc => doc.type === 'Fact');
  const selectedCfDoc = cfDocs.find(doc => doc.id === client.needs?.selectedCfDocId);
  const selectedFacturaDoc = facturaDocs.find(doc => doc.id === client.needs?.selectedFacturaDocId);

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        {/* Project Archive Section */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <FolderOpen size={16} className="text-amber-500" />Project Archive
          </h3>
          <button 
            onClick={async () => {
              if (!client.needs?.projectName?.trim()) {
                alert('Please enter a project name before archiving.');
                return;
              }
              const projectNameToArchive = client.needs.projectName;
              const existingProjectIndex = archivedProjects.findIndex(p => p.projectName === projectNameToArchive);
              const archivedProject = {
                id: existingProjectIndex !== -1 ? archivedProjects[existingProjectIndex].id : Date.now().toString(),
                projectName: projectNameToArchive,
                archivedAt: new Date(),
                data: JSON.parse(JSON.stringify(client.needs))
              };
              let updatedArchived;
              if (existingProjectIndex !== -1) {
                updatedArchived = [...archivedProjects];
                updatedArchived[existingProjectIndex] = archivedProject;
              } else {
                updatedArchived = [archivedProject, ...archivedProjects];
              }
              setArchivedProjects(updatedArchived);
              
              const clearedNeeds = { 
                projectName: '',
                description: '',
                siteCountry: '',
                siteCounty: '',
                siteCity: '',
                siteStreet: '',
                siteStreetNumber: '',
                sitePostalCode: '',
                selectedCfDocId: '',
                selectedFacturaDocId: '',
                connectionType: undefined,
                roofType: undefined, 
                roofTypeOther: undefined,
                inverterKw: undefined,
                panelKw: 0,
                panelCount: 0, 
                panelStockItemId: undefined,
                storage: '',
                technicalNotes: '',
                siteImages: [] 
              };
              
              await updateClient({ needs: clearedNeeds, archivedProjects: updatedArchived });
              setTempDescription('');
              setSelectedInverterId(null);
              setSelectedBatteryId(null);
              setSelectedPanelId(null);
            }}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors mb-4"
          >
            <Save size={18} /> Save Project
          </button>
          {archivedProjects.length > 0 && (
            <div className="space-y-2 border-t border-slate-700 pt-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-3">Saved Projects</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {archivedProjects.map(project => {
                  const isCurrent = client.needs?.projectName === project.projectName;
                  return (
                    <div 
                      key={project.id}
                      className={`p-3 rounded border transition-all cursor-pointer group ${
                        isCurrent
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-slate-900 border-slate-700 hover:border-amber-500/50'
                      }`}
                      onClick={() => {
                        if (isCurrent) {
                          const clearedNeeds = {
                            description: '',
                            projectName: '',
                            siteCountry: '',
                            siteCounty: '',
                            siteCity: '',
                            siteStreet: '',
                            siteStreetNumber: '',
                            sitePostalCode: '',
                            selectedCfDocId: '',
                            selectedFacturaDocId: '',
                            connectionType: undefined,
                            roofType: undefined,
                            inverterKw: undefined,
                            selectedInverterId: undefined,
                            batteryKwh: undefined,
                            selectedBatteryId: undefined,
                            panelStockItemId: undefined,
                            panelKw: undefined,
                            panelCount: undefined,
                            siteImages: []
                          };
                          updateClient({ needs: clearedNeeds });
                          setTempDescription('');
                          setSelectedInverterId(null);
                          setSelectedBatteryId(null);
                          setSelectedPanelId(null);
                          return;
                        }
                        
                        const loadedData = JSON.parse(JSON.stringify(project.data));
                        updateClient({ needs: loadedData });
                        setTempDescription(loadedData.description || '');
                        setSelectedInverterId(loadedData.selectedInverterId || null);
                        setSelectedBatteryId(loadedData.selectedBatteryId || null);
                        setSelectedPanelId(loadedData.panelStockItemId || null);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {isCurrent && (
                            <span className="text-emerald-400 font-bold text-xs flex items-center gap-1 mb-1">
                              <CheckCircle size={14} /> LOADED
                            </span>
                          )}
                          <p className={`font-bold text-sm truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                            {project.projectName}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Saved: {new Date(project.archivedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Delete saved project "${project.projectName}"?`)) {
                              const updated = archivedProjects.filter(p => p.id !== project.id);
                              setArchivedProjects(updated);
                              await updateClient({ archivedProjects: updated });
                            }
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

        {/* Project Name */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <Briefcase size={16} className="text-amber-500" />Project Name
          </h3>
          <input 
            type="text" 
            value={client.needs?.projectName || ''} 
            onChange={(e) => handleNeedsChange('projectName', e.target.value)} 
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white outline-none focus:ring-1 focus:ring-amber-500" 
            placeholder="Enter project name..." 
          />
        </section>

        {/* Site Location */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-amber-500" />Site Location
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Street</label>
              <input
                type="text"
                value={client.needs?.siteStreet || ''}
                onChange={(e) => handleNeedsChange('siteStreet', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Street Number</label>
              <input
                type="text"
                value={client.needs?.siteStreetNumber || ''}
                onChange={(e) => handleNeedsChange('siteStreetNumber', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
              <input
                type="text"
                value={client.needs?.siteCity || ''}
                onChange={(e) => handleNeedsChange('siteCity', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">County</label>
              <input
                type="text"
                value={client.needs?.siteCounty || ''}
                onChange={(e) => handleNeedsChange('siteCounty', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Postal Code</label>
              <input
                type="text"
                value={client.needs?.sitePostalCode || ''}
                onChange={(e) => handleNeedsChange('sitePostalCode', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Country</label>
              <input
                type="text"
                value={client.needs?.siteCountry || 'Romania'}
                onChange={(e) => handleNeedsChange('siteCountry', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        </section>

        {/* Document Data Selection */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-amber-500" />Document Data Selection
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CF Document</label>
              <select
                value={client.needs?.selectedCfDocId || ''}
                onChange={(e) => handleNeedsChange('selectedCfDocId', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- None --</option>
                {cfDocs.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
              {selectedCfDoc && (
                <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-white">{selectedCfDoc.name}</div>
                  <div><span className="text-slate-500">Address:</span> {selectedCfDoc.docAddress || '—'}</div>
                  <div><span className="text-slate-500">Nr CF:</span> {selectedCfDoc.cfNumber || '—'}</div>
                  <div><span className="text-slate-500">Nr CAD:</span> {selectedCfDoc.cadNumber || '—'}</div>
                  <div><span className="text-slate-500">Description:</span> {selectedCfDoc.description || '—'}</div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Factura Document</label>
              <select
                value={client.needs?.selectedFacturaDocId || ''}
                onChange={(e) => handleNeedsChange('selectedFacturaDocId', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- None --</option>
                {facturaDocs.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
              {selectedFacturaDoc && (
                <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-white">{selectedFacturaDoc.name}</div>
                  <div><span className="text-slate-500">Address:</span> {selectedFacturaDoc.docAddress || '—'}</div>
                  <div><span className="text-slate-500">POD:</span> {selectedFacturaDoc.podNumber || '—'}</div>
                  <div><span className="text-slate-500">Description:</span> {selectedFacturaDoc.description || '—'}</div>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            These selections define which CF/Factura data is used in document generation.
          </p>
        </section>

        {/* Scope of Work */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <FileText size={16} className="text-amber-500" />Scope of Work
          </h3>
          <div className="relative">
            <textarea 
              value={tempDescription} 
              onChange={(e) => setTempDescription(e.target.value)} 
              onBlur={saveDescription} 
              rows={4} 
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-white outline-none resize-none focus:ring-1 focus:ring-amber-500" 
              placeholder="Enter detailed client requirements here..." 
            />
            {client.needs?.descriptionUpdatedAt && (
              <div className="absolute bottom-2 right-4 text-[10px] text-slate-500">
                Updated by <span className="font-bold text-slate-400">{client.needs.descriptionUpdatedBy}</span> on {new Date(client.needs.descriptionUpdatedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </section>

        {/* Connection Type & Roof Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <label className="text-sm font-bold text-slate-300 mb-3 block">Bransament</label>
            <div className="flex gap-4">
              {['Monofazat', 'Trifazat'].map(type => (
                <label 
                  key={type} 
                  className={`flex-1 cursor-pointer border rounded-lg p-4 flex items-center justify-center transition-all ${
                    client.needs?.connectionType === type 
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400' 
                      : 'bg-slate-900 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span className="font-medium">{type}</span>
                  <input 
                    type="radio" 
                    name="connectionType" 
                    checked={client.needs?.connectionType === type} 
                    onChange={() => handleNeedsChange('connectionType', type)} 
                    className="hidden" 
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <label className="text-sm font-bold text-slate-300 mb-3 block">Tip Acoperis</label>
            <select 
              value={client.needs?.roofType || ''} 
              onChange={(e) => handleNeedsChange('roofType', e.target.value)} 
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500 appearance-none"
            >
              <option value="">-- Select --</option>
              {['Tigla ceramica', 'Tabla', 'Tigla metalica', 'Tabla ondulata', 'Tabla cutata', 'Panou sandwich', 'Other'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {client.needs?.roofType === 'Other' && (
              <input 
                type="text" 
                value={client.needs?.roofTypeOther || ''} 
                onChange={(e) => handleNeedsChange('roofTypeOther', e.target.value)} 
                placeholder="Please specify..." 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500 mt-2" 
              />
            )}
          </div>
        </div>

        {/* Inverter Section */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />Inverter Requested
          </h3>
          {client.needs?.connectionType && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-300 font-bold">
                ℹ️ The Bransament type is <span className="text-blue-200">{client.needs.connectionType}</span>. 
                You should select a <span className="text-blue-200">{client.needs.connectionType}</span> inverter.
              </p>
            </div>
          )}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Power (kW)</label>
              <input 
                type="number" 
                value={client.needs?.inverterKw || ''} 
                onChange={(e) => handleNeedsChange('inverterKw', Number(e.target.value))} 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                placeholder="e.g. 5" 
              />
            </div>
          </div>

          {client.needs?.inverterKw && (
            <div className="space-y-4">
              {suggestedInverters.length > 0 && !selectedInverterId && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                    <CheckCircle size={16} /> Suitable Inverters Found
                  </div>
                  {suggestedInverters.map(inv => (
                    <div 
                      key={inv.id}
                      className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all"
                      onClick={async () => {
                        setSelectedInverterId(inv.id);
                        await updateClient({ needs: { ...client.needs, selectedInverterId: inv.id } });
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-white font-bold">{inv.name}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType}
                          </p>
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

              {suggestedInverters.length === 0 && !selectedInverterId && (
                <div className="space-y-3">
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-lg mb-2">
                      <AlertCircle size={20} /> No suitable inverter!
                    </div>
                    <p className="text-sm text-red-300 text-center">
                      No inverters match the specifications.
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowAlternatives(true)}
                    className="w-full px-4 py-3 bg-slate-900 border border-amber-500/50 hover:border-amber-500 text-amber-400 hover:text-amber-300 font-bold rounded-lg transition-colors"
                  >
                    Browse All Available Inverters
                  </button>
                </div>
              )}

              {suggestedInverters.length > 0 && !selectedInverterId && (
                <button 
                  type="button"
                  onClick={() => setShowAlternatives(true)}
                  className="w-full px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors mt-2"
                >
                  Show All {suggestedInverters.length} Inverters
                </button>
              )}

              {selectedInverterId && (() => {
                const selected = inventory.find(i => i.id === selectedInverterId && i.category === Category.INVERTERS);
                if (!selected) return null;
                
                return (
                  <div className="p-4 rounded-lg border-2 bg-emerald-500/5 border-emerald-500/50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                        <CheckCircle size={16} /> SELECTED INVERTER
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-white font-bold">{selected.name}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {selected.inverterPowerKw}kW • {selected.inverterConnectionType} • {selected.inverterStorageType}
                        </p>
                        <p className="text-sm text-emerald-400 font-bold mt-2">{selected.sellPrice} RON</p>
                      </div>
                      <button 
                        type="button"
                        onClick={async () => {
                          setSelectedInverterId(null);
                          await updateClient({ needs: { ...client.needs, selectedInverterId: undefined } });
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </section>

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
                {inventory
                  .filter(i => i.category === Category.INVERTERS && (i.quantity || 0) > 0)
                  .map((inv) => (
                    <div 
                      key={inv.id}
                      className={`flex items-center justify-between bg-slate-900 p-4 rounded-lg border cursor-pointer transition-all ${
                        inv.id === selectedInverterId
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                      onClick={async () => {
                        setSelectedInverterId(inv.id);
                        await updateClient({ 
                          needs: { 
                            ...client.needs, 
                            selectedInverterId: inv.id,
                            selectedBatteryId: undefined 
                          } 
                        });
                        setShowAlternatives(false);
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold">{inv.name}</p>
                          {inv.id === selectedInverterId && (
                            <span className="text-xs bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-bold">SELECTED</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {inv.inverterPowerKw}kW • {inv.inverterConnectionType} • {inv.inverterStorageType} • {inv.quantity} in stock
                        </p>
                        <p className="text-sm text-emerald-400 font-bold mt-1">{inv.sellPrice} RON</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Battery Section */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Package size={16} className="text-amber-500" />Battery
          </h3>
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Capacity (kWh)</label>
            <input 
              type="number" 
              value={client.needs?.batteryKwh || ''} 
              onChange={(e) => handleNeedsChange('batteryKwh', Number(e.target.value))} 
              className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
              placeholder="e.g. 10" 
            />
          </div>

          {!!(client.needs?.batteryKwh && client.needs.batteryKwh > 0 && selectedInverterId) && (
            <div className="space-y-4">
              {suggestedBatteries.length > 0 && !selectedBatteryId && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                    <CheckCircle size={16} /> Suitable Batteries Found
                  </div>
                  {suggestedBatteries.map(bat => (
                    <div 
                      key={bat.id}
                      className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-emerald-500/50 cursor-pointer transition-all"
                      onClick={async () => {
                        setSelectedBatteryId(bat.id);
                        await updateClient({ needs: { ...client.needs, selectedBatteryId: bat.id } });
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
                  {suggestedBatteries.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setShowBatteryAlternatives(true)}
                      className="w-full px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors"
                    >
                      Show All {suggestedBatteries.length} Batteries
                    </button>
                  )}
                </div>
              )}

              {selectedBatteryId && (() => {
                const selected = inventory.find(i => i.id === selectedBatteryId && i.category === Category.BATTERIES);
                if (!selected) return null;
                
                return (
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
                        onClick={async () => {
                          setSelectedBatteryId(null);
                          await updateClient({ needs: { ...client.needs, selectedBatteryId: undefined } });
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </section>

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
                {inventory
                  .filter(i => i.category === Category.BATTERIES && (i.quantity || 0) > 0)
                  .map((bat) => (
                    <div 
                      key={bat.id}
                      className={`flex items-center justify-between bg-slate-900 p-4 rounded-lg border cursor-pointer transition-all ${
                        bat.id === selectedBatteryId
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                      onClick={async () => {
                        setSelectedBatteryId(bat.id);
                        await updateClient({ 
                          needs: { 
                            ...client.needs, 
                            selectedBatteryId: bat.id
                          } 
                        });
                        setShowBatteryAlternatives(false);
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold">{bat.name}</p>
                          {bat.id === selectedBatteryId && (
                            <span className="text-xs bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-bold">SELECTED</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {bat.batteryPowerKwh}kWh • {bat.batteryType} • {bat.quantity} in stock
                        </p>
                        <p className="text-sm text-emerald-400 font-bold mt-1">{bat.sellPrice} RON</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Panels Section */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Package size={16} className="text-amber-500" />Panels Calculator
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Total Power Required (kW)</label>
              <input 
                type="number" 
                step="0.1"
                value={client.needs?.panelKw || ''} 
                onChange={(e) => handleNeedsChange('panelKw', Number(e.target.value))} 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                placeholder="e.g. 6" 
              />
            </div>

            {/* Panel Suggestions */}
            {suggestedPanels.length > 0 && !selectedPanelId && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                  <CheckCircle size={16} /> Panel Suggestions ({suggestedPanels.length} available)
                </div>
                {suggestedPanels.slice(0, 3).map((panel: any) => (
                  <div 
                    key={panel.id}
                    className={`bg-slate-900 p-4 rounded-lg border cursor-pointer transition-all ${
                      panel.isInStock 
                        ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                        : 'border-yellow-500/30 hover:border-yellow-500/50'
                    }`}
                    onClick={async () => {
                      setSelectedPanelId(panel.id);
                      await updateClient({ 
                        needs: { 
                          ...client.needs, 
                          panelStockItemId: panel.id,
                          panelCount: panel.piecesNeeded
                        } 
                      });
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold">{panel.name}</p>
                          {panel.isInStock ? (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">IN STOCK</span>
                          ) : (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-bold">LOW STOCK</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {panel.powerW}W • {panel.piecesNeeded} pcs = {panel.actualPower.toFixed(2)}kW
                        </p>
                        {!panel.isInStock && (
                          <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={10} /> Only {panel.stockQuantity} available, need {panel.piecesNeeded}
                          </p>
                        )}
                        <p className="text-sm text-emerald-400 font-bold mt-2">{panel.sellPrice} RON/piece</p>
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
                {suggestedPanels.length > 3 && (
                  <button 
                    type="button"
                    onClick={() => setShowPanelAlternatives(true)}
                    className="w-full px-4 py-2 border border-slate-600 hover:border-amber-500 text-slate-400 hover:text-amber-400 font-bold rounded-lg text-sm transition-colors"
                  >
                    Show All {suggestedPanels.length} Panels
                  </button>
                )}
              </div>
            )}

            {/* Selected Panel */}
            {selectedPanelId && (() => {
              const selected = inventory.find(i => i.id === selectedPanelId && i.category === Category.PANELS);
              if (!selected) return null;
              
              const targetWatts = client.needs?.panelKw ? client.needs.panelKw * 1000 : 0;
              const piecesNeeded = selected.powerW ? Math.ceil(targetWatts / selected.powerW) : 0;
              const actualPower = selected.powerW ? (piecesNeeded * selected.powerW) / 1000 : 0;
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
                          {piecesNeeded > 0 && ` • ${piecesNeeded} pieces = ${actualPower.toFixed(2)}kW`}
                        </p>
                        <p className="text-sm text-emerald-400 font-bold mt-2">{selected.sellPrice} RON/piece</p>
                      </div>
                      <button 
                        type="button"
                        onClick={async () => {
                          setSelectedPanelId(null);
                          await updateClient({ needs: { ...client.needs, panelStockItemId: undefined, panelCount: undefined } });
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    
                    {isOutOfStock && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-red-300">
                          <p className="font-bold">Out of stock!</p>
                        </div>
                      </div>
                    )}
                    
                    {isLowStock && (
                      <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-start gap-2">
                        <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-300 font-bold">
                          Low stock! Need {piecesNeeded} but only {stockQuantity} available
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {client.needs?.panelKw && client.needs.panelKw > 0 && (
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

            {/* Manual Panel Count Override */}
            {selectedPanelId && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Manual Quantity Override</label>
                <input 
                  type="number"
                  min="0"
                  value={client.needs?.panelCount || ''} 
                  onChange={(e) => handleNeedsChange('panelCount', Number(e.target.value))} 
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-1 focus:ring-amber-500" 
                  placeholder="Override calculated quantity" 
                />
              </div>
            )}

            {/* Row Configuration & Mounting Structure Calculator */}
            {client.needs?.panelCount && client.needs.panelCount > 0 && (
              <div className="border-t border-slate-700 pt-6 space-y-4">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Package size={14} /> Structure Components Calculator
                </h4>
                
                {/* Row Count Input */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Number of Rows</label>
                  <input 
                    type="number"
                    min="1"
                    value={rowCount}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      if (count >= 1) {
                        setRowCount(count);
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

                {/* Row Distribution */}
                {rowCount > 1 && (
                  <div className="space-y-2 bg-slate-900 p-4 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 font-bold mb-2">Distribute {client.needs.panelCount} panels across {rowCount} rows:</p>
                    {Array.from({length: rowCount}, (_, i) => i + 1).map(rowNum => (
                      <div key={rowNum} className="flex items-center gap-3">
                        <label className="text-sm text-slate-300 w-20">Row {rowNum}:</label>
                        <input 
                          type="number"
                          min="0"
                          value={rowDistribution[rowNum] || ''}
                          onChange={(e) => setRowDistribution({...rowDistribution, [rowNum]: Number(e.target.value)})}
                          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-white outline-none focus:ring-1 focus:ring-amber-500 text-sm" 
                          placeholder="Panels in this row" 
                        />
                      </div>
                    ))}
                    {(() => {
                      const totalDistributed = Object.values(rowDistribution).reduce((sum, val) => sum + val, 0);
                      const diff = client.needs!.panelCount! - totalDistributed;
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
                  const totalPanels = client.needs!.panelCount!;
                  const roofType = client.needs?.roofType;
                  
                  let rowConfigs: number[] = [];
                  if (rowCount === 1) {
                    rowConfigs = [totalPanels];
                  } else {
                    const totalDistributed = Object.values(rowDistribution).reduce((sum, val) => sum + val, 0);
                    if (totalDistributed === totalPanels) {
                      rowConfigs = Array.from({length: rowCount}, (_, i) => rowDistribution[i + 1] || 0);
                    }
                  }

                  if (rowConfigs.length === 0 || rowConfigs.some(c => c === 0)) {
                    return (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                        <p className="text-xs text-yellow-300">
                          ⚠ Complete row distribution to calculate structure components
                        </p>
                      </div>
                    );
                  }

                  const numRows = rowConfigs.length;
                  const endClamps = numRows * 4; // CEND: 4 per row
                  const midClamps = (totalPanels - numRows) * 2; // CMID: (N - R) × 2 (1 per gap per rail)
                  
                  const selectedPanel = client.needs?.panelStockItemId 
                    ? inventory.find(i => i.id === client.needs.panelStockItemId) 
                    : null;
                  // Look for rail by checking: 1) isRail flag with railLengthM, 2) CRAIL SKU
                  const selectedRail = 
                    inventory.find(i => i.category === Category.MOUNTING && i.isRail && (i.railLengthM || 0) > 0) ||
                    inventory.find(i => i.category === Category.MOUNTING && i.sku?.toUpperCase() === 'CRAIL') ||
                    null;
                  
                  // Get rail length: use explicit railLengthM if set, otherwise try to extract from name pattern (e.g., "5,4 M" or "5.4m")
                  let railLengthM = selectedRail?.railLengthM || 0;
                  if (!railLengthM && selectedRail?.name) {
                    // Try to extract length from name like "5,4 M" or "5.4m"
                    const match = selectedRail.name.match(/(\d+[.,]\d+)\s*[Mm]/);
                    if (match) {
                      railLengthM = parseFloat(match[1].replace(',', '.'));
                    }
                  }
                  railLengthM = railLengthM || 6; // Final fallback to 6m
                  // Convert panel width from MM to meters (default 1134mm if not specified)
                  const panelWidthMm = selectedPanel?.panelWidth || 1134;
                  const panelWidth = panelWidthMm / 1000; // Convert to meters
                  const maxPanelsInRow = Math.max(...rowConfigs);
                  const railLengthPerRow = maxPanelsInRow * panelWidth;
                  const railLengthWithWaste = railLengthPerRow * 1.1;
                  const sectionsPerRail = Math.ceil(railLengthWithWaste / railLengthM);
                  const railsOf6m = sectionsPerRail * numRows * 2; // 2 rails per row (top and bottom)
                  const combinersPerRail = sectionsPerRail > 1 ? sectionsPerRail - 1 : 0;
                  const totalCombiners = combinersPerRail * numRows * 2;
                  const totalRailLength = railsOf6m * railLengthM; // Total rail length in meters
                  
                  // Calculate hooks based on roof type
                  let roofHooks = 0;
                  let roofScrews = 0;
                  let hookType = '';
                  
                  if (roofType === 'Tigla ceramica') {
                    // CHOOK-Tigla: 1 hook every 40cm (0.4m)
                    roofHooks = Math.ceil(totalRailLength / 0.4);
                    roofScrews = roofHooks * 2; // CHOOKSurub: 2 per hook
                    hookType = 'CHOOK-Tigla';
                  } else if (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata') {
                    // CHOOK-Tabla: 1 hook every 40cm (0.4m), no screws
                    roofHooks = Math.ceil(totalRailLength / 0.4);
                    hookType = 'CHOOK-Tabla';
                  }
                  
                  // Calculate minirails (CMINI)
                  const miniRails = totalPanels * 2 + (numRows * 2);
                  const miniRailScrews = miniRails * 4; // CMINISurub: 4 per minirail
                  
                  // Helper function to find inventory item by SKU
                  const findMountingItem = (sku: string) => {
                    const skuLower = sku.toLowerCase();
                    // Only exact SKU match to avoid matching wrong items
                    const item = inventory.find(i => i.category === Category.MOUNTING && i.sku?.toLowerCase() === skuLower);
                    return item;
                  };
                  
                  // Calculate reference prices for rail system
                  const railItem = selectedRail;
                  const combinerItem = findMountingItem('CCOMB');
                  const hookTablaItem = findMountingItem('CHOOK-Tabla');
                  const midClampItem = findMountingItem('CMID');
                  const endClampItem = findMountingItem('CEND');
                  
                  const railSystemPrice = 
                    (railItem?.sellPrice || 0) * railsOf6m +
                    (combinerItem?.sellPrice || 0) * totalCombiners +
                    (hookTablaItem?.sellPrice || 0) * roofHooks +
                    (midClampItem?.sellPrice || 0) * midClamps +
                    (endClampItem?.sellPrice || 0) * endClamps;
                  
                  // Calculate reference prices for minirail system
                  const miniRailItem = findMountingItem('CMINI');
                  const miniRailScrewItem = findMountingItem('CMINISurub');
                  
                  const miniRailSystemPrice = 
                    (miniRailItem?.sellPrice || 0) * miniRails +
                    (miniRailScrewItem?.sellPrice || 0) * miniRailScrews +
                    (midClampItem?.sellPrice || 0) * midClamps +
                    (endClampItem?.sellPrice || 0) * endClamps;
                  
                  // Determine if Tigla ceramica (1 option) or other roof types (2 options)
                  const isTiglaCeramica = roofType === 'Tigla ceramica';
                  const showOptions = !isTiglaCeramica && (roofType === 'Tabla' || roofType === 'Tabla ondulata' || roofType === 'Tabla cutata');

                  return (
                    <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg space-y-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-blue-300 flex items-center gap-2">
                          <CheckCircle size={14} /> Structure Components Required
                        </p>
                        <button
                          onClick={() => {
                            // Force a visual refresh indication
                            const el = document.getElementById('structure-components');
                            if (el) {
                              el.style.opacity = '0.5';
                              setTimeout(() => { el.style.opacity = '1'; }, 150);
                            }
                          }}
                          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded transition-colors"
                          title="Refresh calculations"
                        >
                          <RefreshCcw size={14} />
                        </button>
                      </div>
                      <div id="structure-components" className="transition-opacity duration-150">
                      
                      {/* Tigla ceramica - Single Option (Auto-selected) */}
                      {isTiglaCeramica && (
                        <div className="space-y-3">
                          <div 
                            onClick={() => handleNeedsChange('selectedMountingSystem', 'rail')}
                            className="bg-slate-900/50 p-3 rounded-lg border border-amber-500/30 cursor-pointer hover:bg-slate-900/70 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="radio" 
                                  checked={client.needs?.selectedMountingSystem === 'rail' || !client.needs?.selectedMountingSystem}
                                  onChange={() => handleNeedsChange('selectedMountingSystem', 'rail')}
                                  className="cursor-pointer"
                                />
                                <p className="text-xs font-bold text-amber-400">Rail System with Tigla Hooks</p>
                              </div>
                              {railSystemPrice > 0 && (
                                <p className="text-xs font-bold text-emerald-400">≈ {railSystemPrice.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}</p>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">Rails ({railLengthM}m)</p>
                                <p className="text-lg font-bold text-white">{railsOf6m} pcs</p>
                              </div>
                              {totalCombiners > 0 && (
                                <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                  <p className="text-[10px] text-slate-400">Rail Combiners</p>
                                  <p className="text-lg font-bold text-white">{totalCombiners} pcs</p>
                                </div>
                              )}
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CHOOK-Tigla</p>
                                <p className="text-lg font-bold text-white">{roofHooks} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CHOOKSurub</p>
                                <p className="text-lg font-bold text-white">{roofScrews} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CMID</p>
                                <p className="text-lg font-bold text-white">{midClamps} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CEND</p>
                                <p className="text-lg font-bold text-white">{endClamps} pcs</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Other Roof Types - Two Options */}
                      {showOptions && (
                        <div className="space-y-3">
                          {/* Option 1: Rail System */}
                          <div 
                            onClick={() => handleNeedsChange('selectedMountingSystem', 'rail')}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              client.needs?.selectedMountingSystem === 'rail'
                                ? 'bg-green-500/20 border-green-500/50'
                                : 'bg-slate-900/50 border-green-500/30 hover:bg-slate-900/70'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="radio" 
                                  checked={client.needs?.selectedMountingSystem === 'rail'}
                                  onChange={() => handleNeedsChange('selectedMountingSystem', 'rail')}
                                  className="cursor-pointer"
                                />
                                <p className="text-xs font-bold text-green-400">Option 1: Rail System</p>
                              </div>
                              {railSystemPrice > 0 && (
                                <p className="text-xs font-bold text-emerald-400">≈ {railSystemPrice.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}</p>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">Rails ({railLengthM}m)</p>
                                <p className="text-lg font-bold text-white">{railsOf6m} pcs</p>
                              </div>
                              {totalCombiners > 0 && (
                                <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                  <p className="text-[10px] text-slate-400">Rail Combiners</p>
                                  <p className="text-lg font-bold text-white">{totalCombiners} pcs</p>
                                </div>
                              )}
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CHOOK-Tabla</p>
                                <p className="text-lg font-bold text-white">{roofHooks} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CMID</p>
                                <p className="text-lg font-bold text-white">{midClamps} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CEND</p>
                                <p className="text-lg font-bold text-white">{endClamps} pcs</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Option 2: MiniRail System */}
                          <div 
                            onClick={() => handleNeedsChange('selectedMountingSystem', 'minirail')}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              client.needs?.selectedMountingSystem === 'minirail'
                                ? 'bg-purple-500/20 border-purple-500/50'
                                : 'bg-slate-900/50 border-purple-500/30 hover:bg-slate-900/70'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="radio" 
                                  checked={client.needs?.selectedMountingSystem === 'minirail'}
                                  onChange={() => handleNeedsChange('selectedMountingSystem', 'minirail')}
                                  className="cursor-pointer"
                                />
                                <p className="text-xs font-bold text-purple-400">Option 2: MiniRail System</p>
                              </div>
                              {miniRailSystemPrice > 0 && (
                                <p className="text-xs font-bold text-emerald-400">≈ {miniRailSystemPrice.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}</p>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CMINI</p>
                                <p className="text-lg font-bold text-white">{miniRails} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CMINISurub</p>
                                <p className="text-lg font-bold text-white">{miniRailScrews} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CMID</p>
                                <p className="text-lg font-bold text-white">{midClamps} pcs</p>
                              </div>
                              <div className="bg-slate-900 p-2 rounded border border-slate-700">
                                <p className="text-[10px] text-slate-400">CEND</p>
                                <p className="text-lg font-bold text-white">{endClamps} pcs</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-slate-400 mt-3 p-2 bg-slate-900 rounded">
                        <p>📐 Configuration: {numRows} row{numRows > 1 ? 's' : ''} • Max {maxPanelsInRow} panels/row • ~{railLengthPerRow.toFixed(2)}m rail length (sections of {railLengthM}m) • Total rail: {totalRailLength.toFixed(1)}m</p>
                      </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
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
                  {suggestedPanels.map((panel: any) => (
                    <div 
                      key={panel.id}
                      className={`flex items-center justify-between bg-slate-900 p-4 rounded-lg border cursor-pointer transition-all ${
                        panel.id === selectedPanelId
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                          : panel.isInStock
                          ? 'border-emerald-500/30 hover:border-emerald-500/50' 
                          : panel.isOutOfStock
                          ? 'border-red-500/30 hover:border-red-500/50'
                          : 'border-yellow-500/30 hover:border-yellow-500/50'
                      }`}
                      onClick={async () => {
                        setSelectedPanelId(panel.id);
                        await updateClient({ 
                          needs: { 
                            ...client.needs, 
                            panelStockItemId: panel.id,
                            panelCount: panel.piecesNeeded
                          } 
                        });
                        setShowPanelAlternatives(false);
                      }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-bold">{panel.name}</p>
                          {panel.id === selectedPanelId && (
                            <span className="text-xs bg-emerald-500 text-slate-900 px-2 py-0.5 rounded font-bold">SELECTED</span>
                          )}
                          {panel.isInStock && panel.id !== selectedPanelId && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">IN STOCK</span>
                          )}
                          {panel.isOutOfStock && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold">OUT OF STOCK</span>
                          )}
                          {!panel.isInStock && !panel.isOutOfStock && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-bold">LOW STOCK</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {panel.powerW}W • {panel.piecesNeeded} pcs = {panel.actualPower.toFixed(2)}kW
                        </p>
                        {!panel.isInStock && !panel.isOutOfStock && (
                          <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={10} /> Only {panel.stockQuantity} available, need {panel.piecesNeeded}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-xs font-bold ${
                          panel.isOutOfStock ? 'text-red-400' : !panel.isInStock ? 'text-yellow-400' : 'text-emerald-400'
                        }`}>{panel.stockQuantity} in stock</p>
                        <p className="text-sm font-bold text-emerald-400 mt-1">{panel.sellPrice} RON</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* On-site Pictures */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <ImageIcon size={16} className="text-amber-500" />On-site Pictures
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

          {(!client.needs?.siteImages || client.needs.siteImages.length === 0) ? (
            <div className="text-center py-12 text-slate-500 italic border border-slate-700 border-dashed rounded-xl">
              <ImageIcon size={40} className="mx-auto mb-3 text-slate-600" />
              <p>No pictures uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {client.needs.siteImages.map((img, idx) => (
                <div 
                  key={img.id} 
                  className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden hover:border-amber-500/50 transition-all"
                >
                  <div 
                    className="relative aspect-video group cursor-pointer" 
                    onClick={() => setPreviewImageIndex(idx)}
                  >
                    <img 
                      src={img.url} 
                      alt={img.label || "Site photo"}
                      className="w-full h-full object-cover" 
                    />
                    {img.category && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-slate-900 text-xs px-2 py-1 rounded font-bold shadow-lg">
                        {img.category}
                      </span>
                    )}
                    <button 
                      type="button"
                      onClick={(e) => { 
                        e.stopPropagation();
                        handleDeleteImage(img.id); 
                      }} 
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="p-4">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                    <input
                      type="text"
                      value={img.label || ''}
                      onChange={async (e) => {
                        const updatedImages = client.needs?.siteImages?.map(i => 
                          i.id === img.id ? { ...i, label: e.target.value } : i
                        ) || [];
                        await updateClient({ needs: { ...client.needs, siteImages: updatedImages } });
                      }}
                      placeholder="e.g., Main roof view..."
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Image Preview Modal */}
        {previewImageIndex !== null && client?.needs?.siteImages && client.needs.siteImages.length > 0 && (() => {
          const currentImage = client.needs.siteImages[previewImageIndex];
          const hasPrevious = previewImageIndex > 0;
          const hasNext = previewImageIndex < client.needs.siteImages.length - 1;
          
          const goToPrevious = () => {
            if (hasPrevious) setPreviewImageIndex(previewImageIndex - 1);
          };
          
          const goToNext = () => {
            if (hasNext) setPreviewImageIndex(previewImageIndex + 1);
          };
          
          return (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewImageIndex(null)}>
              {/* Modal Frame */}
              <div className="bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header with Title and Close Button */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-600 bg-slate-750">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {currentImage.category && (
                      <span className="bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-md shadow flex-shrink-0">
                        {currentImage.category}
                      </span>
                    )}
                    <span className="text-slate-300 text-sm font-medium bg-slate-700/50 px-3 py-1 rounded flex-shrink-0">
                      {previewImageIndex + 1} / {client.needs.siteImages.length}
                    </span>
                    <h3 className="text-white font-semibold truncate flex-1">
                      {currentImage.label || 'Photo'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setPreviewImageIndex(null)}
                    className="ml-4 flex-shrink-0 text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded"
                    aria-label="Close"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                {/* Image Content Area */}
                <div className="flex-1 flex items-center justify-center overflow-hidden relative px-6 py-4 bg-slate-900/30">
                  {/* Left Arrow */}
                  {hasPrevious && (
                    <button
                      onClick={goToPrevious}
                      className="absolute left-2 z-10 text-white hover:text-amber-400 hover:scale-110 transition-all bg-slate-800/90 hover:bg-slate-700 rounded-full p-2 shadow-lg"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={32} />
                    </button>
                  )}
                  
                  {/* Image */}
                  <img 
                    src={currentImage.url} 
                    alt={currentImage.label || "Site photo"}
                    className="max-w-full max-h-full object-contain"
                  />
                  
                  {/* Right Arrow */}
                  {hasNext && (
                    <button
                      onClick={goToNext}
                      className="absolute right-2 z-10 text-white hover:text-amber-400 hover:scale-110 transition-all bg-slate-800/90 hover:bg-slate-700 rounded-full p-2 shadow-lg"
                      aria-label="Next image"
                    >
                      <ChevronRight size={32} />
                    </button>
                  )}
                </div>
                
                {/* Footer with Details */}
                <div className="border-t border-slate-600 px-6 py-4 bg-slate-750 flex items-center justify-between text-sm">
                  <div className="flex-1">
                    {currentImage.timestamp && (
                      <p className="text-slate-400 flex items-center gap-2">
                        <span>📅</span>
                        {new Date(currentImage.timestamp).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-slate-500 text-xs text-right">
                    <div>Use ← → or click arrows to navigate</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full">
              <video ref={videoRef} autoPlay className="w-full rounded-lg mb-4"></video>
              <canvas ref={canvasRef} className="hidden"></canvas>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={stopCamera}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
