'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Bell, CheckCircle, Clock, Briefcase, TrendingUp, MessageSquare, Send, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TeamMessageThread } from '@/types';

const getTimelineDayLabel = (value: Date) => {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('ro-RO', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function InstallerMobileDashboard() {
  const { currentUser } = useAuth();
  const {
    savedQuotes,
    teamMessageThreads,
    saveTeamMessageThread,
    installerReports,
    installerReminders,
    saveInstallerReminder,
    markInstallerReminderRead,
  } = useData();
  const router = useRouter();
  const [replyMessage, setReplyMessage] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const myProjects = useMemo(() => {
    if (!currentUser) return [];
    return savedQuotes.filter(q => q.allocatedInstallerId === currentUser.nickname);
  }, [savedQuotes, currentUser]);

  const unfinishedProjects = useMemo(() => {
    return myProjects.filter(p => p.phase !== 'completed' && p.phase !== 'archived');
  }, [myProjects]);

  const inProgressProjects = useMemo(() => {
    return myProjects.filter(p => p.phase === 'in-progress');
  }, [myProjects]);

  const completedProjects = useMemo(() => {
    return myProjects.filter(p => p.phase === 'completed' || p.phase === 'archived' || !!p.adminApprovedAt);
  }, [myProjects]);

  const completedThisMonth = useMemo(() => {
    const now = new Date();
    return completedProjects.filter(p => {
      const src = p.adminApprovedAt || p.completedAt;
      if (!src) return false;
      const d = new Date(src);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [completedProjects]);

  const myThread = useMemo<TeamMessageThread | null>(() => {
    if (!currentUser) return null;
    return (
      teamMessageThreads.find(
        t => t.installerId === currentUser.id || t.installerNickname === currentUser.nickname
      ) || null
    );
  }, [teamMessageThreads, currentUser]);

  const unreadAdminMessages = useMemo(() => {
    return (myThread?.messages || []).filter(
      m => m.senderRole === 'SUPER_ADMIN' && !m.readByInstaller
    ).length;
  }, [myThread]);

  const timelineMessages = useMemo(() => {
    return [...(myThread?.messages || [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [myThread]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [timelineMessages, chatOpen]);

  useEffect(() => {
    if (!myThread || !currentUser || unreadAdminMessages === 0) return;
    const updated: TeamMessageThread = {
      ...myThread,
      messages: myThread.messages.map(m =>
        m.senderRole === 'SUPER_ADMIN' ? { ...m, readByInstaller: true } : m
      ),
      updatedAt: new Date(),
    };
    saveTeamMessageThread(updated).catch(console.error);
  }, [myThread, unreadAdminMessages, currentUser, saveTeamMessageThread]);

  const handleReplyToAdmin = async () => {
    if (!currentUser) return;
    const content = replyMessage.trim();
    if (!content) return;
    setIsSendingReply(true);
    try {
      const nextMessage = {
        id: `${Date.now()}`,
        senderRole: 'INSTALLER' as const,
        senderName: currentUser.nickname,
        message: content,
        createdAt: new Date(),
        readByAdmin: false,
        readByInstaller: true,
      };
      const base: TeamMessageThread = myThread || {
        id: `team-${currentUser.id}`,
        installerId: currentUser.id,
        installerNickname: currentUser.nickname,
        updatedAt: new Date(),
        messages: [],
      };
      await saveTeamMessageThread({
        ...base,
        installerNickname: currentUser.nickname,
        updatedAt: new Date(),
        messages: [nextMessage, ...base.messages],
      });
      setReplyMessage('');
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setIsSendingReply(false);
    }
  };

  const notifications = useMemo(() => {
    const notifs: Array<{
      id: string;
      type: 'PROJECT_ASSIGNED' | 'REMINDER';
      title: string;
      message: string;
      createdAt: Date;
      priority: 'low' | 'medium' | 'high';
      projectId?: string;
      clientId?: string;
    }> = [];

    unfinishedProjects.forEach(project => {
      notifs.push({
        id: `project-${project.id}`,
        type: 'PROJECT_ASSIGNED',
        title: 'Unfinished Project',
        message: `${project.title || project.customerName} — ${project.phase || 'planning'}`,
        createdAt: project.allocatedAt || new Date(),
        priority: project.phase === 'in-progress' ? 'high' : 'medium',
        projectId: project.id,
        clientId: project.clientId,
      });
    });

    const myReminders = (installerReminders || []).filter(
      r =>
        !!currentUser &&
        (r.installerId === currentUser.id || r.installerNickname === currentUser.nickname) &&
        !r.isReadByInstaller
    );
    myReminders.forEach(r => {
      notifs.push({
        id: `reminder-${r.id}`,
        type: 'REMINDER',
        title: 'Daily Report Reminder',
        message: r.message,
        createdAt: new Date(r.createdAt),
        priority: 'high',
        projectId: r.quoteId,
      });
    });

    return notifs.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [unfinishedProjects, installerReminders, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const now = new Date();
    if (now.getHours() < 20) return;
    const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();
    const missing = myProjects.filter(project => {
      if (project.phase !== 'in-progress') return false;
      return !(installerReports || []).some(r => {
        if (r.type !== 'daily') return false;
        const mine = r.installerId === currentUser.id || r.createdByNickname === currentUser.nickname;
        return mine && new Date(r.date).toDateString() === todayKey;
      });
    });
    missing.forEach(project => {
      const rid = `${currentUser.id}-${project.id}-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      if ((installerReminders || []).some(i => i.id === rid)) return;
      saveInstallerReminder({
        id: rid,
        installerId: currentUser.id,
        installerNickname: currentUser.nickname,
        quoteId: project.id,
        quoteTitle: project.title || project.customerName,
        reminderType: 'MISSING_DAILY_REPORT',
        reminderDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        createdAt: new Date(),
        createdBy: 'SYSTEM',
        message: `You still need a daily report for ${project.title || project.customerName} (${todayKey}).`,
        isReadByInstaller: false,
      }).catch(console.error);
    });
  }, [currentUser, myProjects, installerReports, installerReminders, saveInstallerReminder]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-500/10';
      case 'medium': return 'border-amber-500 bg-amber-500/10';
      default: return 'border-blue-500 bg-blue-500/10';
    }
  };

  const stats = [
    { label: 'Total', value: myProjects.length, icon: Briefcase, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Unfinished', value: unfinishedProjects.length, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'In Progress', value: inProgressProjects.length, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Completed', value: completedProjects.length, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  ];

  return (
    <div className="min-h-full bg-slate-900 px-4 pt-5 pb-4 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Hello, {currentUser?.nickname}!
        </h1>
        <p className="text-slate-400 text-sm mt-1">Your projects &amp; notifications</p>
      </div>

      {/* Stats 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
            <div className={`${bg} p-2 rounded-lg`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
          <Bell size={18} className="text-emerald-400" />
          <h2 className="font-bold text-white text-base flex-1">Notifications</h2>
          {notifications.length > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
              {notifications.length}
            </span>
          )}
        </div>

        {notifications.length > 0 ? (
          <div className="divide-y divide-slate-700">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`border-l-4 px-4 py-3 ${getPriorityColor(notif.priority)}`}
                onClick={() => {
                  if (notif.clientId) router.push(`/installer-mobile/clients/${notif.clientId}`);
                  else router.push('/installer-mobile/clients');
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{notif.title}</p>
                    <p className="text-slate-300 text-xs mt-0.5 leading-snug">{notif.message}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(notif.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      notif.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      notif.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {notif.priority.toUpperCase()}
                    </span>
                    {notif.type === 'REMINDER' && notif.id.startsWith('reminder-') && (
                      <button
                        className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-200 active:bg-slate-600"
                        onClick={e => {
                          e.stopPropagation();
                          markInstallerReminderRead(notif.id.replace('reminder-', '')).catch(console.error);
                        }}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle size={36} className="mx-auto mb-2 text-emerald-400" />
            <p className="text-slate-400 text-sm">All caught up!</p>
          </div>
        )}
      </div>

      {/* Admin Messages */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-4 py-3 border-b border-slate-700 text-left"
          onClick={() => setChatOpen(v => !v)}
        >
          <MessageSquare size={18} className="text-blue-400" />
          <h2 className="font-bold text-white text-base flex-1">Admin Messages</h2>
          {unreadAdminMessages > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
              {unreadAdminMessages} new
            </span>
          )}
          <ChevronRight size={16} className={`text-slate-400 transition-transform ${chatOpen ? 'rotate-90' : ''}`} />
        </button>

        {chatOpen && (
          <div className="p-4">
            <div ref={chatScrollRef} className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-3">
              {timelineMessages.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No messages yet.</p>
              ) : (
                timelineMessages.map((msg, index) => {
                  const currentDay = new Date(msg.createdAt).toDateString();
                  const previousDay = index > 0 ? new Date(timelineMessages[index - 1].createdAt).toDateString() : null;
                  const showSeparator = currentDay !== previousDay;
                  return (
                    <React.Fragment key={msg.id}>
                      {showSeparator && (
                        <div className="flex justify-center">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                            {getTimelineDayLabel(new Date(msg.createdAt))}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${msg.senderRole === 'INSTALLER' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 border text-sm ${
                          msg.senderRole === 'INSTALLER'
                            ? 'bg-sky-200 border-sky-300 text-slate-900 rounded-br-sm'
                            : 'bg-slate-900 border-slate-700 text-slate-100 rounded-bl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <span className="text-[10px] opacity-70">{msg.senderName}</span>
                            <span className="text-[10px] opacity-60">
                              {new Date(msg.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>
            <div className="flex gap-2 items-end">
              <textarea
                value={replyMessage}
                onChange={e => setReplyMessage(e.target.value)}
                placeholder="Reply to admin..."
                rows={2}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
              <button
                onClick={handleReplyToAdmin}
                disabled={isSendingReply || !replyMessage.trim()}
                className="h-10 w-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-xl transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 pb-2">
        <button
          onClick={() => router.push('/installer-mobile/clients')}
          className="bg-slate-800 border-2 border-slate-700 active:border-emerald-500 rounded-xl p-4 text-left transition-all"
        >
          <div className="p-2 bg-emerald-500/10 rounded-lg w-fit mb-2">
            <Briefcase size={20} className="text-emerald-400" />
          </div>
          <p className="font-bold text-white text-sm">Clients</p>
          <p className="text-xs text-slate-400">View projects</p>
        </button>
        <button
          onClick={() => router.push('/installer-mobile/reports')}
          className="bg-slate-800 border-2 border-slate-700 active:border-blue-500 rounded-xl p-4 text-left transition-all"
        >
          <div className="p-2 bg-blue-500/10 rounded-lg w-fit mb-2">
            <Clock size={20} className="text-blue-400" />
          </div>
          <p className="font-bold text-white text-sm">Reports</p>
          <p className="text-xs text-slate-400">Daily & time reports</p>
        </button>
      </div>
    </div>
  );
}
