'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InventoryItem, Category } from '../types';
import { X, Save, Barcode, Camera, Upload, Loader2, CheckCircle, ListPlus, Zap } from 'lucide-react';
import { extractBarcodeFromImage } from '../services/geminiService';

interface InventoryFormProps {
  initialData?: InventoryItem | null;
  onSubmit: (item: Omit<InventoryItem, 'id'>) => void;
  onCancel: () => void;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id'>>({
    name: '',
    sku: '',
    barcode: '',
    category: Category.PANELS,
    quantity: 0,
    minThreshold: 0,
    buyPrice: 0,
    sellPrice: 0,
    location: '',
    specs: '',
    powerW: 0,
    panelWidth: 0,
    panelHeight: 0,
    batteryPowerKwh: 0,
    batteryType: undefined,
    inverterPowerKw: 0,
    inverterConnectionType: undefined,
    inverterStorageType: undefined,
    documents: {
      dataSheet: undefined,
      certificate: undefined,
      dataSheetName: undefined,
      certificateName: undefined
    },
    serialNumbers: []
  });

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<'main_barcode' | 'serial_number'>('main_barcode');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Serial Number State
  const [trackSerials, setTrackSerials] = useState(false);
  const [currentSerial, setCurrentSerial] = useState('');
  const [bulkSerialInput, setBulkSerialInput] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        sku: initialData.sku,
        barcode: initialData.barcode,
        category: initialData.category,
        quantity: initialData.quantity,
        minThreshold: initialData.minThreshold,
        buyPrice: initialData.buyPrice,
        sellPrice: initialData.sellPrice,
        location: initialData.location,
        specs: initialData.specs || '',
        powerW: initialData.powerW || 0,
        panelWidth: initialData.panelWidth || 0,
        panelHeight: initialData.panelHeight || 0,
        batteryPowerKwh: initialData.batteryPowerKwh || 0,
        batteryType: initialData.batteryType,
        inverterPowerKw: initialData.inverterPowerKw || 0,
        inverterConnectionType: initialData.inverterConnectionType,
        inverterStorageType: initialData.inverterStorageType,
        documents: initialData.documents || {},
        serialNumbers: initialData.serialNumbers || []
      });
      setTrackSerials(!!(initialData.serialNumbers && initialData.serialNumbers.length > 0));
    }
  }, [initialData]);

  // Auto-enable serial tracking for Inverters if it's a new item
  useEffect(() => {
    if (!initialData && formData.category === Category.INVERTERS) {
      setTrackSerials(true);
    }
  }, [formData.category, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If tracking serials, ensure quantity matches serial count
    const finalData = {
      ...formData,
      quantity: trackSerials ? (formData.serialNumbers?.length || 0) : formData.quantity,
      serialNumbers: trackSerials ? formData.serialNumbers : []
    };
    onSubmit(finalData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'quantity' || name === 'buyPrice' || name === 'sellPrice' || name === 'minThreshold' || name === 'powerW' || name === 'panelWidth' || name === 'panelHeight') ? Number(value) : value
    }));
  };

  // --- Serial Number Logic ---

  const handleAddSerial = () => {
    if (!currentSerial.trim()) return;
    if (formData.serialNumbers?.includes(currentSerial.trim())) {
      alert('This Serial Number is already in the list.');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      serialNumbers: [...(prev.serialNumbers || []), currentSerial.trim()],
      quantity: (prev.serialNumbers?.length || 0) + 1
    }));
    setCurrentSerial('');
  };

  const handleRemoveSerial = (snToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      serialNumbers: prev.serialNumbers?.filter(sn => sn !== snToRemove),
      quantity: (prev.serialNumbers?.length || 0) - 1
    }));
  };

  const handleBulkAddSerials = () => {
    if (!bulkSerialInput.trim()) return;
    
    // Split by comma, newline, or space
    const newSerials = bulkSerialInput
      .split(/[\n,\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Filter duplicates
    const uniqueNewSerials = newSerials.filter(s => !formData.serialNumbers?.includes(s));
    
    if (uniqueNewSerials.length === 0) return;

    setFormData(prev => ({
      ...prev,
      serialNumbers: [...(prev.serialNumbers || []), ...uniqueNewSerials],
      quantity: (prev.serialNumbers?.length || 0) + uniqueNewSerials.length
    }));
    
    setBulkSerialInput('');
    setShowBulkInput(false);
  };

  // --- File Upload Logic ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'dataSheet' | 'certificate') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          documents: {
            ...prev.documents,
            [docType]: reader.result as string,
            [`${docType}Name`]: file.name
          }
        }));
      };
      
      reader.readAsDataURL(file);
    }
  };

  // --- Camera Logic ---

  const startCamera = async (target: 'main_barcode' | 'serial_number') => {
    setScanTarget(target);
    setIsCameraOpen(true);
    
    try {
      // First try environment camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.warn("Environment camera not found, falling back to default", err);
      try {
        // Fallback to any camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err2) {
        console.error("Camera access error:", err2);
        alert("Could not access camera. Please check permissions.");
        setIsCameraOpen(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsScanning(true);
    const context = canvasRef.current.getContext('2d');
    if (context) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      const imageBase64 = canvasRef.current.toDataURL('image/jpeg');
      
      try {
        const result = await extractBarcodeFromImage(imageBase64);
        
        if (scanTarget === 'main_barcode') {
          setFormData(prev => ({ ...prev, barcode: result }));
        } else {
          // Add to serials list
          if (!formData.serialNumbers?.includes(result)) {
             setFormData(prev => ({
              ...prev,
              serialNumbers: [...(prev.serialNumbers || []), result],
              quantity: (prev.serialNumbers?.length || 0) + 1
            }));
          } else {
            alert('Serial number already scanned.');
          }
        }
        stopCamera();
      } catch {
        alert("Could not detect a code. Please try again with better lighting and focus.");
      } finally {
        setIsScanning(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup camera on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-2xl w-full max-w-3xl border border-slate-700 shadow-2xl flex flex-col my-auto relative max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Camera Modal Overlay */}
          {isCameraOpen && (
            <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center rounded-2xl">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-80" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-8 flex gap-4">
                <button
                  type="button"
                  onClick={captureAndScan}
                  disabled={isScanning}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg"
                >
                  {isScanning ? <Loader2 className="animate-spin" /> : <Camera />}
                  {isScanning ? 'Scanning...' : 'Capture'}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="bg-slate-700 text-white px-6 py-3 rounded-full font-medium shadow-lg"
                >
                  Cancel
                </button>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-40 border-2 border-amber-500/50 rounded-lg pointer-events-none">
                <p className="text-amber-500 text-center -mt-8 font-bold text-shadow-sm">Align Code Here</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-slate-400">Item Name</label>
                <input
                  required
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="e.g. 400W Mono Panel"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">SKU</label>
                <input
                  required
                  name="sku"
                  type="text"
                  value={formData.sku}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="e.g. PNL-400-01"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Barcode size={14} /> Barcode</span>
                </label>
                <div className="flex gap-2">
                  <input
                    name="barcode"
                    type="text"
                    value={formData.barcode}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    placeholder="Scan..."
                  />
                  <button
                    type="button"
                    onClick={() => startCamera('main_barcode')}
                    title="Scan with Camera"
                    className="bg-slate-700 hover:bg-slate-600 text-amber-400 px-3 rounded-lg transition-colors border border-slate-600"
                  >
                    <Camera size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none appearance-none"
                >
                  {Object.values(Category).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Location</label>
                <input
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="e.g. Warehouse A"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Buy Price (RON)</label>
                <input
                  required
                  name="buyPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.buyPrice}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Sell Price (RON)</label>
                <input
                  required
                  name="sellPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sellPrice}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>
              
              {/* Conditional Power Input for Solar Panels */}
              {formData.category === Category.PANELS && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-amber-500 flex items-center gap-1">
                      <Zap size={14} /> Power (W)
                    </label>
                    <input
                      name="powerW"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.powerW || ''}
                      onChange={handleChange}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      placeholder="e.g. 505"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-amber-500">Width (m)</label>
                      <input
                        name="panelWidth"
                        type="number"
                        min="0"
                        step="0.001"
                        value={formData.panelWidth || ''}
                        onChange={handleChange}
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                        placeholder="e.g. 1.134"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-amber-500">Height (m)</label>
                      <input
                        name="panelHeight"
                        type="number"
                        min="0"
                        step="0.001"
                        value={formData.panelHeight || ''}
                        onChange={handleChange}
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                        placeholder="e.g. 2.278"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Battery-specific fields */}
              {formData.category === Category.BATTERIES && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-amber-500 flex items-center gap-1">
                      <Zap size={14} /> Power (kWh)
                    </label>
                    <input
                      name="batteryPowerKwh"
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.batteryPowerKwh || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, batteryPowerKwh: Number(e.target.value) }))}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-amber-500">Type</label>
                    <select
                      name="batteryType"
                      value={formData.batteryType || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, batteryType: e.target.value as 'High Voltage' | 'Low Voltage' }))}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none appearance-none"
                    >
                      <option value="">-- Select --</option>
                      <option value="High Voltage">High Voltage</option>
                      <option value="Low Voltage">Low Voltage</option>
                    </select>
                  </div>
                </>
              )}

              {/* Inverter-specific fields */}
              {formData.category === Category.INVERTERS && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-amber-500 flex items-center gap-1">
                      <Zap size={14} /> Power (kW)
                    </label>
                    <input
                      name="inverterPowerKw"
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.inverterPowerKw || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, inverterPowerKw: Number(e.target.value) }))}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      placeholder="e.g. 5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-amber-500">Tip Bransament</label>
                    <select
                      name="inverterConnectionType"
                      value={formData.inverterConnectionType || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, inverterConnectionType: e.target.value as 'Monofazat' | 'Trifazat' }))}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none appearance-none"
                    >
                      <option value="">-- Select --</option>
                      <option value="Monofazat">Monofazat</option>
                      <option value="Trifazat">Trifazat</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-amber-500">Tip Stocare</label>
                    <select
                      name="inverterStorageType"
                      value={formData.inverterStorageType || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, inverterStorageType: e.target.value as 'High Voltage' | 'Low Voltage' }))}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none appearance-none"
                    >
                      <option value="">-- Select --</option>
                      <option value="High Voltage">High Voltage</option>
                      <option value="Low Voltage">Low Voltage</option>
                    </select>
                  </div>
                </>
              )}

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-slate-400">Specs / Details</label>
                <input
                  name="specs"
                  type="text"
                  value={formData.specs}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                  placeholder="Technical specifications"
                />
              </div>
            </div>

            {/* Serial Number & Quantity Section */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
               <div className="flex justify-between items-center mb-4">
                 <div>
                   <label className="flex items-center gap-2 text-sm font-bold text-white cursor-pointer select-none">
                    <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                      <input 
                        type="checkbox" 
                        name="trackSerials" 
                        id="trackSerials"
                        checked={trackSerials}
                        onChange={(e) => setTrackSerials(e.target.checked)}
                        className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-1 checked:translate-x-5 checked:border-amber-500"
                      />
                      <label htmlFor="trackSerials" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${trackSerials ? 'bg-amber-500' : 'bg-slate-700'}`}></label>
                    </div>
                    Track Serial Numbers
                  </label>
                  <p className="text-xs text-slate-500 mt-1 ml-12">
                    For specific items like Inverters. Quantity is calculated automatically.
                  </p>
                 </div>

                 {/* Quantity Display (Readonly if tracking serials) */}
                 <div className="text-right">
                    <label className="text-xs font-medium text-slate-400 block mb-1">Total Quantity</label>
                    <input
                      required
                      name="quantity"
                      type="number"
                      min="0"
                      readOnly={trackSerials}
                      value={formData.quantity}
                      onChange={handleChange}
                      className={`w-32 text-center border rounded-lg px-4 py-2 text-white font-bold outline-none ${
                        trackSerials 
                          ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-900 border-slate-600 focus:ring-2 focus:ring-amber-500'
                      }`}
                    />
                 </div>
               </div>

               {trackSerials && (
                 <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                   <div className="flex gap-2 mb-3">
                     <div className="relative flex-1">
                       <input 
                         type="text" 
                         value={currentSerial}
                         onChange={(e) => setCurrentSerial(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSerial())}
                         placeholder="Scan or type SN and press Enter..."
                         className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-3 pr-10 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
                       />
                       <button
                          type="button"
                          onClick={() => startCamera('serial_number')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400"
                        >
                          <Camera size={18} />
                        </button>
                     </div>
                     <button 
                       type="button" 
                       onClick={handleAddSerial}
                       className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium"
                     >
                       Add
                     </button>
                     <button 
                       type="button" 
                       onClick={() => setShowBulkInput(!showBulkInput)}
                       className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2"
                       title="Bulk Add"
                     >
                       <ListPlus size={18} />
                     </button>
                   </div>

                   {showBulkInput && (
                     <div className="mb-4 bg-slate-800 p-3 rounded-lg border border-slate-600">
                       <label className="text-xs text-slate-400 mb-1 block">Paste list (comma or newline separated):</label>
                       <textarea 
                         value={bulkSerialInput}
                         onChange={(e) => setBulkSerialInput(e.target.value)}
                         className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white h-24 mb-2 focus:ring-1 focus:ring-amber-500 outline-none"
                       />
                       <div className="flex justify-end gap-2">
                         <button type="button" onClick={() => setShowBulkInput(false)} className="text-xs text-slate-400 hover:text-white px-3 py-1">Cancel</button>
                         <button type="button" onClick={handleBulkAddSerials} className="bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded">Process List</button>
                       </div>
                     </div>
                   )}

                   <div className="bg-slate-900 rounded-lg border border-slate-700 p-2 max-h-40 overflow-y-auto">
                     {formData.serialNumbers && formData.serialNumbers.length > 0 ? (
                       <div className="flex flex-wrap gap-2">
                         {formData.serialNumbers.map((sn, idx) => (
                           <span key={idx} className="inline-flex items-center gap-1 bg-slate-800 border border-slate-600 text-xs text-slate-300 px-2 py-1 rounded group">
                             {sn}
                             <button 
                              type="button" 
                              onClick={() => handleRemoveSerial(sn)}
                              className="text-slate-500 hover:text-red-400 ml-1"
                             >
                               <X size={12} />
                             </button>
                           </span>
                         ))}
                       </div>
                     ) : (
                       <div className="text-center text-slate-500 text-sm py-4">No serial numbers added yet.</div>
                     )}
                   </div>
                 </div>
               )}

               <div className="mt-4">
                  <label className="text-sm font-medium text-slate-400">Min. Threshold</label>
                  <input
                    required
                    name="minThreshold"
                    type="number"
                    min="0"
                    value={formData.minThreshold}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none mt-1"
                  />
               </div>
            </div>

            {/* Document Uploads */}
            <div className="space-y-1 md:col-span-2 border-t border-slate-700 pt-4">
              <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Upload size={16} /> Documents
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Data Sheet */}
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 border-dashed hover:border-amber-500/50 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium text-slate-400">Data Sheet (PDF)</label>
                    {formData.documents?.dataSheet && <CheckCircle size={14} className="text-green-500" />}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileChange(e, 'dataSheet')}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700"
                  />
                   {formData.documents?.dataSheetName && (
                    <div className="mt-1 text-[10px] text-slate-300 truncate">
                      {formData.documents.dataSheetName}
                    </div>
                  )}
                </div>

                {/* Conformity Certificate */}
                 <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 border-dashed hover:border-amber-500/50 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium text-slate-400">Conformity Certificate</label>
                    {formData.documents?.certificate && <CheckCircle size={14} className="text-green-500" />}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={(e) => handleFileChange(e, 'certificate')}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700"
                  />
                  {formData.documents?.certificateName && (
                    <div className="mt-1 text-[10px] text-slate-300 truncate">
                      {formData.documents.certificateName}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="pt-6 mt-6 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors font-bold flex items-center gap-2"
            >
              <Save size={18} />
              Save Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryForm;
