'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import {
  Hammer, Package, AlertCircle, User, Calendar, CheckCircle2, Camera, Download, Trash2,
  X, ChevronLeft, ChevronRight, FileText, TrendingUp, TrendingDown, ChevronDown, ChevronUp, RotateCcw, MessageSquare, Plus, Save
} from 'lucide-react';
import { EquipmentTrackingEntry, InstallationPhoto } from '@/types';
import { aggregateEquipmentTrackingEntries, toWorkDateKey } from '@/lib/equipmentTracking';
import { applyAssignedInstallersToQuote, getAssignedInstallerNames, getAssignedInstallers, getPrimaryAssignedInstallerName } from '@/lib/installerAssignments';

interface ProjectGroup {
  projectName: string;
  quotes: any[];
  status: 'in-progress' | 'pending-approval' | 'completed';
}

function calculateProjectTrackingSummary(quotes: any[], entries: EquipmentTrackingEntry[]) {
  return quotes.reduce(
    (totals, quote) => {
      const aggregate = aggregateEquipmentTrackingEntries(
        quote,
        entries.filter((entry) => entry.quoteId === quote.id)
      );
      const equipmentVariance = aggregate.materialVariances.reduce((sum, item) => sum + item.variance, 0);
      const extraItemsTotal = aggregate.extraItems.reduce(
        (sum, item) => sum + ((item.consumedQty || item.actuallyUsed || 0) * item.netPrice),
        0
      );

      return {
        equipmentVariance: totals.equipmentVariance + equipmentVariance,
        extraItemsTotal: totals.extraItemsTotal + extraItemsTotal,
        totalVariance: totals.totalVariance + equipmentVariance + extraItemsTotal,
      };
    },
    { equipmentVariance: 0, extraItemsTotal: 0, totalVariance: 0 }
  );
}

function generateConsumptionSummary(quotes: any[]) {
  const details: any[] = [];
  let narrative = '';

  quotes.forEach(quote => {
    if (!quote.items) return;
    const consumption = quote.consumptionData || [];
    const extras = quote.extraItems || [];

    quote.items.forEach((item: any) => {
      const consumed = consumption.find((c: any) => c.id === item.id);
      const actuallyUsed = consumed?.consumedQty ?? item.quantity;
      const variance = actuallyUsed - item.quantity;

      if (variance !== 0) {
        details.push({
          name: item.description,
          quantity: Math.abs(variance),
          value: Math.abs(variance * item.netPrice),
          status: variance > 0 ? 'extra' : 'saved',
        });
      }
    });

    extras.forEach((extra: any) => {
      details.push({
        name: extra.description,
        quantity: extra.consumedQty || 0,
        value: (extra.consumedQty || 0) * extra.netPrice,
        status: 'extra',
      });
    });
  });

  const totalExtra = details.filter((d) => d.status === 'extra').reduce((sum, d) => sum + d.value, 0);
  const totalSaved = details.filter((d) => d.status === 'saved').reduce((sum, d) => sum + d.value, 0);

  if (totalExtra > 0 && totalSaved > 0) {
    narrative = `The installation used extra items worth ${totalExtra.toFixed(2)} RON but saved ${totalSaved.toFixed(2)} RON on other items, resulting in a net difference of ${(totalExtra - totalSaved).toFixed(2)} RON.`;
  } else if (totalExtra > 0) {
    narrative = `The installation used extra items worth ${totalExtra.toFixed(2)} RON beyond the quoted amounts.`;
  } else if (totalSaved > 0) {
    narrative = `The installation was completed efficiently, saving ${totalSaved.toFixed(2)} RON compared to the quoted amounts.`;
  } else {
    narrative = 'The installation used exactly the quoted amounts of items.';
  }

  return { narrative, details };
}

