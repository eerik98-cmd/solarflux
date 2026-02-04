'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Bell, AlertCircle, CheckCircle, Clock, Briefcase, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function InstallerDashboard() {
  const { currentUser } = useAuth();
  const { savedQuotes } = useData();
  const router = useRouter();

  // Get projects assigned to current installer
  const myProjects = useMemo(() => {
    if (!currentUser) return [];
    return savedQuotes.filter(q => q.allocatedInstallerId === currentUser.nickname);
  }, [savedQuotes, currentUser]);

  // Unfinished projects (not completed)
  const unfinishedProjects = useMemo(() => {
    return myProjects.filter(p => p.phase !== 'completed' && p.phase !== 'archived');
  }, [myProjects]);

  // Pending acknowledgment
  const pendingAcknowledgment = useMemo(() => {
    return myProjects.filter(p => !p.acknowledgedAt && p.allocatedInstallerId === currentUser?.nickname);
  }, [myProjects, currentUser]);

  // In progress projects
  const inProgressProjects = useMemo(() => {
    return myProjects.filter(p => p.phase === 'in-progress');
  }, [myProjects]);

  // Completed this month
  const completedThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return myProjects.filter(p => {
      if (!p.completedAt) return false;
      const completedDate = new Date(p.completedAt);
      return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
    });
  }, [myProjects]);

  // Mock notifications (in production, these would come from database)
  const notifications = useMemo(() => {
    const notifs: Array<{
      id: string;
      type: 'PROJECT_ASSIGNED' | 'ADMIN_MESSAGE' | 'PROJECT_UPDATE';
      title: string;
      message: string;
      createdAt: Date;
      priority: 'low' | 'medium' | 'high';
      projectId?: string;
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
      });
    });

    // Add notification for pending acknowledgments
    pendingAcknowledgment.forEach(project => {
      notifs.push({
        id: `ack-${project.id}`,
        type: 'PROJECT_UPDATE',
        title: 'Acknowledgment Required',
        message: `Please acknowledge project: ${project.title || project.customerName}`,
        createdAt: project.allocatedAt || new Date(),
        priority: 'high',
        projectId: project.id,
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
  }, [unfinishedProjects, pendingAcknowledgment]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'PROJECT_ASSIGNED':
        return <Briefcase size={20} className="text-blue-400" />;
      case 'ADMIN_MESSAGE':
        return <Bell size={20} className="text-purple-400" />;
      case 'PROJECT_UPDATE':
        return <AlertCircle size={20} className="text-amber-400" />;
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
              <span className="text-3xl font-bold text-white">{completedThisMonth.length}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-400">Completed</h3>
            <p className="text-xs text-slate-500 mt-1">This month</p>
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
                    if (notif.projectId) {
                      router.push(`/installers/${currentUser?.nickname}`);
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
