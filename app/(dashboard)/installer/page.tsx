'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Bell, CheckCircle, Clock, Briefcase, TrendingUp, MessageSquare, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TeamMessageThread } from '@/types';
import { isInstallerAssignedToQuote } from '@/lib/installerAssignments';

const getTimelineDayLabel = (value: Date) => {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('ro-RO', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function InstallerDashboard() {
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

  // Get projects assigned to current installer
  const myProjects = useMemo(() => {
    if (!currentUser) return [];
    return savedQuotes.filter((quote) => isInstallerAssignedToQuote(quote, currentUser));
  }, [savedQuotes, currentUser]);

  // Unfinished projects (not completed)
  const unfinishedProjects = useMemo(() => {
    return myProjects.filter(p => p.phase !== 'completed' && p.phase !== 'archived');
  }, [myProjects]);

  // In progress projects
  const inProgressProjects = useMemo(() => {
    return myProjects.filter(p => p.phase === 'in-progress');
  }, [myProjects]);

  // Completed this month
  const completedProjects = useMemo(() => {
    return myProjects.filter(p => p.phase === 'completed' || p.phase === 'archived' || !!p.adminApprovedAt);
  }, [myProjects]);

  // Completed this month
  const completedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return completedProjects.filter(p => {
      const completionDateSource = p.adminApprovedAt || p.completedAt;
      if (!completionDateSource) return false;
      const completedDate = new Date(completionDateSource);
      return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
    });
  }, [completedProjects]);

  const myThread = useMemo<TeamMessageThread | null>(() => {
    if (!currentUser) return null;
    return (
      teamMessageThreads.find(
        (thread) => thread.installerId === currentUser.id || thread.installerNickname === currentUser.nickname
      ) || null
    );
  }, [teamMessageThreads, currentUser]);

  const unreadAdminMessages = useMemo(() => {
    return (myThread?.messages || []).filter(
      (message) => message.senderRole === 'SUPER_ADMIN' && !message.readByInstaller
    ).length;
  }, [myThread]);

  const timelineMessages = useMemo(() => {
    return [...(myThread?.messages || [])]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [myThread]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [timelineMessages]);

  useEffect(() => {
    if (!myThread || !currentUser) return;
    if (unreadAdminMessages === 0) return;

    const updatedThread: TeamMessageThread = {
      ...myThread,
      messages: myThread.messages.map((message) =>
        message.senderRole === 'SUPER_ADMIN' ? { ...message, readByInstaller: true } : message
      ),
      updatedAt: new Date(),
    };

    saveTeamMessageThread(updatedThread).catch((error) => {
      console.error('Failed to mark admin messages as read:', error);
    });
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

      const baseThread: TeamMessageThread = myThread || {
        id: `team-${currentUser.id}`,
        installerId: currentUser.id,
        installerNickname: currentUser.nickname,
        updatedAt: new Date(),
        messages: [],
      };

      await saveTeamMessageThread({
        ...baseThread,
        installerNickname: currentUser.nickname,
        updatedAt: new Date(),
        messages: [nextMessage, ...baseThread.messages],
      });

      setReplyMessage('');
    } catch (error) {
      console.error('Failed to send reply to admin:', error);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Project notifications
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

    // Add notification for each unfinished project
    unfinishedProjects.forEach(project => {
      notifs.push({
        id: `project-${project.id}`,
        type: 'PROJECT_ASSIGNED',
        title: 'Unfinished Project',
        message: `${project.title || project.customerName} - Phase: ${project.phase || 'planning'}`,
        createdAt: project.allocatedAt || new Date(),
        priority: project.phase === 'in-progress' ? 'high' : 'medium',
        projectId: project.id,
        clientId: project.clientId,
      });
    });

    const myReminders = (installerReminders || []).filter(
      (reminder) =>
        !!currentUser &&
        (reminder.installerId === currentUser.id || reminder.installerNickname === currentUser.nickname) &&
        !reminder.isReadByInstaller
    );

    myReminders.forEach((reminder) => {
      notifs.push({
        id: `reminder-${reminder.id}`,
        type: 'REMINDER',
        title: 'Daily Report Reminder',
        message: reminder.message,
        createdAt: new Date(reminder.createdAt),
        priority: 'high',
        projectId: reminder.quoteId,
      });
    });

    return notifs.sort((a, b) => {
      // Sort by priority then date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [unfinishedProjects, installerReminders, currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour < 20) return;

    const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();

    const missingReportProjects = myProjects.filter((project) => {
      if (project.phase === 'completed' || project.phase === 'archived') return false;

      if (project.phase !== 'in-progress') return false;

      const hasDailyReportToday = (installerReports || []).some((report) => {
        if (report.type !== 'daily') return false;
        const isMine = report.installerId === currentUser.id || report.createdByNickname === currentUser.nickname;
        if (!isMine) return false;
        return new Date(report.date).toDateString() === todayKey;
      });

      return !hasDailyReportToday;
    });

    missingReportProjects.forEach((project) => {
      const reminderId = `${currentUser.id}-${project.id}-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const exists = (installerReminders || []).some((item) => item.id === reminderId);
      if (exists) return;

      saveInstallerReminder({
        id: reminderId,
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
      }).catch((error) => {
        console.error('Failed to create reminder:', error);
      });
    });
  }, [currentUser, myProjects, installerReports, installerReminders, saveInstallerReminder]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PROJECT_ASSIGNED':
        return <Briefcase size={20} className="text-blue-400" />;
      case 'REMINDER':
        return <Clock size={20} className="text-red-400" />;
      default:
        return <Bell size={20} className="text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-500 bg-red-500/10';
      case 'medium':
        return 'border-amber-500 bg-amber-500/10';
      case 'low':
        return 'border-blue-500 bg-blue-500/10';
      default:
        return 'border-slate-700 bg-slate-900/50';
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {currentUser?.nickname}!
          </h1>
          <p className="text-slate-400">Here's an overview of your projects and notifications</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Projects */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <Briefcase size={24} className="text-emerald-400" />
              </div>
              <span className="text-3xl font-bold text-white">{myProjects.length}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-400">Total Projects</h3>
            <p className="text-xs text-slate-500 mt-1">All time assigned</p>
          </div>

          {/* Unfinished Projects */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Clock size={24} className="text-amber-400" />
              </div>
              <span className="text-3xl font-bold text-white">{unfinishedProjects.length}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-400">Unfinished</h3>
            <p className="text-xs text-slate-500 mt-1">Requires attention</p>
          </div>

          {/* In Progress */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <TrendingUp size={24} className="text-blue-400" />
              </div>
              <span className="text-3xl font-bold text-white">{inProgressProjects.length}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-400">In Progress</h3>
            <p className="text-xs text-slate-500 mt-1">Active installations</p>
          </div>

          {/* Completed This Month */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle size={24} className="text-green-400" />
              </div>
              <span className="text-3xl font-bold text-white">{completedProjects.length}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-400">Completed</h3>
            <p className="text-xs text-slate-500 mt-1">This month: {completedThisMonth.length}</p>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell size={24} className="text-emerald-500" />
            <h2 className="text-xl font-bold text-white">Notifications</h2>
            {notifications.length > 0 && (
              <span className="ml-auto px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm font-semibold rounded-full">
                {notifications.length}
              </span>
            )}
          </div>

          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`border-l-4 rounded-lg p-4 transition-all hover:bg-slate-700/50 cursor-pointer ${getPriorityColor(notif.priority)}`}
                  onClick={() => {
                    if (notif.clientId) {
                      router.push(`/installer/clients/${notif.clientId}`);
                    } else {
                      router.push('/installer/clients');
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getNotificationIcon(notif.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-white">{notif.title}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          notif.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          notif.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {notif.priority.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mt-1">{notif.message}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(notif.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {notif.type === 'REMINDER' && notif.id.startsWith('reminder-') && (
                        <button
                          className="mt-3 px-2.5 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                          onClick={(event) => {
                            event.stopPropagation();
                            const reminderId = notif.id.replace('reminder-', '');
                            markInstallerReminderRead(reminderId).catch((error) => {
                              console.error('Failed to mark reminder as read:', error);
                            });
                          }}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle size={48} className="mx-auto mb-3 text-emerald-400" />
              <p className="text-slate-400">No notifications</p>
              <p className="text-sm text-slate-500 mt-1">You're all caught up!</p>
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare size={24} className="text-blue-400" />
            <h2 className="text-xl font-bold text-white">Admin Messages</h2>
            {unreadAdminMessages > 0 && (
              <span className="ml-auto px-3 py-1 bg-amber-500/20 text-amber-400 text-sm font-semibold rounded-full">
                {unreadAdminMessages} unread
              </span>
            )}
          </div>

          <p className="text-sm text-slate-400 mb-4">
            Messages from admin appear here. You can reply directly from this card.
          </p>

          <div ref={chatScrollRef} className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {timelineMessages.length === 0 ? (
              <div className="text-center py-8 bg-slate-900/50 border border-slate-700 rounded-lg">
                <p className="text-slate-400">No admin messages yet.</p>
              </div>
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
                    <div className={`flex ${message.senderRole === 'INSTALLER' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3 py-2 border ${
                          message.senderRole === 'INSTALLER'
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

          <div className="mt-4 border-t border-slate-700 pt-4">
            <textarea
              value={replyMessage}
              onChange={(event) => setReplyMessage(event.target.value)}
              placeholder="Reply to admin..."
              className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            <button
              onClick={handleReplyToAdmin}
              disabled={isSendingReply || !replyMessage.trim()}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg font-semibold transition-colors"
            >
              <Send size={16} />
              {isSendingReply ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => router.push('/installer/clients')}
            className="bg-slate-800 border-2 border-slate-700 hover:border-emerald-500 rounded-lg p-6 text-left transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <Briefcase size={24} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                  View Clients
                </h3>
                <p className="text-sm text-slate-400">Browse assigned projects</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/installer/reports')}
            className="bg-slate-800 border-2 border-slate-700 hover:border-blue-500 rounded-lg p-6 text-left transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Clock size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                  Submit Reports
                </h3>
                <p className="text-sm text-slate-400">Daily, incident, and time reports</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
