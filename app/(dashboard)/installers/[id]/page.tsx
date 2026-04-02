'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, BarChart3, Calendar, Briefcase, DollarSign, TrendingDown, MessageSquare, Send, Activity, CalendarDays } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { InstallerReport, Quote, ProjectPhase, TeamMessageThread } from '@/types';
import { isInstallerAssignedToQuote } from '@/lib/installerAssignments';

const phaseLabels: Record<ProjectPhase | '', string> = {
  'planning': 'Planning',
  'in-progress': 'In Progress',
  'pending-inspection': 'Pending Inspection',
  'completed': 'Completed',
  'archived': 'Archived',
  '': 'Unassigned'
};

const phaseColors: Record<ProjectPhase | '', string> = {
  'planning': 'bg-slate-500/20 text-slate-300',
  'in-progress': 'bg-purple-500/20 text-purple-300',
  'pending-inspection': 'bg-orange-500/20 text-orange-300',
  'completed': 'bg-green-500/20 text-green-300',
  'archived': 'bg-slate-600/20 text-slate-400',
  '': 'bg-slate-700/20 text-slate-400'
};

const getTimelineDayLabel = (value: Date) => {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('ro-RO', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function InstallerDetailPage() {
  const { currentUser } = useAuth();
  const { savedQuotes, users, clients, teamMessageThreads, installerReports, saveTeamMessageThread } = useData();
  const router = useRouter();
  const params = useParams();
  const installerId = params?.id as string;
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Find installer first (move before early return)
  const installer = users?.find(u => u.id === installerId);

  // Move all hooks before early return
  const allProjects = useMemo(() => {
    if (!installer) return [];
    return (savedQuotes || []).filter((quote) => isInstallerAssignedToQuote(quote, installer));
  }, [savedQuotes, installer]);

  const activeProjects = useMemo(() => allProjects.filter(q => !q.completedAt), [allProjects]);
  const completedProjects = useMemo(() => allProjects.filter(q => q.completedAt), [allProjects]);

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

  const messageThread = useMemo<TeamMessageThread | null>(() => {
    if (!installer) return null;
    return (teamMessageThreads || []).find((thread) => thread.installerId === installer.id) || null;
  }, [teamMessageThreads, installer]);

  const timelineMessages = useMemo(() => {
    return [...(messageThread?.messages || [])]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messageThread]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [timelineMessages]);

  const installerOwnReports = useMemo<InstallerReport[]>(() => {
    if (!installer) return [];
    return (installerReports || []).filter(
      (report) => report.installerId === installer.id || report.createdByNickname === installer.nickname
    );
  }, [installerReports, installer]);

  const installerActivity = useMemo(() => {
    if (!installer) return [];

    const projectEvents = allProjects.flatMap((project) => {
      const events: Array<{ id: string; createdAt: Date; title: string; detail: string; kind: 'accepted' | 'declared' }> = [];

      const acceptancePhase = (project.phaseHistory || []).find(
        (phase) => phase.phase === 'in-progress' && phase.changedBy?.toLowerCase().includes(installer.nickname.toLowerCase())
      );

      const acceptanceTimestamp = acceptancePhase?.timestamp
        || (project.consumptionDataUpdatedBy === installer.nickname ? project.consumptionDataUpdatedAt : undefined)
        || (project.installerDeclaredFinishedBy === installer.nickname ? project.installerDeclaredFinishedAt : undefined);

      if (acceptanceTimestamp) {
        events.push({
          id: `accepted-${project.id}`,
          createdAt: new Date(acceptanceTimestamp),
          title: 'Accepted a new project',
          detail: project.title || project.customerName,
          kind: 'accepted',
        });
      }

      if (project.installerDeclaredFinishedBy === installer.nickname && project.installerDeclaredFinishedAt) {
        const confirmation = project.adminApprovedAt
          ? `Admin confirmed on ${new Date(project.adminApprovedAt).toLocaleDateString('ro-RO')}`
          : 'Waiting for admin confirmation';

        events.push({
          id: `declared-${project.id}`,
          createdAt: new Date(project.installerDeclaredFinishedAt),
          title: 'Declared project as finished',
          detail: `${project.title || project.customerName} · ${confirmation}`,
          kind: 'declared',
        });
      }

      return events;
    });

    const reportEvents = installerOwnReports.map((report) => ({
      id: `report-${report.id}`,
      createdAt: new Date(report.createdAt),
      title: `Made a report for day (${report.type})`,
      detail: new Date(report.date).toLocaleDateString('ro-RO'),
      kind: 'report' as const,
    }));

    return [...projectEvents, ...reportEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [allProjects, installerOwnReports, installer]);

  useEffect(() => {
    if (!messageThread || !currentUser || currentUser.role !== 'SUPER_ADMIN') return;

    const hasUnreadInstallerMessages = messageThread.messages.some(
      (message) => message.senderRole === 'INSTALLER' && !message.readByAdmin
    );
    if (!hasUnreadInstallerMessages) return;

    const updatedThread: TeamMessageThread = {
      ...messageThread,
      messages: messageThread.messages.map((message) =>
        message.senderRole === 'INSTALLER' ? { ...message, readByAdmin: true } : message
      ),
      updatedAt: new Date(),
    };

    saveTeamMessageThread(updatedThread).catch((error) => {
      console.error('Failed to mark installer messages as read:', error);
    });
  }, [messageThread, currentUser, saveTeamMessageThread]);

  const handleSendAdminMessage = async () => {
    if (!installer) return;
    const content = adminMessage.trim();
    if (!content) return;

    setIsSendingMessage(true);
    try {
      const nextMessage = {
        id: `${Date.now()}`,
        senderRole: 'SUPER_ADMIN' as const,
        senderName: currentUser?.nickname || currentUser?.username || 'Admin',
        message: content,
        createdAt: new Date(),
        readByAdmin: true,
        readByInstaller: false,
      };

      const baseThread: TeamMessageThread = messageThread || {
        id: `team-${installer.id}`,
        installerId: installer.id,
        installerNickname: installer.nickname,
        updatedAt: new Date(),
        messages: [],
      };

      await saveTeamMessageThread({
        ...baseThread,
        installerNickname: installer.nickname,
        updatedAt: new Date(),
        messages: [nextMessage, ...baseThread.messages],
      });
      setAdminMessage('');
    } catch (error) {
      console.error('Failed to send message to installer:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

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
          <Link href="/installers">
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

  const renderProjectCard = (project: Quote) => {
    const isExpanded = expandedProjectId === project.id;
    const clientName = getClientName(project.clientId);
    const isCompleted = !!project.completedAt;
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
            {isCompleted && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle size={12} />
                Completed on {new Date(project.completedAt!).toLocaleDateString('ro-RO')}
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
              <Link href={`/clients/${project.clientId}`}>
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
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
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

          <Link href={`/installers/${installer.id}/reports`}>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
              <CalendarDays size={16} />
              Reports
            </button>
          </Link>
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

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <MessageSquare size={20} className="text-emerald-500" />
              Message
            </h2>
            <p className="text-sm text-slate-400">
              Leave a direct message for {installer.nickname}. They will see it under Notifications on their installer dashboard.
            </p>
          </div>

          <div className="h-[62vh] flex flex-col">
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-900/40">
              {timelineMessages.length === 0 ? (
                <p className="text-sm text-slate-500">No messages yet.</p>
              ) : (
                timelineMessages.map((message, index) => {
                  const currentDay = new Date(message.createdAt).toDateString();
                  const previousDay = index > 0 ? new Date(timelineMessages[index - 1].createdAt).toDateString() : null;
                  const showDaySeparator = currentDay !== previousDay;

                  return (
                    <React.Fragment key={message.id}>
                      {showDaySeparator && (
                        <div className="flex justify-center">
                          <span className="text-[11px] px-3 py-1 rounded-full bg-slate-700/70 text-slate-300 border border-slate-600">
                            {getTimelineDayLabel(new Date(message.createdAt))}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${message.senderRole === 'SUPER_ADMIN' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[82%] rounded-2xl px-3 py-2 border ${
                            message.senderRole === 'SUPER_ADMIN'
                              ? 'bg-sky-200 border-sky-300 text-slate-900 rounded-br-sm'
                              : 'bg-slate-900 border-slate-700 text-slate-100 rounded-bl-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                          <div className="mt-1.5 flex items-center justify-end gap-2">
                            <span className="text-[11px] opacity-80">{message.senderName}</span>
                            <span className="text-[11px] opacity-70">
                              {new Date(message.createdAt).toLocaleTimeString('ro-RO', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-700 p-4 bg-slate-800/80">
              <div className="flex gap-3 items-end">
                <textarea
                  value={adminMessage}
                  onChange={(event) => setAdminMessage(event.target.value)}
                  placeholder="Write an instruction, reminder, or question..."
                  className="flex-1 h-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />

                <button
                  onClick={handleSendAdminMessage}
                  disabled={isSendingMessage || !adminMessage.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg font-semibold transition-colors"
                >
                  <Send size={16} />
                  {isSendingMessage ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Activity size={20} className="text-blue-500" />
              Activity
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Timeline of installer actions. More activity types can be added later.
            </p>

            <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
              {installerActivity.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-sm text-slate-500">No activity yet for this installer.</p>
                </div>
              ) : (
                installerActivity.map((activityItem) => (
                  <div key={activityItem.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <p className="text-sm font-semibold text-white truncate">{activityItem.title}</p>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(activityItem.createdAt).toLocaleString('ro-RO', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{activityItem.detail}</p>
                  </div>
                ))
              )}
            </div>
        </div>

        {/* Active Projects */}
        {activeProjects.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={24} className="text-amber-500" />
              Active Projects ({activeProjects.length})
            </h2>
            <div className="space-y-4">
              {activeProjects.map((project) => renderProjectCard(project))}
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
              {completedProjects.map((project) => renderProjectCard(project))}
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
