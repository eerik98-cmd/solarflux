'use client';

import React, { useState, useRef } from 'react';
import { FileText, Download, Upload, AlertCircle, Sparkles, Check } from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { useData } from '@/contexts/DataContext';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

export default function ClientDocGenPage() {
  const { client } = useClient();
  const { savedQuotes } = useData();
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!client) return null;

  const clientQuotes = savedQuotes.filter(q => q.clientId === client.id);
  const selectedQuote = clientQuotes.find(q => q.id === selectedQuoteId);
  const selectedCfDoc = client.documents?.find(doc => doc.id === client.needs?.selectedCfDocId);
  const selectedFacturaDoc = client.documents?.find(doc => doc.id === client.needs?.selectedFacturaDocId);

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setTemplateFile(file);
      setGenerationSuccess(false);
    } else {
      alert('Please upload a .docx file');
    }
  };

  const generateDocument = async () => {
    if (!templateFile) {
      alert('Please upload a template file first');
      return;
    }

    if (!selectedQuoteId) {
      alert('Please select a quote');
      return;
    }

    setIsGenerating(true);
    setGenerationSuccess(false);

    try {
      const arrayBuffer = await templateFile.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      // Prepare data for template
      const quoteData = {
        // Client data
        clientName: client.name || '',
        clientType: client.type || '',
        clientAddress: `${client.street || ''}, ${client.city || ''}, ${client.county || ''}`.trim(),
        clientCountry: client.country || '',
        clientCounty: client.county || '',
        clientCity: client.city || '',
        clientStreet: client.street || '',
        clientStreetNumber: client.streetNumber || '',
        clientPostalCode: client.postalCode || '',
        clientPhone: client.phone || '',
        clientEmail: client.email || '',
        clientCUI: client.taxId || '',
        clientCNP: client.cnp || '',
        clientRegCom: client.regNumber || '',
        clientBankName: client.bankName || '',
        clientIban: client.iban || '',
        clientRepresentativeFirstName: client.representativeFirstName || '',
        clientRepresentativeLastName: client.representativeLastName || '',
        clientRepresentativeRole: client.representativeRole || '',
        
        // Quote data
        quoteName: selectedQuote?.title || '',
        quoteDate: selectedQuote?.date ? new Date(selectedQuote.date).toLocaleDateString('ro-RO') : '',
        quoteItems: selectedQuote?.items?.map((item, idx) => ({
          nr: idx + 1,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          netPrice: item.netPrice.toFixed(2),
          netTotal: (item.quantity * item.netPrice).toFixed(2)
        })) || [],
        subtotalNet: selectedQuote?.subtotalNet?.toFixed(2) || '0.00',
        vatTotal: selectedQuote?.vatTotal?.toFixed(2) || '0.00',
        totalGross: selectedQuote?.totalGross?.toFixed(2) || '0.00',
        
        // Project data
        projectName: client.needs?.projectName || '',
        connectionType: client.needs?.connectionType || '',
        roofType: client.needs?.roofType || '',
        inverterPower: client.needs?.inverterKw || '',
        batteryCapacity: client.needs?.batteryKwh || '',
        panelPower: client.needs?.panelKw || '',
        panelCount: client.needs?.panelCount || '',
        siteCountry: client.needs?.siteCountry || '',
        siteCounty: client.needs?.siteCounty || '',
        siteCity: client.needs?.siteCity || '',
        siteStreet: client.needs?.siteStreet || '',
        siteStreetNumber: client.needs?.siteStreetNumber || '',
        sitePostalCode: client.needs?.sitePostalCode || '',
        podNumber: selectedFacturaDoc?.podNumber || '',
        cfNumber: selectedCfDoc?.cfNumber || '',
        cadNumber: selectedCfDoc?.cadNumber || '',
        cfAddress: selectedCfDoc?.docAddress || '',
        facturaAddress: selectedFacturaDoc?.docAddress || '',
        
        // Additional fields
        internalId: client.internalId || '',
        dateGenerated: new Date().toLocaleDateString('ro-RO'),
        dateGeneratedFull: new Date().toLocaleString('ro-RO')
      };

      doc.render(quoteData);

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const fileName = `${client.name}_${selectedQuote?.title || 'Document'}_${new Date().toISOString().split('T')[0]}.docx`;
      saveAs(blob, fileName);

      setGenerationSuccess(true);
      setTimeout(() => setGenerationSuccess(false), 3000);
    } catch (error) {
      console.error('Document generation error:', error);
      alert(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const placeholders = [
    { key: '{{clientName}}', desc: 'Client name' },
    { key: '{{clientType}}', desc: 'Client type (Private/Corporate)' },
    { key: '{{clientAddress}}', desc: 'Full address' },
    { key: '{{clientPhone}}', desc: 'Phone number' },
    { key: '{{clientEmail}}', desc: 'Email address' },
    { key: '{{clientCountry}}', desc: 'Country' },
    { key: '{{clientCounty}}', desc: 'County' },
    { key: '{{clientCity}}', desc: 'City' },
    { key: '{{clientStreet}}', desc: 'Street' },
    { key: '{{clientStreetNumber}}', desc: 'Street number' },
    { key: '{{clientPostalCode}}', desc: 'Postal code' },
    { key: '{{clientCUI}}', desc: 'CUI (Company Tax ID)' },
    { key: '{{clientCNP}}', desc: 'CNP (Personal ID)' },
    { key: '{{clientBankName}}', desc: 'Bank name' },
    { key: '{{clientIban}}', desc: 'IBAN' },
    { key: '{{clientRepresentativeFirstName}}', desc: 'Representative first name' },
    { key: '{{clientRepresentativeLastName}}', desc: 'Representative last name' },
    { key: '{{clientRepresentativeRole}}', desc: 'Representative role/function' },
    { key: '{{clientRegCom}}', desc: 'Registration number' },
    { key: '{{quoteName}}', desc: 'Quote title' },
    { key: '{{quoteDate}}', desc: 'Quote date' },
    { key: '{{subtotalNet}}', desc: 'Net subtotal' },
    { key: '{{vatTotal}}', desc: 'VAT amount' },
    { key: '{{totalGross}}', desc: 'Gross total' },
    { key: '{{projectName}}', desc: 'Project name' },
    { key: '{{connectionType}}', desc: 'Connection type' },
    { key: '{{roofType}}', desc: 'Roof type' },
    { key: '{{inverterPower}}', desc: 'Inverter power (kW)' },
    { key: '{{batteryCapacity}}', desc: 'Battery capacity (kWh)' },
    { key: '{{panelPower}}', desc: 'Panel power (kW)' },
    { key: '{{panelCount}}', desc: 'Number of panels' },
    { key: '{{siteCountry}}', desc: 'Site country' },
    { key: '{{siteCounty}}', desc: 'Site county' },
    { key: '{{siteCity}}', desc: 'Site city' },
    { key: '{{siteStreet}}', desc: 'Site street' },
    { key: '{{siteStreetNumber}}', desc: 'Site street number' },
    { key: '{{sitePostalCode}}', desc: 'Site postal code' },
    { key: '{{podNumber}}', desc: 'Factura POD number (selected document)' },
    { key: '{{cfNumber}}', desc: 'CF number (selected document)' },
    { key: '{{cadNumber}}', desc: 'CAD number (selected document)' },
    { key: '{{cfAddress}}', desc: 'CF address (selected document)' },
    { key: '{{facturaAddress}}', desc: 'Factura address (selected document)' },
    { key: '{{internalId}}', desc: 'Internal ID' },
    { key: '{{dateGenerated}}', desc: 'Document generation date' },
  ];

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500/10 via-slate-800 to-slate-800 border border-purple-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-2">
            <Sparkles className="text-purple-400" size={28} />
            Document Generator
          </h2>
          <p className="text-slate-400">
            Upload a Word template (.docx) with placeholders, select a quote, and generate a professional document.
          </p>
        </div>

        {/* Template Upload */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Upload className="text-amber-500" size={20} />
            Step 1: Upload Template
          </h3>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleTemplateUpload}
            accept=".docx"
            className="hidden"
          />
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              <Upload size={18} />
              {templateFile ? 'Change Template' : 'Choose Template'}
            </button>
            {templateFile && (
              <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/50">
                <FileText className="text-emerald-400" size={18} />
                <span className="text-emerald-300 font-semibold">{templateFile.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quote Selection */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="text-amber-500" size={20} />
            Step 2: Select Quote
          </h3>
          {clientQuotes.length === 0 ? (
            <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-orange-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-orange-300 font-semibold">No quotes available</p>
                <p className="text-orange-200/70 text-sm mt-1">
                  Create a quote in the Quotes tab first.
                </p>
              </div>
            </div>
          ) : (
            <select
              value={selectedQuoteId}
              onChange={(e) => setSelectedQuoteId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="">-- Select a quote --</option>
              {clientQuotes.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title} - {q.totalGross.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Generate Button */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="text-amber-500" size={20} />
            Step 3: Generate Document
          </h3>
          <button
            onClick={generateDocument}
            disabled={!templateFile || !selectedQuoteId || isGenerating}
            className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-3 transition-all ${
              !templateFile || !selectedQuoteId || isGenerating
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : generationSuccess
                ? 'bg-emerald-500 text-slate-900'
                : 'bg-gradient-to-r from-purple-500 to-amber-500 hover:from-purple-400 hover:to-amber-400 text-white shadow-lg'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Generating...
              </>
            ) : generationSuccess ? (
              <>
                <Check size={24} />
                Document Generated Successfully!
              </>
            ) : (
              <>
                <Download size={24} />
                Generate & Download Document
              </>
            )}
          </button>
        </div>

        {/* Placeholder Reference */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="text-slate-400" size={20} />
            Available Placeholders
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Use these placeholders in your Word template. They will be replaced with actual data.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {placeholders.map(p => (
              <div key={p.key} className="bg-slate-900 rounded-lg p-3 border border-slate-600">
                <code className="text-purple-400 font-mono text-sm font-bold">{p.key}</code>
                <p className="text-slate-500 text-xs mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm font-semibold mb-2">For Quote Items Table:</p>
            <p className="text-blue-200/70 text-xs">
              Use <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono">
                {'{#quoteItems}'}</code> ... <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono">
                {'{/quoteItems}'}</code> to loop through items. Inside the loop, use: 
              <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono ml-1">
                {'{{nr}}'}</code>,
              <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono ml-1">
                {'{{description}}'}</code>,
              <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono ml-1">
                {'{{unit}}'}</code>,
              <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono ml-1">
                {'{{quantity}}'}</code>,
              <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono ml-1">
                {'{{netPrice}}'}</code>,
              <code className="bg-slate-900 px-2 py-0.5 rounded text-purple-400 font-mono ml-1">
                {'{{netTotal}}'}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
