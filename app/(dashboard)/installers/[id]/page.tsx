'use client';

import React, { useMemo, useState } from 'react';
import { Users, ArrowLeft, CheckCircle, Clock, AlertCircle, TrendingUp, BarChart3, Calendar, Briefcase, DollarSign, TrendingDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Quote, ProjectPhase } from '@/types';

const phaseLabels: Record<ProjectPhase | '', string> = {
  'planning': 'Planning',
  'pending-assignment': 'Pending Assignment',
  'assigned-acknowledged': 'Acknowledged',
  'in-progress': 'In Progress',
  'pending-inspection': 'Pending Inspection',
  'completed': 'Completed',
  'archived': 'Archived',
  '': 'Unassigned'
};

const phaseColors: Record<ProjectPhase | '', string> = {
  'planning': 'bg-slate-500/20 text-slate-300',
  'pending-assignment': 'bg-yellow-500/20 text-yellow-300',
  'assigned-acknowledged': 'bg-blue-500/20 text-blue-300',
  'in-progress': 'bg-purple-500/20 text-purple-300',
  'pending-inspection': 'bg-orange-500/20 text-orange-300',
  'completed': 'bg-green-500/20 text-green-300',
  'archived': 'bg-slate-600/20 text-slate-400',
  '': 'bg-slate-700/20 text-slate-400'
};

