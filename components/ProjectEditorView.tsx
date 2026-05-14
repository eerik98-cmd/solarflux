'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, ChevronDown, ChevronLeft, Check,
  MapPin, Zap, FileText, MoreHorizontal, Link2, Briefcase, X,
  Camera, ImageIcon, Pencil, Download, Trash2, Upload, ChevronRight,
} from 'lucide-react';
import { Project, ProjectStatus, Client, ClientSiteImage } from '@/types';

// --- Helpers ---

export function fmtDate(value?: Date | string): string {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return '00000000';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

export function statusMeta(status: ProjectStatus): { label: string; color: string; dot: string } {
  switch (status) {
    case 'active':    return { label: 'Active',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' };
    case 'completed': return { label: 'Completed', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',         dot: 'bg-blue-400'    };
    case 'archived':  return { label: 'Archived',  color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',      dot: 'bg-slate-400'   };
    default:          return { label: 'Draft',     color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',   dot: 'bg-purple-400'  };
  }
}

export function generateProjectNumber(client: Client, existingProjects: Project[]): string {
  const internalId = client.internalId || client.id;
  const date = fmtDate(new Date());
  const n = existingProjects.filter(p => p.clientId === client.id).length + 1;
  return `P-${internalId}-${date}-${n}`;
}

export function computeQuoteNumbers(
  quotes: { id: string; clientId?: string; date?: string | Date }[],
  clients: Client[]
): Map<string, string> {
  const clientCodeById = new Map<string, string>();
  clients.forEach(c => { if (c.id) clientCodeById.set(c.id, (c.internalId || c.id).trim()); });
  const byClient = new Map<string, typeof quotes>();
  quotes.forEach(q => {
    const key = (q.clientId ? clientCodeById.get(q.clientId) : null) || (q.clientId || 'NOCLIENT').trim();
    const arr = byClient.get(key) || [];
    arr.push(q);
    byClient.set(key, arr);
  });
  const fmtD = (v?: string | Date) => {
    const d = v ? new Date(v) : new Date('');
    if (isNaN(d.getTime())) return '00/00/0000';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  const result = new Map<string, string>();
  byClient.forEach((qs, clientKey) => {
    const sorted = [...qs].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
    sorted.forEach((q, i) => result.set(q.id, `Q-${clientKey}-${fmtD(q.date)}-${i + 1}`));
  });
  return result;
}

// --- Blank form ---

export const BLANK_FORM = {
  clientId: '',
  projectName: '',
  status: 'draft' as ProjectStatus,
  description: '',
  connectionType: '' as '' | 'Monofazat' | 'Trifazat',
  roofType: '' as '' | 'Tigla ceramica' | 'Tabla' | 'Tigla metalica' | 'Tabla ondulata' | 'Tabla cutata' | 'Panou sandwich' | 'Other',
  roofTypeOther: '',
  groundingStatus: '' as '' | 'exista' | 'nu exista, face Solar Invest' | 'nu exista, face Beneficiarul',
  inverterKw: '',
  panelKw: '',
  panelCount: '',
  batteryKwh: '',
  batteryPresent: false as boolean,
  storage: '',
  technicalNotes: '',
  siteImages: [] as import('@/types').ClientSiteImage[],
  siteCountry: 'Romania',
  siteCounty: '',
  siteCity: '',
  siteStreet: '',
  siteStreetNumber: '',
  sitePostalCode: '',
  linkedQuoteId: '',
};
export type FormState = typeof BLANK_FORM;

// --- Editor View ---

export function ProjectEditorView({
  initialProject,
  clients,
  savedQuotes,
  projects,
  onSave,
  onBack,
  lockedClientId,
  seedSiteAddress,
}: {
  initialProject?: Project;
  clients: Client[];
  savedQuotes: { id: string; title?: string; customerName: string; clientId?: string; date?: string | Date }[];
  projects: Project[];
  onSave: (form: FormState, project?: Project) => Promise<void>;
  onBack: () => void;
  onSaveClientAddress?: (address: { country?: string; county?: string; city?: string; street?: string; streetNumber?: string; postalCode?: string }) => Promise<void>;
  lockedClientId?: string;
  seedSiteAddress?: {
    country?: string;
    county?: string;
    city?: string;
    street?: string;
    streetNumber?: string;
    postalCode?: string;
  };
}) {
  const [saveAddrPrompt, setSaveAddrPrompt] = useState(false);
  const [drawingImage, setDrawingImage] = useState<ClientSiteImage | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => {
    if (initialProject) {
      return {
        clientId: initialProject.clientId,
        projectName: initialProject.projectName,
        status: initialProject.status,
        description: initialProject.description ?? '',
        connectionType: (initialProject.connectionType as any) ?? '',
        roofType: (initialProject.roofType as any) ?? '',
        roofTypeOther: initialProject.roofTypeOther ?? '',
        groundingStatus: (initialProject.groundingStatus as any) ?? '',
        inverterKw: initialProject.inverterKw?.toString() ?? '',
        panelKw: initialProject.panelKw?.toString() ?? '',
        panelCount: initialProject.panelCount?.toString() ?? '',
        batteryKwh: initialProject.batteryKwh?.toString() ?? '',
        batteryPresent: !!(initialProject.batteryKwh || initialProject.batteryPresent),
        storage: initialProject.storage ?? '',
        siteImages: initialProject.siteImages ?? [],
        technicalNotes: initialProject.technicalNotes ?? '',
        siteCountry: initialProject.siteCountry ?? 'Romania',
        siteCounty: initialProject.siteCounty ?? '',
        siteCity: initialProject.siteCity ?? '',
        siteStreet: initialProject.siteStreet ?? '',
        siteStreetNumber: initialProject.siteStreetNumber ?? '',
        sitePostalCode: initialProject.sitePostalCode ?? '',
        linkedQuoteId: initialProject.linkedQuoteId ?? '',
      };
    }
    return {
      ...BLANK_FORM,
      clientId: lockedClientId ?? '',
      siteCountry: seedSiteAddress?.country ?? BLANK_FORM.siteCountry,
      siteCounty: seedSiteAddress?.county ?? BLANK_FORM.siteCounty,
      siteCity: seedSiteAddress?.city ?? BLANK_FORM.siteCity,
      siteStreet: seedSiteAddress?.street ?? BLANK_FORM.siteStreet,
      siteStreetNumber: seedSiteAddress?.streetNumber ?? BLANK_FORM.siteStreetNumber,
      sitePostalCode: seedSiteAddress?.postalCode ?? BLANK_FORM.sitePostalCode,
      siteImages: [],
    };
  });

  const [saving, setSaving] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [linkQuoteModalOpen, setLinkQuoteModalOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const clientDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node))
        setActionsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (clientDropRef.current && !clientDropRef.current.contains(e.target as Node))
        setClientDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const set = (k: keyof FormState, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const isClientLocked = !!lockedClientId;
  const selectedClient = clients.find(c => c.id === form.clientId) || null;

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 10);
    const s = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(s) || (c.internalId ?? '').toLowerCase().includes(s)
    ).slice(0, 10);
  }, [clients, clientSearch]);

  const clientQuotes = useMemo(
    () => form.clientId ? savedQuotes.filter(q => q.clientId === form.clientId) : [],
    [form.clientId, savedQuotes]
  );

  const linkedQuoteNum = useMemo(() => {
    if (!form.linkedQuoteId) return null;
    const qNums = computeQuoteNumbers(savedQuotes, clients);
    return qNums.get(form.linkedQuoteId) ?? null;
  }, [form.linkedQuoteId, savedQuotes, clients]);

  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (form.connectionType) parts.push(form.connectionType);
    if (form.inverterKw) parts.push(`${form.inverterKw}kW inverter`);
    if (form.panelCount && form.panelKw) parts.push(`${form.panelCount} panels (${form.panelKw}kW)`);
    else if (form.panelCount) parts.push(`${form.panelCount} panels`);
    else if (form.panelKw) parts.push(`${form.panelKw}kW panels`);
    if (form.batteryKwh) parts.push(`${form.batteryKwh}kWh storage`);
    if (form.groundingStatus) parts.push(`grounding: ${form.groundingStatus}`);
    const location = form.siteCity || form.siteCounty;
    if (!parts.length && !location) return '';
    let text = 'Client wants a complete PV system';
    if (parts.length) text += ` — ${parts.join(', ')}`;
    if (location) text += ` — located in ${location}`;
    return text + '.';
  }, [form]);

  const handleCreateQuote = useCallback(() => {
    if (!form.clientId) return;
    const p = new URLSearchParams({ mode: 'editor', seedClientId: form.clientId });
    if (initialProject?.id) p.set('seedProjectId', initialProject.id);
    if (form.projectName) p.set('seedTitle', form.projectName);
    router.push(`/dashboard/quote-generator?${p.toString()}`);
  }, [form.clientId, form.projectName, initialProject, router]);

  const handleSubmit = async () => {
    if (!form.clientId || !form.projectName.trim()) return;

    // Compute before save while component is still mounted
    const shouldPromptAddress =
      !!onSaveClientAddress &&
      !!form.siteCity &&
      !selectedClient?.city;

    setSaving(true);
    await onSave(form, initialProject);
    setSaving(false);

    if (shouldPromptAddress) {
      setSaveAddrPrompt(true);
    } else {
      onBack();
    }
  };

  const inputCls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm';
  const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2';
  const selectCls = inputCls;
  const isNew = !initialProject;

  return (
    <div className="h-full overflow-y-auto bg-slate-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700/60 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-bold text-white">
              {isNew ? 'New Project' : initialProject.projectNumber}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta(form.status).color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta(form.status).dot}`} />
              {statusMeta(form.status).label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !form.clientId || !form.projectName.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-amber-500/20"
            >
              {saving ? 'Saving...' : isNew ? 'Create Project' : 'Save Changes'}
            </button>
            <div className="relative" ref={actionsRef}>
              <button
                onClick={() => setActionsOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
              >
                <MoreHorizontal size={16} /> Actions
              </button>
              {actionsOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</div>
                  {(['draft', 'active', 'completed', 'archived'] as ProjectStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => { set('status', s); setActionsOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-700 ${
                        form.status === s ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      {form.status === s ? <Check size={14} /> : <span className="w-3.5 inline-block" />}
                      {statusMeta(s).label}
                    </button>
                  ))}
                  <div className="border-t border-slate-700" />
                  <button
                    onClick={() => { setActionsOpen(false); setLinkQuoteModalOpen(true); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Link2 size={14} /> Link to Quote
                  </button>
                  <div className="border-t border-slate-700" />
                  <button
                    onClick={() => { setActionsOpen(false); handleCreateQuote(); }}
                    disabled={!form.clientId}
                    className="w-full text-left px-4 py-2.5 text-sm text-amber-400 hover:bg-slate-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} /> Create Quote
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 grid grid-cols-3 gap-6 pb-20">

        {/* Left column (2/3) */}
        <div className="col-span-2 space-y-5">

          {/* Client */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <Briefcase size={14} className="text-slate-400" /> Client
            </div>
            <div className="p-5">
              <label className={labelCls}>Select client *</label>
              <div className="relative" ref={clientDropRef}>
                <button
                  type="button"
                  disabled={!!initialProject}
                  onClick={() => { setClientDropOpen(v => !v); setClientSearch(''); }}
                  className="w-full flex items-center justify-between bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-left text-sm transition-colors hover:border-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {selectedClient
                    ? <span className="text-white font-medium">{selectedClient.name}{selectedClient.internalId ? ` (${selectedClient.internalId})` : ''}</span>
                    : <span className="text-slate-400">Select a client...</span>}
                  <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />
                </button>
                {clientDropOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-700">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search clients..."
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          className="w-full bg-slate-900 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-400 outline-none border border-slate-600 focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {form.clientId && (
                        <button
                          onClick={() => { set('clientId', ''); setClientDropOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700 italic"
                        >Clear selection</button>
                      )}
                      {filteredClients.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { set('clientId', c.id); setClientDropOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                            c.id === form.clientId ? 'bg-amber-500/10 text-amber-400' : 'text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                            <span>{c.name}{c.internalId ? ` (${c.internalId})` : ''}</span>
                          </div>
                          {c.id === form.clientId && <Check size={14} />}
                        </button>
                      ))}
                      {filteredClients.length === 0 && (
                        <div className="px-4 py-6 text-center text-slate-500 text-sm">No clients found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <FileText size={14} className="text-slate-400" /> Project Details
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Project Name *</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Residential PV 10kW"
                  value={form.projectName}
                  onChange={e => set('projectName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Description / Notes</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={3}
                  placeholder="Brief overview of the project..."
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Site Location */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
              <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold">
                <MapPin size={14} className="text-slate-400" /> Installation Site
              </div>
              {selectedClient && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(f => ({
                      ...f,
                      siteCountry: selectedClient.country || f.siteCountry,
                      siteCounty: selectedClient.county || '',
                      siteCity: selectedClient.city || '',
                      siteStreet: selectedClient.street || '',
                      siteStreetNumber: selectedClient.streetNumber || '',
                      sitePostalCode: selectedClient.postalCode || '',
                    }));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                >
                  <Download size={12} /> Import from client
                </button>
              )}
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Country</label>
                  <input className={inputCls} value={form.siteCountry} onChange={e => set('siteCountry', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>County / Region</label>
                  <input className={inputCls} placeholder="e.g. Ilfov" value={form.siteCounty} onChange={e => set('siteCounty', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input className={inputCls} placeholder="e.g. Bucharest" value={form.siteCity} onChange={e => set('siteCity', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Street</label>
                  <input className={inputCls} value={form.siteStreet} onChange={e => set('siteStreet', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>No.</label>
                  <input className={inputCls} value={form.siteStreetNumber} onChange={e => set('siteStreetNumber', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Postal Code</label>
                  <input className={inputCls} value={form.sitePostalCode} onChange={e => set('sitePostalCode', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Technical Requirements */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <Zap size={14} className="text-slate-400" /> Technical Requirements
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Connection</label>
                  <select className={selectCls} value={form.connectionType} onChange={e => set('connectionType', e.target.value as any)}>
                    <option value="">—</option>
                    <option>Monofazat</option>
                    <option>Trifazat</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Inverter Power (kW)</label>
                  <input className={inputCls} type="number" min="0" step="0.1" placeholder="0.0" value={form.inverterKw} onChange={e => set('inverterKw', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Panel Power (kW)</label>
                  <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.0" value={form.panelKw} onChange={e => set('panelKw', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Battery</label>
                  <input
                    className={inputCls}
                    type="text"
                    placeholder="e.g. 10 kWh — leave blank if none"
                    value={form.batteryKwh}
                    onChange={e => {
                      const v = e.target.value;
                      setForm(f => ({ ...f, batteryKwh: v, batteryPresent: v.trim().length > 0 }));
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Roof Type</label>
                  <select className={selectCls} value={form.roofType} onChange={e => set('roofType', e.target.value as any)}>
                    <option value="">—</option>
                    <option>Tigla ceramica</option>
                    <option>Tabla</option>
                    <option>Tigla metalica</option>
                    <option>Tabla ondulata</option>
                    <option>Tabla cutata</option>
                    <option>Panou sandwich</option>
                    <option>Other</option>
                  </select>
                  {form.roofType === 'Other' && (
                    <input className={inputCls + ' mt-2'} placeholder="Describe roof type..." value={form.roofTypeOther} onChange={e => set('roofTypeOther', e.target.value)} />
                  )}
                </div>
                <div>
                  <label className={labelCls}>Grounding Status</label>
                  <select className={selectCls} value={form.groundingStatus} onChange={e => set('groundingStatus', e.target.value as any)}>
                    <option value="">—</option>
                    <option value="exista">Exists</option>
                    <option value="nu exista, face Solar Invest">Does not exist — Solar Invest handles</option>
                    <option value="nu exista, face Beneficiarul">Does not exist — Client handles</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={3}
                  placeholder="Additional technical details..."
                  value={form.technicalNotes}
                  onChange={e => set('technicalNotes', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 text-slate-300 text-sm font-semibold">
              <ImageIcon size={14} className="text-slate-400" /> Site Photos
            </div>
            <div className="p-5 space-y-4">
              {/* Upload buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
                >
                  <Upload size={15} /> Upload from device
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
                >
                  <Camera size={15} /> Take photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const img: ClientSiteImage = {
                          id: crypto.randomUUID(),
                          url: ev.target?.result as string,
                          timestamp: new Date(),
                        };
                        setForm(f => ({ ...f, siteImages: [...f.siteImages, img] }));
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = '';
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const img: ClientSiteImage = {
                        id: crypto.randomUUID(),
                        url: ev.target?.result as string,
                        timestamp: new Date(),
                      };
                      setForm(f => ({ ...f, siteImages: [...f.siteImages, img] }));
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {/* Photo grid */}
              {form.siteImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {form.siteImages.map((img, idx) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden bg-slate-900 aspect-square cursor-pointer"
                      onClick={() => setLightboxIndex(idx)}
                    >
                      <img src={img.url} alt={img.label || 'Site photo'} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setDrawingImage(img); }}
                          className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 transition-colors"
                          title="Draw on photo"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, siteImages: f.siteImages.filter(i => i.id !== img.id) })); }}
                          className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
                          title="Remove photo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {img.label && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-slate-300 truncate">{img.label}</div>
                      )}
                      <div className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">{idx + 1}/{form.siteImages.length}</div>
                    </div>
                  ))}
                </div>
              )}
              {form.siteImages.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No photos yet. Upload from device or take a photo.</p>
              )}
            </div>
          </div>

        </div>

        {/* Right column (1/3) */}
        <div className="col-span-1 space-y-4">

          <button
            onClick={handleSubmit}
            disabled={saving || !form.clientId || !form.projectName.trim()}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-amber-500/20 text-sm"
          >
            {saving ? 'Saving...' : isNew ? 'Create Project' : 'Save Changes'}
          </button>

          <button
            onClick={onBack}
            className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 font-medium text-sm transition-colors"
          >
            Cancel
          </button>

        </div>
      </div>

      {/* Link to Quote modal */}
      {linkQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setLinkQuoteModalOpen(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-white font-bold text-lg">Link to Quote</h2>
              <button onClick={() => setLinkQuoteModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              {!form.clientId ? (
                <p className="text-slate-400 text-sm text-center py-4">Select a client first.</p>
              ) : clientQuotes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No quotes found for this client.</p>
              ) : (
                <div className="space-y-2">
                  {form.linkedQuoteId && (
                    <button
                      onClick={() => { set('linkedQuoteId', ''); setLinkQuoteModalOpen(false); }}
                      className="w-full text-left px-4 py-3 rounded-xl bg-slate-700/30 border border-slate-600 hover:border-red-500/50 hover:bg-red-500/10 transition-colors text-slate-400 text-sm"
                    >
                      ✕ Remove link
                    </button>
                  )}
                  {clientQuotes.map(q => {
                    const qNums = computeQuoteNumbers(savedQuotes, clients);
                    const qNum = qNums.get(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => { set('linkedQuoteId', q.id); setLinkQuoteModalOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left group ${
                          form.linkedQuoteId === q.id
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                            : 'bg-slate-700/50 border-slate-600 hover:bg-amber-500/10 hover:border-amber-500'
                        }`}
                      >
                        <span className="font-mono font-semibold">{qNum || q.id}</span>
                        <span className="text-slate-400 text-sm truncate max-w-[55%]">{q.title || q.customerName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save address to client prompt */}
      {saveAddrPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h2 className="text-white font-bold text-lg">Save address to client?</h2>
            <p className="text-slate-400 text-sm">Do you want to save this installation site address to the client profile as well?</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  setSaveAddrPrompt(false);
                  await onSaveClientAddress?.({
                    country: form.siteCountry,
                    county: form.siteCounty,
                    city: form.siteCity,
                    street: form.siteStreet,
                    streetNumber: form.siteStreetNumber,
                    postalCode: form.sitePostalCode,
                  });
                  onBack();
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                Yes, save to client
              </button>
              <button
                onClick={() => { setSaveAddrPrompt(false); onBack(); }}
                className="flex-1 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                No, keep separate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <LightboxModal
          images={form.siteImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Drawing modal */}
      {drawingImage && (
        <DrawingModal
          image={drawingImage}
          onClose={() => setDrawingImage(null)}
          onSave={(updatedImg) => {
            setForm(f => ({ ...f, siteImages: f.siteImages.map(i => i.id === updatedImg.id ? updatedImg : i) }));
            setDrawingImage(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Lightbox Modal ───────────────────────────────────────────────────────────
function LightboxModal({
  images,
  startIndex,
  onClose,
}: {
  images: ClientSiteImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const current = images[idx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
      else if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + images.length) % images.length);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-slate-400 text-sm font-mono">{idx + 1} / {images.length}</span>
        {current.label && <span className="text-slate-300 text-sm">{current.label}</span>}
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
          <X size={22} />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-16">
        {images.length > 1 && (
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
            className="absolute left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <img
          src={current.url}
          alt={current.label || 'Site photo'}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
        {images.length > 1 && (
          <button
            onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
            className="absolute right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="flex gap-2 px-5 py-3 overflow-x-auto flex-shrink-0 justify-center" onClick={e => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setIdx(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? 'border-amber-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Drawing Modal ────────────────────────────────────────────────────────────
function DrawingModal({
  image,
  onClose,
  onSave,
}: {
  image: ClientSiteImage;
  onClose: () => void;
  onSave: (img: ClientSiteImage) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#f59e0b');
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    };
    img.src = image.url;
  }, [image.url]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#1e293b' : color;
    ctx.lineWidth = tool === 'eraser' ? size * 6 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { setIsDrawing(false); lastPos.current = null; };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave({ ...image, url: canvas.toDataURL('image/jpeg', 0.92) });
  };

  const COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700 flex-wrap">
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors mr-2">
          <X size={20} />
        </button>
        <span className="text-white font-semibold text-sm mr-2">Draw on photo</span>
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              className={`w-6 h-6 rounded-full border-2 transition-all ${color === c && tool === 'pen' ? 'border-white scale-125' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-slate-400 text-xs">Size</span>
          <input type="range" min={1} max={20} value={size} onChange={e => setSize(Number(e.target.value))} className="w-20 accent-amber-500" />
        </div>
        <button
          onClick={() => setTool(t => t === 'eraser' ? 'pen' : 'eraser')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tool === 'eraser' ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          {tool === 'eraser' ? 'Eraser ON' : 'Eraser'}
        </button>
        <button
          onClick={handleSave}
          className="ml-auto bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          Save drawing
        </button>
      </div>
      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full rounded-lg shadow-2xl"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
    </div>
  );
}