export default function InstallationPage() {
  const params = useParams();
  const { currentUser } = useAuth();
  const { clients, savedQuotes, updateQuote, equipmentTrackingEntries, users } = useData();
  const clientId = params.id as string;
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [completionModal, setCompletionModal] = useState<{ isOpen: boolean; quoteId: string | null; notes: string }>({ isOpen: false, quoteId: null, notes: '' });
  const [reopenModal, setReopenModal] = useState<{ isOpen: boolean; quoteId: string | null; reason: string }>({ isOpen: false, quoteId: null, reason: '' });
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const installerOptions = (users || [])
    .filter((user) => user.role === 'INSTALLER')
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  const handleCompleteProject = async (quoteId: string) => {
    setIsSubmitting(true);
    try {
      await updateQuote(quoteId, {
        phase: 'completed',
        adminApprovedAt: new Date(),
        adminApprovalNotes: completionModal.notes || undefined,
      });
      alert('✅ Project marked as completed! The status has been updated.');
      setCompletionModal({ isOpen: false, quoteId: null, notes: '' });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenProject = async (quoteId: string) => {
    setIsSubmitting(true);
    try {
      await updateQuote(quoteId, {
        phase: 'in-progress',
        adminApprovedAt: undefined,
        reopenedAt: new Date(),
        reopenReason: reopenModal.reason || undefined,
      });
      alert('✅ Project reopened! It is now active again at /installation.');
      setReopenModal({ isOpen: false, quoteId: null, reason: '' });
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProject = (projectName: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectName)) {
      newExpanded.delete(projectName);
    } else {
      newExpanded.add(projectName);
    }
    setExpandedProjects(newExpanded);
  };

  const client = clients.find(c => c.id === clientId);
  const installationQuotes = savedQuotes.filter(q => q.clientId === clientId);
  const clientTrackingEntries = equipmentTrackingEntries.filter((entry) => entry.clientId === clientId);

  if (!client) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-white font-bold">Client Not Found</p>
        </div>
      </div>
    );
  }

  if (installationQuotes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 p-8">
        <div className="text-center">
          <Hammer size={48} className="text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-semibold">No Installation Projects</p>
          <p className="text-slate-500 text-sm mt-2">This project has not been allocated to any installers yet.</p>
        </div>
      </div>
    );
  }

  // Group projects by project name
  const projectMap = new Map<string, any[]>();
  installationQuotes.forEach(quote => {
    const projectName = client.needs?.projectName || quote.title || 'Unnamed Project';
    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }
    projectMap.get(projectName)!.push(quote);
  });

  // Create project groups with status
  const projectGroups: ProjectGroup[] = [];
  projectMap.forEach((quotes, projectName) => {
    const allCompleted = quotes.every(q => q.adminApprovedAt);
    const somePending = quotes.some(q => q.completedAt && !q.adminApprovedAt);

    let status: 'in-progress' | 'pending-approval' | 'completed' = 'in-progress';
    if (allCompleted) status = 'completed';
    else if (somePending) status = 'pending-approval';

    projectGroups.push({ projectName, quotes, status });
  });

  // Collect all photos
  const allPhotos = installationQuotes.flatMap(q => q.installationPhotos || []);

  const updateInstallersForQuote = async (quote: any, nextAssignments: ReturnType<typeof getAssignedInstallers>) => {
    const nextQuote = applyAssignedInstallersToQuote(quote, nextAssignments);
    await updateQuote(quote.id, {
      assignedInstallers: nextQuote.assignedInstallers,
      allocatedInstallerId: nextQuote.allocatedInstallerId,
      allocatedAt: nextQuote.allocatedAt,
      phase: nextAssignments.length > 0 && (!quote.phase || quote.phase === 'planning') ? 'in-progress' : quote.phase,
    });
  };

  const handleAddInstaller = async (quote: any) => {
    const installerId = assignmentDrafts[quote.id];
    const installer = installerOptions.find((user) => user.id === installerId);
    if (!installer) return;

    const existingAssignments = getAssignedInstallers(quote);
    if (existingAssignments.some((assignment) => assignment.installerId === installer.id)) {
      return;
    }

    await updateInstallersForQuote(quote, [
      ...existingAssignments,
      {
        installerId: installer.id,
        installerNickname: installer.nickname,
        assignedAt: new Date(),
        assignedBy: currentUser?.nickname || currentUser?.username || 'Admin',
      },
    ]);

    setAssignmentDrafts((prev) => ({ ...prev, [quote.id]: '' }));
  };

  const handleChangeInstaller = async (quote: any, assignmentIndex: number, installerId: string) => {
    const installer = installerOptions.find((user) => user.id === installerId);
    if (!installer) return;

    const existingAssignments = getAssignedInstallers(quote);
    const currentAssignment = existingAssignments[assignmentIndex];
    if (!currentAssignment) return;
    if (existingAssignments.some((assignment, index) => index !== assignmentIndex && assignment.installerId === installer.id)) {
      return;
    }

    const nextAssignments = existingAssignments.map((assignment, index) =>
      index === assignmentIndex
        ? {
            ...assignment,
            installerId: installer.id,
            installerNickname: installer.nickname,
          }
        : assignment
    );

    await updateInstallersForQuote(quote, nextAssignments);
  };

  const handleRemoveInstaller = async (quote: any, assignmentIndex: number) => {
    const existingAssignments = getAssignedInstallers(quote);
    const nextAssignments = existingAssignments.filter((_, index) => index !== assignmentIndex);
    await updateInstallersForQuote(quote, nextAssignments);
  };

  const handleSetLeadInstaller = async (quote: any, assignmentIndex: number) => {
    const existingAssignments = getAssignedInstallers(quote);
    if (assignmentIndex < 0 || assignmentIndex >= existingAssignments.length) return;
    const leadAssignment = existingAssignments[assignmentIndex];
    const nextAssignments = [leadAssignment, ...existingAssignments.filter((_, index) => index !== assignmentIndex)];
    await updateInstallersForQuote(quote, nextAssignments);
  };

  const handleDownloadPhoto = (photo: InstallationPhoto) => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = `installation-photo-${photo.id}.jpg`;
    link.click();
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <Hammer size={32} className="text-emerald-500" />
            Installation Projects - {client.name}
          </h1>
          <div className="text-slate-400">
            <p className="text-sm">View and manage all installation projects for this client</p>
          </div>
        </div>

        {/* Client Information Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Client Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Client Name</p>
              <p className="text-white font-semibold">{client.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Client Type</p>
              <p className="text-white">{client.type || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Email</p>
              <p className="text-blue-400 text-sm">{client.email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Phone</p>
              <p className="text-white text-sm">{client.phone || 'Not provided'}</p>
            </div>
          </div>
        </div>

        {/* Projects Grouped Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4">Projects</h2>
          {projectGroups.map(group => {
            const isExpanded = expandedProjects.has(group.projectName);
            const groupEntries = clientTrackingEntries
              .filter((entry) => group.quotes.some((quote) => quote.id === entry.quoteId))
              .sort((a, b) => {
                const dateDiff = new Date(b.workDate).getTime() - new Date(a.workDate).getTime();
                if (dateDiff !== 0) return dateDiff;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
              });
            const entriesByDate: Record<string, EquipmentTrackingEntry[]> = groupEntries.reduce((acc, entry) => {
              const key = toWorkDateKey(new Date(entry.workDate));
              acc[key] = [...(acc[key] || []), entry].sort((a, b) => a.installerNickname.localeCompare(b.installerNickname));
              return acc;
            }, {} as Record<string, EquipmentTrackingEntry[]>);
            const projectTrackingSummary = calculateProjectTrackingSummary(group.quotes, groupEntries);
            const statusColor =
              group.status === 'completed'
                ? 'bg-green-500/20 text-green-400'
                : group.status === 'pending-approval'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-amber-500/20 text-amber-400';

            const statusLabel =
              group.status === 'completed'
                ? 'Completed'
                : group.status === 'pending-approval'
                ? 'Pending Approval'
                : 'In Progress';

            return (
              <div key={group.projectName} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                {/* Project Header */}
                <button
                  onClick={() => toggleProject(group.projectName)}
                  className="w-full flex items-center justify-between px-6 py-4 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded ${isExpanded ? 'bg-slate-700' : 'bg-slate-700/50'}`}>
                      {isExpanded ? <ChevronUp size={20} className="text-white" /> : <ChevronDown size={20} className="text-white" />}
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-white">{group.projectName}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {group.quotes.length} installation{group.quotes.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-semibold ${statusColor}`}>
                    {group.status === 'completed' ? <CheckCircle2 size={14} /> : group.status === 'pending-approval' ? <CheckCircle2 size={14} /> : <Hammer size={14} />}
                    {statusLabel}
                  </span>
                </button>

                {/* Project Content - Collapsible */}
                {isExpanded && (
                  <div className="border-t border-slate-700 bg-slate-900/30 p-6 space-y-6">
                    {/* Installations List */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-300 uppercase mb-4">Installations</h4>
                      <div className="space-y-3">
                        {group.quotes.map(quote => (
                          <div key={quote.id} className="bg-slate-800 border border-slate-700 rounded p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h5 className="font-semibold text-white">{quote.title || 'Untitled'}</h5>
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                  <User size={12} /> {getAssignedInstallerNames(quote).join(', ') || 'Unassigned'}
                                </p>
                              </div>
                              {quote.adminApprovedAt ? (
                                <span className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                                  <CheckCircle2 size={14} /> Completed
                                </span>
                              ) : quote.completedAt ? (
                                <span className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">
                                  <CheckCircle2 size={14} /> Pending Approval
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-semibold">
                                  <Hammer size={14} /> In Progress
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-xs text-slate-400 mb-3">
                              {quote.allocatedAt && (
                                <p className="flex items-center gap-2">
                                  <Calendar size={12} />
                                  Lead assigned: {new Date(quote.allocatedAt).toLocaleDateString()}
                                </p>
                              )}
                              {quote.completedAt && (
                                <p className="flex items-center gap-2">
                                  <CheckCircle2 size={12} className="text-blue-400" />
                                  Installer Finished: {new Date(quote.completedAt).toLocaleDateString()}
                                </p>
                              )}
                              {quote.adminApprovedAt && (
                                <p className="flex items-center gap-2">
                                  <CheckCircle2 size={12} className="text-green-400" />
                                  Confirmed: {new Date(quote.adminApprovedAt).toLocaleDateString()}
                                </p>
                              )}
                              {quote.items && (
                                <p className="flex items-center gap-2">
                                  <Package size={12} />
                                  {quote.items.length} items
                                </p>
                              )}
                            </div>

                            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                              <div className="flex items-center justify-between gap-4 mb-3">
                                <h6 className="text-xs font-bold uppercase text-slate-400">Installers Working On This Project</h6>
                                <span className="text-xs text-slate-500">Lead installer is shown first and kept in legacy project fields for compatibility.</span>
                              </div>

                              <div className="space-y-3">
                                {getAssignedInstallers(quote).length > 0 ? (
                                  getAssignedInstallers(quote).map((assignment, index) => (
                                    <div key={`${quote.id}-${assignment.installerId}-${index}`} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                                      <div>
                                        <select
                                          value={assignment.installerId}
                                          onChange={(e) => handleChangeInstaller(quote, index, e.target.value)}
                                          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        >
                                          {installerOptions.map((installer) => (
                                            <option key={installer.id} value={installer.id}>
                                              {installer.nickname} (@{installer.username})
                                            </option>
                                          ))}
                                        </select>
                                        <p className="mt-1 text-xs text-slate-500">
                                          Assigned {new Date(assignment.assignedAt).toLocaleString('ro-RO')}
                                          {assignment.assignedBy ? ` by ${assignment.assignedBy}` : ''}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleSetLeadInstaller(quote, index)}
                                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${index === 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                                      >
                                        {index === 0 ? 'Lead Installer' : 'Make Lead'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveInstaller(quote, index)}
                                        className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/25"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-slate-500">No installers assigned yet.</p>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center rounded-lg border border-dashed border-slate-700 p-3">
                                  <select
                                    value={assignmentDrafts[quote.id] || ''}
                                    onChange={(e) => setAssignmentDrafts((prev) => ({ ...prev, [quote.id]: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  >
                                    <option value="">Select installer to add</option>
                                    {installerOptions
                                      .filter((installer) => !getAssignedInstallers(quote).some((assignment) => assignment.installerId === installer.id))
                                      .map((installer) => (
                                        <option key={installer.id} value={installer.id}>
                                          {installer.nickname} (@{installer.username})
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleAddInstaller(quote)}
                                    disabled={!assignmentDrafts[quote.id]}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                                  >
                                    <Plus size={16} />
                                    Add Installer
                                  </button>
                                </div>
                              </div>
                            </div>

                            {quote.items && quote.items.length > 0 && (
                              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 mt-4">
                                <div className="flex items-center justify-between gap-4 mb-3">
                                  <h6 className="text-xs font-bold uppercase text-slate-400">Original Quote Table</h6>
                                  <span className="text-xs text-slate-500">
                                    {quote.items.length} line item{quote.items.length === 1 ? '' : 's'}
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="border-b border-slate-700">
                                      <tr>
                                        <th className="py-2 px-3 text-left text-slate-400">Item</th>
                                        <th className="py-2 px-3 text-center text-slate-400">Qty</th>
                                        <th className="py-2 px-3 text-center text-slate-400">Unit</th>
                                        <th className="py-2 px-3 text-right text-slate-400">Unit Price</th>
                                        <th className="py-2 px-3 text-right text-slate-400">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/60">
                                      {quote.items.map((item: any) => (
                                        <tr key={item.id}>
                                          <td className="py-2 px-3 text-slate-200">{item.description}</td>
                                          <td className="py-2 px-3 text-center text-white">{item.quantity}</td>
                                          <td className="py-2 px-3 text-center text-slate-300">{item.unit}</td>
                                          <td className="py-2 px-3 text-right text-slate-300">
                                            {item.netPrice.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                                          </td>
                                          <td className="py-2 px-3 text-right font-semibold text-white">
                                            {(item.quantity * item.netPrice).toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="border-t border-slate-700">
                                      <tr>
                                        <td colSpan={4} className="py-3 px-3 text-right text-xs font-bold uppercase text-slate-500">
                                          Quote Total
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-emerald-300">
                                          {quote.totalGross.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Equipment & Usage Tracking (for single installer projects) */}
                    {groupEntries.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-slate-300 uppercase">Equipment Tracking History</h4>
                          <span className="text-xs text-slate-400">
                            {groupEntries.length} entr{groupEntries.length === 1 ? 'y' : 'ies'}
                          </span>
                        </div>

                        <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                            <p className="text-xs text-slate-500 mb-1">Equipment Variance</p>
                            <p className={`text-lg font-bold ${projectTrackingSummary.equipmentVariance > 0 ? 'text-red-400' : projectTrackingSummary.equipmentVariance < 0 ? 'text-green-400' : 'text-white'}`}>
                              {projectTrackingSummary.equipmentVariance > 0 ? '+' : ''}
                              {projectTrackingSummary.equipmentVariance.toFixed(2)} RON
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                            <p className="text-xs text-slate-500 mb-1">Extra Materials</p>
                            <p className="text-lg font-bold text-emerald-400">{projectTrackingSummary.extraItemsTotal.toFixed(2)} RON</p>
                          </div>
                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                            <p className="text-xs text-slate-500 mb-1">Project Total Difference</p>
                            <p className={`text-lg font-bold ${projectTrackingSummary.totalVariance > 0 ? 'text-red-400' : projectTrackingSummary.totalVariance < 0 ? 'text-green-400' : 'text-white'}`}>
                              {projectTrackingSummary.totalVariance > 0 ? '+' : ''}
                              {projectTrackingSummary.totalVariance.toFixed(2)} RON
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {Object.entries(entriesByDate).map(([dateKey, dateEntries]) => (
                            <div key={dateKey} className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-bold text-white">
                                  {new Date(dateEntries[0].workDate).toLocaleDateString('ro-RO', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </h5>
                                <span className="text-xs text-slate-400">{dateEntries.length} installer submission{dateEntries.length === 1 ? '' : 's'}</span>
                              </div>

                              <div className="space-y-3">
                                {dateEntries.map((entry) => {
                                  const entryExtraTotal = entry.extraItems.reduce(
                                    (sum, item) => sum + ((item.consumedQty || item.actuallyUsed || 0) * item.netPrice),
                                    0
                                  );

                                  return (
                                    <details key={entry.id} className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
                                      <summary className="cursor-pointer list-none">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold text-white">{entry.installerNickname}</span>
                                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${entry.status === 'submitted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                                {entry.status}
                                              </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">
                                              Updated {new Date(entry.updatedAt).toLocaleString('ro-RO')}
                                              {entry.projectTitle ? ` • ${entry.projectTitle}` : ''}
                                            </p>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-300">
                                            <div>
                                              <p className="text-slate-500">Items</p>
                                              <p className="font-semibold text-white">{entry.items.length}</p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500">Extras</p>
                                              <p className="font-semibold text-white">{entry.extraItems.length}</p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500">Photos</p>
                                              <p className="font-semibold text-white">{entry.installationPhotos.length}</p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500">Extra value</p>
                                              <p className="font-semibold text-white">{entryExtraTotal.toFixed(2)} RON</p>
                                            </div>
                                          </div>
                                        </div>
                                      </summary>

                                      <div className="mt-4 space-y-4 border-t border-slate-700 pt-4">
                                        {(entry.notes || entry.groundingValue || entry.lowVoltageCableCheck) && (
                                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">
                                            {entry.notes && (
                                              <div className="mb-2">
                                                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Installation Report</p>
                                                <p className="whitespace-pre-wrap">{entry.notes}</p>
                                              </div>
                                            )}
                                            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                                              {entry.groundingValue && <span>Grounding: {entry.groundingValue}</span>}
                                              {entry.lowVoltageCableCheck && <span>LV check: {entry.lowVoltageCableCheck}</span>}
                                            </div>
                                          </div>
                                        )}

                                        <div className="overflow-x-auto">
                                          <table className="w-full text-sm">
                                            <thead className="border-b border-slate-700">
                                              <tr>
                                                <th className="py-2 px-3 text-left text-slate-400">Item</th>
                                                <th className="py-2 px-3 text-center text-slate-400">Quoted</th>
                                                <th className="py-2 px-3 text-center text-slate-400">Used</th>
                                                <th className="py-2 px-3 text-center text-slate-400">Variance</th>
                                                <th className="py-2 px-3 text-right text-slate-400">Value</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/60">
                                              {entry.items.map((item) => {
                                                const diff = (item.consumedQty || item.actuallyUsed || 0) - item.quotedQty;
                                                return (
                                                  <tr key={item.id}>
                                                    <td className="py-2 px-3 text-slate-200">{item.description}</td>
                                                    <td className="py-2 px-3 text-center text-slate-300">{item.quotedQty} {item.unit}</td>
                                                    <td className="py-2 px-3 text-center text-white">{item.consumedQty || item.actuallyUsed || 0} {item.unit}</td>
                                                    <td className={`py-2 px-3 text-center font-semibold ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-300'}`}>
                                                      {diff > 0 ? '+' : ''}{diff} {item.unit}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-slate-300">{(diff * item.netPrice).toFixed(2)} RON</td>
                                                  </tr>
                                                );
                                              })}
                                              {entry.extraItems.map((item) => (
                                                <tr key={item.id} className="bg-emerald-500/5">
                                                  <td className="py-2 px-3 text-emerald-300">EXTRA: {item.description}</td>
                                                  <td className="py-2 px-3 text-center text-slate-500">-</td>
                                                  <td className="py-2 px-3 text-center text-white">{item.consumedQty || item.actuallyUsed || 0} {item.unit}</td>
                                                  <td className="py-2 px-3 text-center font-semibold text-red-400">+{item.consumedQty || item.actuallyUsed || 0} {item.unit}</td>
                                                  <td className="py-2 px-3 text-right text-slate-300">{(((item.consumedQty || item.actuallyUsed || 0) * item.netPrice)).toFixed(2)} RON</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : group.quotes.length === 1 && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-300 uppercase mb-4">Equipment & Usage Tracking</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-900/50 border-b border-slate-600">
                              <tr>
                                <th className="text-left py-3 px-4 text-slate-400">Item</th>
                                <th className="text-center py-3 px-4 text-slate-400">Quoted</th>
                                <th className="text-center py-3 px-4 text-slate-400">Actually Used</th>
                                <th className="text-center py-3 px-4 text-slate-400">Variance</th>
                                <th className="text-center py-3 px-4 text-slate-400">Barcode/SN</th>
                                <th className="text-right py-3 px-4 text-slate-400">Unit Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                              {group.quotes.flatMap(q => {
                                const consumption = q.consumptionData || [];
                                const extras = q.extraItems || [];

                                const items = q.items?.map((item: any) => {
                                  const consumed = consumption.find((c: any) => c.id === item.id);
                                  const actuallyUsed = consumed?.consumedQty ?? item.quantity;
                                  const variance = actuallyUsed - item.quantity;

                                  return {
                                    id: item.id,
                                    description: item.description,
                                    quoted: item.quantity,
                                    unit: item.unit,
                                    actuallyUsed,
                                    variance,
                                    netPrice: item.netPrice,
                                    barcode: consumed?.barcode,
                                    serialNumbers: consumed?.selectedSerialNumbers || [],
                                    isExtra: false,
                                  };
                                }) || [];

                                const extraItemsFormatted = extras.map((e: any) => ({
                                  id: e.id,
                                  description: e.description,
                                  quoted: 0,
                                  unit: e.unit,
                                  actuallyUsed: e.consumedQty || 0,
                                  variance: e.consumedQty || 0,
                                  netPrice: e.netPrice,
                                  barcode: null,
                                  serialNumbers: [],
                                  isExtra: true,
                                }));

                                return [...items, ...extraItemsFormatted];
                              }).map((item: any, idx: number) => {
                                const varianceValue = item.variance * item.netPrice;
                                const varianceColor =
                                  item.variance > 0 ? 'text-red-400' : item.variance < 0 ? 'text-green-400' : 'text-slate-400';

                                return (
                                  <tr key={idx} className={`hover:bg-slate-700/30 ${item.isExtra ? 'bg-slate-900/30 border-t-2 border-emerald-500/30' : ''}`}>
                                    <td className="py-3 px-4 text-slate-300">
                                      {item.isExtra && <span className="text-xs text-emerald-400 font-semibold mr-2">EXTRA:</span>}
                                      {item.description}
                                    </td>
                                    <td className="py-3 px-4 text-center text-white font-semibold">
                                      {item.quoted > 0 ? `${item.quoted} ${item.unit}` : '-'}
                                    </td>
                                    <td className="py-3 px-4 text-center text-emerald-400 font-semibold">
                                      {item.actuallyUsed} {item.unit}
                                    </td>
                                    <td className={`py-3 px-4 text-center font-bold ${varianceColor}`}>
                                      {item.variance > 0 ? '+' : ''}{item.variance} {item.unit}
                                      <div className="text-xs mt-1 opacity-75">
                                        {varianceValue > 0 ? '+' : ''}{varianceValue.toFixed(2)} RON
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-center text-slate-500 text-xs">
                                      {item.serialNumbers && item.serialNumbers.length > 0 ? (
                                        <span className="text-slate-300 break-all">{item.serialNumbers.join(', ')}</span>
                                      ) : item.barcode ? (
                                        <span className="text-slate-300 break-all">{item.barcode}</span>
                                      ) : (
                                        <span className="text-slate-600">-</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right text-slate-300">
                                      {item.netPrice.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* AI-Powered Summary */}
                        {group.quotes.some(q => (q.consumptionData?.length || 0) > 0 || (q.extraItems?.length || 0) > 0) && (() => {
                          const summary = generateConsumptionSummary(group.quotes);
                          const netDifference = group.quotes.reduce((sum, q) => {
                            const consumed = q.consumptionData || [];
                            const extras = q.extraItems || [];
                            return sum + (q.items?.reduce((s: number, item: any) => {
                              const consumed_item = consumed.find((c: any) => c.id === item.id);
                              const used = consumed_item?.consumedQty ?? item.quantity;
                              return s + ((used - item.quantity) * item.netPrice);
                            }, 0) || 0) + extras.reduce((s: number, e: any) => s + ((e.consumedQty || 0) * e.netPrice), 0);
                          }, 0);

                          return (
                            <div className="mt-6 p-6 bg-gradient-to-r from-slate-800 to-slate-900 border-2 border-emerald-500/30 rounded-lg space-y-4">
                              <div className="flex items-start gap-3">
                                {netDifference > 0 ? (
                                  <TrendingUp className="text-red-400 flex-shrink-0 mt-1" size={24} />
                                ) : netDifference < 0 ? (
                                  <TrendingDown className="text-green-400 flex-shrink-0 mt-1" size={24} />
                                ) : (
                                  <CheckCircle2 className="text-emerald-400 flex-shrink-0 mt-1" size={24} />
                                )}
                                <div className="flex-1">
                                  <h3 className="text-lg font-bold text-white mb-2">Installation Cost Analysis</h3>
                                  <p className="text-slate-300 leading-relaxed mb-4">{summary.narrative}</p>

                                  {summary.details.length > 0 && (
                                    <div className="mt-4 space-y-2 text-sm">
                                      <p className="text-slate-400 font-semibold mb-3">Item-by-item breakdown:</p>
                                      {summary.details.map((detail, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-900/50 rounded border border-slate-700">
                                          <span className="text-slate-300">{detail.name}</span>
                                          <div className="flex items-center gap-3">
                                            {detail.status === 'extra' ? (
                                              <>
                                                <span className="text-red-400 font-semibold">+{detail.quantity} units</span>
                                                <span className="text-red-300 bg-red-500/20 px-2 py-1 rounded text-xs font-semibold">+{detail.value.toFixed(2)} RON</span>
                                              </>
                                            ) : (
                                              <>
                                                <span className="text-green-400 font-semibold">-{detail.quantity} units</span>
                                                <span className="text-green-300 bg-green-500/20 px-2 py-1 rounded text-xs font-semibold">-{detail.value.toFixed(2)} RON</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                                    <span className="text-slate-300 font-semibold">Total Cost Difference:</span>
                                    <div className={`text-2xl font-bold px-4 py-2 rounded ${
                                      netDifference > 0 ? 'bg-red-500/20 text-red-400' : netDifference < 0 ? 'bg-green-500/20 text-green-400' : 'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                      {netDifference > 0 ? '+' : ''}{netDifference.toFixed(2)} RON
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Installation Photos */}
                    {allPhotos.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-300 uppercase mb-4">Installation Photos</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {allPhotos.map((photo: InstallationPhoto, idx: number) => (
                            <div
                              key={photo.id}
                              className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden hover:border-emerald-500/50 transition-all"
                            >
                              <div className="relative aspect-video group cursor-pointer" onClick={() => setPreviewImageIndex(idx)}>
                                <img src={photo.url} alt="Installation" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadPhoto(photo);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition-colors"
                                  >
                                    <Download size={18} />
                                  </button>
                                </div>
                              </div>
                              <div className="p-4 space-y-2">
                                {photo.description && (
                                  <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                                    <p className="text-sm text-slate-300 bg-slate-800 rounded px-2 py-1">{photo.description}</p>
                                  </div>
                                )}
                                <div className="space-y-1 text-xs text-slate-400">
                                  {photo.uploadedAt && (
                                    <p>
                                      <span className="font-semibold text-slate-300">Uploaded:</span> {new Date(photo.uploadedAt).toLocaleString('ro-RO')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Installer Mentions */}
                    {group.quotes.some(q => ((q as any).installerMentions || []).length > 0) && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-300 uppercase mb-4 flex items-center gap-2">
                          <MessageSquare size={14} className="text-blue-400" />
                          Installer Mentions
                        </h4>
                        <div className="space-y-3">
                          {group.quotes
                            .flatMap(q => ((q as any).installerMentions || []).map((mention: any) => ({
                              quoteTitle: q.title || 'Untitled Project',
                              mention,
                            })))
                            .sort((a, b) => new Date(b.mention.createdAt).getTime() - new Date(a.mention.createdAt).getTime())
                            .map((entry, idx) => (
                              <div key={`${entry.mention.id || idx}`} className="bg-slate-900/50 rounded-lg p-4 border border-blue-500/30">
                                <p className="text-sm text-white">
                                  <span className="font-bold text-blue-300">{entry.mention.createdBy || 'Installer'}</span>{' '}
                                  added a mention for{' '}
                                  <span className="font-bold">{entry.quoteTitle}</span>
                                </p>
                                <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{entry.mention.message}</p>
                                <p className="text-xs text-slate-500 mt-2">
                                  {entry.mention.createdAt ? new Date(entry.mention.createdAt).toLocaleString('ro-RO') : ''}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Project Actions */}
                    {(() => {
                      const allCompleted = group.quotes.every(q => q.adminApprovedAt);

                      if (allCompleted) {
                        return (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 size={20} className="text-green-400" />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-white font-semibold text-sm">Installation Completed</h4>
                                <p className="text-xs text-green-300">This project has been confirmed as complete by admin.</p>
                              </div>
                              <button
                                onClick={() => setReopenModal({ isOpen: true, quoteId: group.quotes[0].id, reason: '' })}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors flex items-center gap-2 text-xs whitespace-nowrap"
                              >
                                <RotateCcw size={14} />
                                Reopen
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h4 className="text-white font-semibold text-sm mb-1">Project Completion</h4>
                              <p className="text-xs text-emerald-300">Mark this installation as complete or reopen for edits</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              {group.quotes.map(quote => {
                                if (quote.adminApprovedAt) {
                                  return (
                                    <button
                                      key={quote.id}
                                      onClick={() => setReopenModal({ isOpen: true, quoteId: quote.id, reason: '' })}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors flex items-center gap-2 text-xs"
                                    >
                                      <RotateCcw size={14} />
                                      Reopen
                                    </button>
                                  );
                                } else {
                                  return (
                                    <button
                                      key={quote.id}
                                      onClick={() => setCompletionModal({ isOpen: true, quoteId: quote.id, notes: '' })}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition-colors flex items-center gap-2 text-xs"
                                    >
                                      <CheckCircle2 size={14} />
                                      Confirm
                                    </button>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Image Preview Modal */}
        {previewImageIndex !== null && allPhotos.length > 0 && (() => {
          const currentPhoto = allPhotos[previewImageIndex];
          const hasPrevious = previewImageIndex > 0;
          const hasNext = previewImageIndex < allPhotos.length - 1;

          return (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewImageIndex(null)}>
              <div
                className="bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-600 bg-slate-750">
                  <span className="text-slate-300 text-sm font-medium bg-slate-700/50 px-3 py-1 rounded flex-shrink-0">
                    {previewImageIndex + 1} / {allPhotos.length}
                  </span>
                  <h3 className="text-white font-semibold truncate flex-1 mx-4">{currentPhoto.description || 'Installation Photo'}</h3>
                  <button onClick={() => setPreviewImageIndex(null)} className="ml-4 flex-shrink-0 text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 flex items-center justify-center overflow-hidden relative px-6 py-4 bg-slate-900/30">
                  {hasPrevious && (
                    <button
                      onClick={() => setPreviewImageIndex(previewImageIndex - 1)}
                      className="absolute left-2 z-10 text-white hover:text-emerald-400 hover:scale-110 transition-all bg-slate-800/90 hover:bg-slate-700 rounded-full p-2 shadow-lg"
                    >
                      <ChevronLeft size={32} />
                    </button>
                  )}
                  <img src={currentPhoto.url} alt="Installation" className="max-w-full max-h-full object-contain" />
                  {hasNext && (
                    <button
                      onClick={() => setPreviewImageIndex(previewImageIndex + 1)}
                      className="absolute right-2 z-10 text-white hover:text-emerald-400 hover:scale-110 transition-all bg-slate-800/90 hover:bg-slate-700 rounded-full p-2 shadow-lg"
                    >
                      <ChevronRight size={32} />
                    </button>
                  )}
                </div>

                {(currentPhoto.uploadedBy || currentPhoto.uploadedAt) && (
                  <div className="px-6 py-4 border-t border-slate-600 bg-slate-750">
                    <div className="space-y-1 text-sm text-slate-300">
                      {currentPhoto.uploadedAt && (
                        <p>
                          <span className="font-semibold">Date & Time:</span> {new Date(currentPhoto.uploadedAt).toLocaleString('ro-RO')}
                        </p>
                      )}
                      {currentPhoto.uploadedBy && (
                        <p>
                          <span className="font-semibold">Uploaded by:</span> {currentPhoto.uploadedBy}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="px-6 py-3 border-t border-slate-600 bg-slate-750 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setPreviewImageIndex(null)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDownloadPhoto(currentPhoto)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Download size={16} /> Download
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Completion Modal */}
        {completionModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-slate-800 border-2 border-emerald-500 rounded-lg shadow-2xl w-full max-w-md">
              <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  Confirm Project Completion
                </h2>
                <button onClick={() => setCompletionModal({ isOpen: false, quoteId: null, notes: '' })} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                  <p className="text-sm text-yellow-300">⚠️ You can reopen this project later if changes need to be made.</p>
                </div>
                <div>
                  <label className="text-white font-semibold text-sm block mb-2">Approval Notes (Optional)</label>
                  <textarea
                    value={completionModal.notes}
                    onChange={(e) => setCompletionModal({ ...completionModal, notes: e.target.value })}
                    className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="Add approval notes or comments..."
                    rows={4}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="border-t border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
                <button onClick={() => setCompletionModal({ isOpen: false, quoteId: null, notes: '' })} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium disabled:opacity-50" disabled={isSubmitting}>
                  Cancel
                </button>
                <button onClick={() => completionModal.quoteId && handleCompleteProject(completionModal.quoteId)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : <><CheckCircle2 size={16} /> Confirm Completion</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reopen Modal */}
        {reopenModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-slate-800 border-2 border-blue-500 rounded-lg shadow-2xl w-full max-w-md">
              <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <RotateCcw size={20} className="text-blue-500" />
                  Reopen Project for Edits
                </h2>
                <button onClick={() => setReopenModal({ isOpen: false, quoteId: null, reason: '' })} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                  <p className="text-sm text-blue-300">This will return the project to active status at /installation for further edits.</p>
                </div>
                <div>
                  <label className="text-white font-semibold text-sm block mb-2">Reason for Reopening</label>
                  <textarea
                    value={reopenModal.reason}
                    onChange={(e) => setReopenModal({ ...reopenModal, reason: e.target.value })}
                    className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="Explain why this project needs to be reopened..."
                    rows={4}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="border-t border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
                <button onClick={() => setReopenModal({ isOpen: false, quoteId: null, reason: '' })} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium disabled:opacity-50" disabled={isSubmitting}>
                  Cancel
                </button>
                <button onClick={() => reopenModal.quoteId && handleReopenProject(reopenModal.quoteId)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : <><RotateCcw size={16} /> Reopen Project</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