export default function InstallerDetailPage() {
  const { currentUser } = useAuth();
  const { savedQuotes, users, clients } = useData();
  const router = useRouter();
  const params = useParams();
  const installerId = params?.id as string;
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Find installer first (move before early return)
  const installer = users?.find(u => u.id === installerId);

  // Move all hooks before early return
  const allProjects = useMemo(() => {
    if (!installer) return [];
    return (savedQuotes || []).filter(q => q.allocatedInstallerId === installer.nickname);
  }, [savedQuotes, installer]);

  const activeProjects = useMemo(() => allProjects.filter(q => !q.completedAt), [allProjects]);
  const completedProjects = useMemo(() => allProjects.filter(q => q.completedAt), [allProjects]);
  const pendingAcknowledgement = useMemo(
    () => allProjects.filter(q => q.allocatedInstallerId && !q.acknowledgedAt),
    [allProjects]
  );

  // Calculate performance metrics
  const metrics = useMemo(() => {
    const totalProjectValue = allProjects.reduce((sum, q) => sum + (q.totalGross || 0), 0);

    const totalCompletionVariance = completedProjects.reduce((sum, q) => {
      const variance = q.materialVariances?.reduce((acc, mv) => acc + mv.variance, 0) || 0;
      return sum + variance;
    }, 0);

    const avgCostVariance = completedProjects.length > 0 ? totalCompletionVariance / completedProjects.length : 0;

    // On-time completion (estimate vs actual)
    const onTimeCount = completedProjects.filter(q => {
      if (!q.estimatedCompletionDate || !q.completedAt) return false;
      return new Date(q.completedAt) <= new Date(q.estimatedCompletionDate);
    }).length;

    const onTimePercentage = completedProjects.length > 0 ? (onTimeCount / completedProjects.length) * 100 : 0;

    return {
      totalProjects: allProjects.length,
      totalProjectValue,
      completedCount: completedProjects.length,
      avgCostVariance,
      onTimePercentage,
      totalCompletionVariance
    };
  }, [allProjects, completedProjects]);

  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-white font-bold">Access Denied</p>
          <p className="text-slate-400">Only super admins can view this page</p>
        </div>
      </div>
    );
  }

  if (!installer || installer.role !== 'INSTALLER') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-white font-bold">Installer Not Found</p>
          <Link href="/dashboard/installers">
            <button className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors">
              Back to Installers
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Get client name for a quote
  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Unknown Client';
    return clients?.find(c => c.id === clientId)?.name || 'Unknown Client';
  };

  const renderProjectCard = (project: Quote, index: number) => {
    const isExpanded = expandedProjectId === project.id;
    const clientName = getClientName(project.clientId);
    const isCompleted = !!project.completedAt;
    const isPendingAck = !project.acknowledgedAt && project.allocatedInstallerId;
    const variance = project.materialVariances?.reduce((sum, mv) => sum + mv.variance, 0) || 0;

    return (
      <div
        key={project.id}
        className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-emerald-500/50 transition-colors"
      >
        {/* Project Header */}
        <div
          onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
          className="p-6 cursor-pointer hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="text-lg font-bold text-white mb-1">{project.title || 'Untitled Project'}</h4>
              <p className="text-sm text-slate-400">{clientName}</p>
            </div>
            <span
              className={`text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap ml-4 ${phaseColors[project.phase || '']}`}
            >
              {phaseLabels[project.phase || '']}
            </span>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Amount</p>
              <p className="font-bold text-white">{project.totalGross?.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Items</p>
              <p className="font-bold text-white">{project.items?.length || 0}</p>
            </div>
            {isCompleted && (
              <div>
                <p className="text-slate-500 text-xs mb-1">Variance</p>
                <p className={`font-bold ${variance > 0 ? 'text-red-400' : variance < 0 ? 'text-green-400' : 'text-slate-300'}`}>
                  {variance > 0 ? '+' : ''}{variance.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
                </p>
              </div>
            )}
            {!isCompleted && project.estimatedCompletionDate && (
              <div>
                <p className="text-slate-500 text-xs mb-1">Est. Completion</p>
                <p className="font-bold text-white">{new Date(project.estimatedCompletionDate).toLocaleDateString('ro-RO')}</p>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {isPendingAck && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded flex items-center gap-1">
                <AlertCircle size={12} />
                Pending Acknowledgment
              </span>
            )}
            {isCompleted && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle size={12} />
                Completed on {new Date(project.completedAt!).toLocaleDateString('ro-RO')}
              </span>
            )}
            {project.acknowledgedAt && !isCompleted && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                Acknowledged on {new Date(project.acknowledgedAt).toLocaleDateString('ro-RO')}
              </span>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-slate-700 p-6 bg-slate-900/50 space-y-4">
            {/* Phase Timeline */}
            {project.phaseHistory && project.phaseHistory.length > 0 && (
              <div>
                <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  Phase Timeline
                </h5>
                <div className="space-y-2">
                  {project.phaseHistory.map((ph, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="w-32 flex-shrink-0">
                        <p className="text-slate-400">{new Date(ph.timestamp).toLocaleDateString('ro-RO')}</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold">{phaseLabels[ph.phase]}</p>
                        <p className="text-slate-500">by {ph.changedBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Job Completion Data */}
            {isCompleted && project.consumptionData && (
              <div>
                <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <BarChart3 size={16} className="text-slate-400" />
                  Material Consumption
                </h5>
                <div className="bg-slate-800 rounded p-3 max-h-48 overflow-y-auto text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 py-2 px-2">Item</th>
                        <th className="text-right text-slate-400 py-2 px-2">Quoted</th>
                        <th className="text-right text-slate-400 py-2 px-2">Consumed</th>
                        <th className="text-right text-slate-400 py-2 px-2">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.consumptionData.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50">
                          <td className="py-2 px-2 text-slate-300">{item.description}</td>
                          <td className="py-2 px-2 text-right text-white">{item.quotedQty}</td>
                          <td className="py-2 px-2 text-right text-white">{item.consumedQty}</td>
                          <td className={`py-2 px-2 text-right font-bold ${item.consumedQty > item.quotedQty ? 'text-red-400' : 'text-green-400'}`}>
                            {item.consumedQty - item.quotedQty > 0 ? '+' : ''}{item.consumedQty - item.quotedQty}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Completion Notes */}
            {isCompleted && project.completionNotes && (
              <div>
                <h5 className="text-sm font-bold text-white mb-2">Completion Notes</h5>
                <p className="text-xs text-slate-300 bg-slate-800 p-3 rounded">{project.completionNotes}</p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2 pt-4 border-t border-slate-700">
              <Link href={`/dashboard/clients/${project.clientId}`}>
                <button className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded transition-colors">
                  View Client
                </button>
              </Link>
              <button className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-colors">
                View Details
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
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
              <Briefcase size={32} className="text-emerald-500" />
              {installer.nickname}
            </h1>
            <p className="text-slate-400">@{installer.username}</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-sm font-semibold">Total Projects</p>
              <Briefcase size={24} className="text-blue-500 opacity-50" />
            </div>
            <p className="text-3xl font-bold text-white">{metrics.totalProjects}</p>
            <p className="text-xs text-slate-500 mt-2">
              {metrics.completedCount} completed • {activeProjects.length} active
            </p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-sm font-semibold">Total Project Value</p>
              <DollarSign size={24} className="text-green-500 opacity-50" />
            </div>
            <p className="text-3xl font-bold text-white">
              {(metrics.totalProjectValue / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}k RON
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Average: {(metrics.totalProjectValue / Math.max(metrics.totalProjects, 1) / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}k
            </p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-sm font-semibold">Avg. Cost Variance</p>
              <TrendingDown size={24} className={metrics.avgCostVariance > 0 ? 'text-red-500 opacity-50' : 'text-green-500 opacity-50'} />
            </div>
            <p className={`text-3xl font-bold ${metrics.avgCostVariance > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {metrics.avgCostVariance > 0 ? '+' : ''}{metrics.avgCostVariance.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {completedProjects.length} projects analyzed
            </p>
          </div>
        </div>

        {/* Pending Acknowledgments Alert */}
        {pendingAcknowledgement.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-400">Pending Acknowledgments</p>
              <p className="text-xs text-red-300">
                {pendingAcknowledgement.length} project(s) awaiting installer acknowledgment
              </p>
            </div>
          </div>
        )}

        {/* Active Projects */}
        {activeProjects.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={24} className="text-amber-500" />
              Active Projects ({activeProjects.length})
            </h2>
            <div className="space-y-4">
              {activeProjects.map((project, idx) => renderProjectCard(project, idx))}
            </div>
          </div>
        )}

        {/* Completed Projects */}
        {completedProjects.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle size={24} className="text-green-500" />
              Completed Projects ({completedProjects.length})
            </h2>
            <div className="space-y-4">
              {completedProjects.map((project, idx) => renderProjectCard(project, idx))}
            </div>
          </div>
        )}

        {allProjects.length === 0 && (
          <div className="text-center py-16 bg-slate-800/50 border border-slate-700 rounded-lg">
            <Briefcase size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-semibold">No projects assigned</p>
            <p className="text-xs text-slate-500">This installer has no allocated projects yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
