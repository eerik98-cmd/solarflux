'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save, User, Building2, Mail, MapPin, Hash, Briefcase,
  Plus, ChevronDown, ChevronUp, Trash2, ArrowUpRight, FileText,
} from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { ClientType, Project } from '@/types';
import {
  ProjectEditorView,
  generateProjectNumber,
  computeQuoteNumbers,
  statusMeta,
  FormState,
} from '@/components/ProjectEditorView';

export default function ClientDataPage() {
  const router = useRouter();
  const { client, updateClient, saveClient, hasChanges } = useClient();
  const { currentUser, session } = useAuth();
  const { clients, savedQuotes, projects, saveProject, deleteProject } = useData();
  const [formData, setFormData] = useState(client);

  // ─── Project modal state ───────────────────────────────────────────────────
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // ─── Quote accordion state ─────────────────────────────────────────────────
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());

  const generateNextInternalId = (type: ClientType): string => {
    const prefix = 'SI_';
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

  useEffect(() => {
    if (client) {
      if (!client.internalId && client.type) {
        const newId = generateNextInternalId(client.type);
        const updatedClient = { ...client, internalId: newId };
        setFormData(updatedClient);
        updateClient({ internalId: newId });
      } else {
        setFormData(client);
      }
    }
  }, [client?.id]);

  const isDirty = useMemo(() => {
    if (!client || !formData) return false;
    return JSON.stringify(client) !== JSON.stringify(formData);
  }, [client, formData]);

  const clientProjects = useMemo(
    () => (client ? projects.filter(p => p.clientId === client.id) : []),
    [projects, client]
  );

  const clientQuotes = useMemo(
    () => (client ? savedQuotes.filter(q => q.clientId === client.id) : []),
    [savedQuotes, client]
  );

  const quoteNumbers = useMemo(
    () => computeQuoteNumbers(savedQuotes, clients),
    [savedQuotes, clients]
  );

  if (!client || !formData) {
    return <div className="p-8 text-slate-400">Loading...</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    updateClient(formData);
    await saveClient();
  };

  const toggleProject = (id: string) =>
    setExpandedProjects(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const toggleQuote = (id: string) =>
    setExpandedQuotes(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const handleSaveProject = async (form: FormState, project?: Project) => {
    const now = new Date();
    const projectNumber = project?.projectNumber ?? generateProjectNumber(client, projects);
    const toSave: Project = {
      id: project?.id ?? crypto.randomUUID(),
      projectNumber,
      clientId: client.id,
      projectName: form.projectName.trim(),
      status: form.status,
      description: form.description || undefined,
      connectionType: (form.connectionType as any) || undefined,
      roofType: (form.roofType as any) || undefined,
      roofTypeOther: form.roofTypeOther || undefined,
      groundingStatus: (form.groundingStatus as any) || undefined,
      inverterKw: form.inverterKw ? parseFloat(form.inverterKw) : undefined,
      panelKw: form.panelKw ? parseFloat(form.panelKw) : undefined,
      panelCount: form.panelCount ? parseInt(form.panelCount) : undefined,
      batteryKwh: form.batteryKwh ? parseFloat(form.batteryKwh) : undefined,
      batteryPresent: form.batteryPresent || undefined,
      storage: form.storage || undefined,
      technicalNotes: form.technicalNotes || undefined,
      siteCountry: form.siteCountry || undefined,
      siteCounty: form.siteCounty || undefined,
      siteCity: form.siteCity || undefined,
      siteStreet: form.siteStreet || undefined,
      siteStreetNumber: form.siteStreetNumber || undefined,
      sitePostalCode: form.sitePostalCode || undefined,
      siteImages: form.siteImages.length > 0 ? form.siteImages : undefined,
      linkedQuoteId: form.linkedQuoteId || undefined,
      createdAt: project?.createdAt ?? now,
      createdBy: project?.createdBy ?? (session?.nickname ?? 'admin'),
      updatedAt: project ? now : undefined,
      updatedBy: project ? (session?.nickname ?? 'admin') : undefined,
    };
    await saveProject(toSave);
    // ProjectEditorView controls its own closing via onBack after prompt flow
  };

  const handleDeleteProject = async (id: string) => {
    setDeletingProjectId(id);
    await deleteProject(id);
    setDeletingProjectId(null);
  };

  const fmtCurrency = (n?: number, currency: string = 'RON') =>
    n != null ? n.toLocaleString('ro-RO', { style: 'currency', currency, maximumFractionDigits: 2 }) : '—';

  if (showProjectModal) {
    return (
      <ProjectEditorView
        initialProject={editingProject}
        clients={clients}
        savedQuotes={savedQuotes}
        projects={projects}
        onSave={handleSaveProject}
        onBack={() => { setShowProjectModal(false); setEditingProject(undefined); }}
        lockedClientId={client.id}
        onSaveClientAddress={async (addr) => {
          await updateClient({
            country: addr.country,
            county: addr.county,
            city: addr.city,
            street: addr.street,
            streetNumber: addr.streetNumber,
            postalCode: addr.postalCode,
          });
        }}
        seedSiteAddress={editingProject ? undefined : {
          country: client.country || 'Romania',
          county: client.county || undefined,
          city: client.city || undefined,
          street: client.street || undefined,
          streetNumber: client.streetNumber || undefined,
          postalCode: client.postalCode || undefined,
        }}
      />
    );
  }

  return (
    <>
      <div className="px-8 pt-8 pb-24 max-w-5xl mx-auto space-y-10">

        {/* ─────────────────────── Section 1: Client Information ─────────────────────── */}
        <div>
          {/* Section header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {formData.type === ClientType.CORPORATE
                ? <Building2 size={20} className="text-amber-500" />
                : <User size={20} className="text-amber-500" />}
              <h2 className="text-xl font-bold text-white">Client Information</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                formData.status === 'ACTIVE'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : formData.status === 'LEAD'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
              }`}>
                {formData.status}
              </span>
            </div>
            <button
              onClick={handleSave}
              disabled={!hasChanges && !isDirty}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                hasChanges || isDirty
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-md shadow-amber-500/20'
                  : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save size={15} />
              Save Changes
            </button>
          </div>

          <div className="space-y-5">
            {/* Type & Status */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value={ClientType.PRIVATE}>Private Individual</option>
                    <option value={ClientType.CORPORATE}>Corporate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="LEAD">Lead</option>
                    <option value="ACTIVE">Active</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Unified form card */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700">

              {/* Internal ID */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <Hash size={12} /> Internal ID
                  </label>
                  <input
                    name="internalId"
                    value={formData.internalId || ''}
                    onChange={handleChange}
                    disabled={currentUser?.role !== 'SUPER_ADMIN'}
                    className={`w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-sm outline-none focus:border-amber-500 transition-colors ${
                      currentUser?.role !== 'SUPER_ADMIN' ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    placeholder="Auto-generated"
                  />
                  {currentUser?.role !== 'SUPER_ADMIN' && (
                    <span className="text-[11px] text-slate-600 mt-1 block">Super Admin only</span>
                  )}
                </div>
              </div>

              {/* Personal / Company information */}
              <div className="p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  {formData.type === ClientType.CORPORATE ? <Building2 size={12} /> : <User size={12} />}
                  {formData.type === ClientType.CORPORATE ? 'Company Information' : 'Personal Information'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.type === ClientType.PRIVATE ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">First Name</label>
                        <input name="firstName" value={formData.firstName || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Last Name</label>
                        <input name="lastName" value={formData.lastName || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">CNP (Personal ID)</label>
                        <input name="cnp" value={formData.cnp || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Company Name</label>
                        <input name="companyName" value={formData.companyName || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">CUI (Tax ID)</label>
                        <input name="taxId" value={formData.taxId || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Registration Number (J)</label>
                        <input name="regNumber" value={formData.regNumber || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {formData.type === ClientType.CORPORATE && (
                <div className="p-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Briefcase size={12} /> Representative
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">First Name</label>
                      <input name="representativeFirstName" value={formData.representativeFirstName || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Last Name</label>
                      <input name="representativeLastName" value={formData.representativeLastName || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Role / Function</label>
                      <input name="representativeRole" value={formData.representativeRole || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                    </div>
                  </div>
                </div>
              )}

              {formData.type === ClientType.CORPORATE && (
                <div className="p-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Building2 size={12} /> Banking
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Bank Name</label>
                      <input name="bankName" value={formData.bankName || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">IBAN</label>
                      <input name="iban" value={formData.iban || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                    </div>
                  </div>
                </div>
              )}

              {/* Contact */}
              <div className="p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Mail size={12} /> Contact
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
                    <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Phone</label>
                    <input name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MapPin size={12} /> Address
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Street</label>
                    <input name="street" value={formData.street || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Number</label>
                    <input name="streetNumber" value={formData.streetNumber || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">City</label>
                    <input name="city" value={formData.city || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">County</label>
                    <input name="county" value={formData.county || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Postal Code</label>
                    <input name="postalCode" value={formData.postalCode || ''} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Country</label>
                    <input name="country" value={formData.country || 'Romania'} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-amber-500 transition-colors" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="border-t border-slate-700/60" />

        {/* ─────────────────────── Section 2: Projects ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Briefcase size={20} className="text-amber-500" />
              Projects
              <span className="ml-1 bg-slate-700 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {clientProjects.length}
              </span>
            </h2>
            <button
              onClick={() => { setEditingProject(undefined); setShowProjectModal(true); }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-sm transition-colors shadow-md shadow-amber-500/20"
            >
              <Plus size={15} /> New Project
            </button>
          </div>

          {clientProjects.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center text-slate-500">
              <Briefcase size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No projects yet.</p>
              <button
                onClick={() => { setEditingProject(undefined); setShowProjectModal(true); }}
                className="mt-3 text-amber-500 hover:text-amber-400 text-sm font-semibold transition-colors"
              >
                + Create the first project
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700">
              {clientProjects.map(project => {
                const { label, color, dot } = statusMeta(project.status);
                const isExpanded = expandedProjects.has(project.id);
                const linkedQuote = project.linkedQuoteId
                  ? savedQuotes.find(q => q.id === project.linkedQuoteId)
                  : undefined;
                return (
                  <div key={project.id}>
                    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-700/30 transition-colors group">
                      <button onClick={() => toggleProject(project.id)} className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleProject(project.id)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-white text-sm">{project.projectNumber}</span>
                          <span className="text-slate-300 font-medium text-sm truncate">{project.projectName}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                            {label}
                          </span>
                          {project.siteCity && (
                            <span className="text-slate-500 text-xs">{project.siteCity}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => { setEditingProject(project); setShowProjectModal(true); }}
                          className="text-slate-400 hover:text-amber-400 transition-colors p-1.5 rounded-lg hover:bg-amber-500/10 text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          disabled={deletingProjectId === project.id}
                          className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="bg-slate-900/50 px-6 py-4 border-t border-slate-700/50 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                          {project.connectionType && <div><span className="text-slate-500 text-xs">Connection</span><p className="text-slate-200">{project.connectionType}</p></div>}
                          {project.inverterKw && <div><span className="text-slate-500 text-xs">Inverter</span><p className="text-slate-200">{project.inverterKw} kW</p></div>}
                          {project.panelCount && <div><span className="text-slate-500 text-xs">Panels</span><p className="text-slate-200">{project.panelCount}{project.panelKw ? ` × ${project.panelKw}kW` : ''}</p></div>}
                          {project.batteryKwh && <div><span className="text-slate-500 text-xs">Battery</span><p className="text-slate-200">{project.batteryKwh} kWh</p></div>}
                          {project.roofType && <div><span className="text-slate-500 text-xs">Roof</span><p className="text-slate-200">{project.roofType === 'Other' ? project.roofTypeOther || project.roofType : project.roofType}</p></div>}
                          {(project.siteCity || project.siteCounty) && (
                            <div><span className="text-slate-500 text-xs">Location</span><p className="text-slate-200">{[project.siteCity, project.siteCounty].filter(Boolean).join(', ')}</p></div>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-slate-400 text-sm leading-relaxed">{project.description}</p>
                        )}
                        <div className="pt-2 border-t border-slate-700/50">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Linked Quote</p>
                          {linkedQuote ? (
                            <a
                              href={`/dashboard/quote-generator?id=${linkedQuote.id}&mode=detail`}
                              className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors"
                            >
                              <FileText size={14} />
                              {linkedQuote.title || linkedQuote.customerName}
                              <ArrowUpRight size={13} />
                            </a>
                          ) : (
                            <button
                              onClick={() => {
                                const params = new URLSearchParams({
                                  mode: 'editor',
                                  seedClientId: client.id,
                                  seedProjectId: project.id,
                                  seedTitle: project.projectName,
                                });
                                router.push(`/dashboard/quote-generator?${params.toString()}`);
                              }}
                              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-400 text-sm font-medium transition-colors border border-dashed border-slate-600 hover:border-amber-500/50 rounded-lg px-3 py-1.5"
                            >
                              <Plus size={13} /> Create Quote for this project
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="border-t border-slate-700/60" />

        {/* ─────────────────────── Section 3: Quotes ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText size={20} className="text-amber-500" />
              Quotes
              <span className="ml-1 bg-slate-700 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {clientQuotes.length}
              </span>
            </h2>
            <button
              onClick={() => {
                const params = new URLSearchParams({ mode: 'editor', seedClientId: client.id });
                router.push(`/dashboard/quote-generator?${params.toString()}`);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-sm transition-colors shadow-md shadow-amber-500/20"
            >
              <Plus size={15} /> New Quote
            </button>
          </div>

          {clientQuotes.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center text-slate-500">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No quotes yet.</p>
              <button
                onClick={() => {
                  const params = new URLSearchParams({ mode: 'editor', seedClientId: client.id });
                  router.push(`/dashboard/quote-generator?${params.toString()}`);
                }}
                className="mt-3 text-amber-500 hover:text-amber-400 text-sm font-semibold transition-colors"
              >
                + Create the first quote
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700">
              {clientQuotes.map(quote => {
                const isExpanded = expandedQuotes.has(quote.id);
                const linkedProject = quote.projectId
                  ? projects.find(p => p.id === quote.projectId)
                  : undefined;
                const qNum = quoteNumbers.get(quote.id) || quote.id;
                const phaseMeta: Record<string, { color: string; dot: string; label: string }> = {
                  DRAFT: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', dot: 'bg-slate-400', label: 'Draft' },
                  SENT:  { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',   dot: 'bg-blue-400',  label: 'Sent' },
                  WON:   { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', label: 'Won' },
                  LOST:  { color: 'bg-red-500/15 text-red-400 border-red-500/30',       dot: 'bg-red-400',   label: 'Lost' },
                };
                const phase = phaseMeta[quote.phase ?? 'DRAFT'] ?? phaseMeta.DRAFT;
                return (
                  <div key={quote.id}>
                    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-700/30 transition-colors group">
                      <button onClick={() => toggleQuote(quote.id)} className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleQuote(quote.id)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-white text-sm">{qNum}</span>
                          {(quote.title || quote.description) && (
                            <span className="text-slate-300 font-medium text-sm truncate">{quote.title || quote.description}</span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${phase.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${phase.dot}`} />
                            {phase.label}
                          </span>
                          <span className="text-amber-400 font-bold text-sm ml-auto">{fmtCurrency(quote.totalGross, quote.currency ?? 'RON')}</span>
                        </div>
                      </div>
                      <a
                        href={`/dashboard/quote-generator?id=${quote.id}&mode=detail`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-amber-500/10 flex-shrink-0"
                        title="Open quote"
                      >
                        <ArrowUpRight size={15} />
                      </a>
                    </div>
                    {isExpanded && (
                      <div className="bg-slate-900/50 px-6 py-4 border-t border-slate-700/50 space-y-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500 text-xs block">Net Subtotal</span>
                            <span className="text-slate-200 font-medium">{fmtCurrency(quote.subtotalNet, quote.currency ?? 'RON')}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">VAT (21%)</span>
                            <span className="text-slate-200 font-medium">{fmtCurrency(quote.vatTotal, quote.currency ?? 'RON')}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-xs block">Total Gross</span>
                            <span className="text-amber-400 font-bold">{fmtCurrency(quote.totalGross, quote.currency ?? 'RON')}</span>
                          </div>
                        </div>
                        {linkedProject && (
                          <div className="pt-2 border-t border-slate-700/50">
                            <span className="text-slate-500 text-xs block mb-1">Linked Project</span>
                            <span className="text-slate-300 text-sm font-medium">
                              <span className="font-mono text-slate-400 mr-2">{linkedProject.projectNumber}</span>
                              {linkedProject.projectName}
                            </span>
                          </div>
                        )}
                        <div className="pt-2">
                          <a
                            href={`/dashboard/quote-generator?id=${quote.id}&mode=detail`}
                            className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors"
                          >
                            Open Quote <ArrowUpRight size={13} />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

    </>
  );
}
