'use client';

import React, { useMemo, useState } from 'react';
import { Users, Briefcase, CheckCircle, Clock, AlertCircle, ChevronRight, Search, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import Link from 'next/link';

export default function InstallersPage() {
  const { currentUser } = useAuth();
  const { savedQuotes, users, teamMessageThreads } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  // Get all installers
  const installers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => u.role === 'INSTALLER');
  }, [users]);

  // Calculate stats for each installer
  const installerStats = useMemo(() => {
    return installers.map(installer => {
      // Projects allocated to this installer
      const allocatedProjects = (savedQuotes || []).filter(
        q => q.allocatedInstallerId === installer.nickname
      );

      // Active projects (allocated but not completed)
      const activeProjects = allocatedProjects.filter(q => !q.completedAt);

      // Completed projects (has completedAt timestamp)
      const completedProjects = allocatedProjects.filter(q => q.completedAt);

      // Total project value
      const totalProjectValue = allocatedProjects.reduce((sum, q) => sum + (q.totalGross || 0), 0);

      // Average cost variance for completed projects
      let avgCostVariance = 0;
      if (completedProjects.length > 0) {
        const totalVariance = completedProjects.reduce((sum, q) => {
          const variance = q.materialVariances?.reduce((acc, mv) => acc + mv.variance, 0) || 0;
          return sum + variance;
        }, 0);
        avgCostVariance = totalVariance / completedProjects.length;
      }

      return {
        ...installer,
        allocatedProjects: allocatedProjects.length,
        activeProjects: activeProjects.length,
        completedProjects: completedProjects.length,
        totalProjectValue,
        avgCostVariance,
        status: activeProjects.length > 0 ? 'ASSIGNED' : completedProjects.length > 0 ? 'AVAILABLE' : 'AVAILABLE',
        unreadAdminMessages: (teamMessageThreads || [])
          .find((thread) => thread.installerId === installer.id)
          ?.messages.filter((message) => !message.readByAdmin && message.senderRole === 'INSTALLER').length || 0
      };
    });
  }, [installers, savedQuotes, teamMessageThreads]);

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

  // Filter installers by search term
  const filteredInstallers = useMemo(() => {
    if (!searchTerm) return installerStats;
    const lower = searchTerm.toLowerCase();
    return installerStats.filter(
      i => i.nickname.toLowerCase().includes(lower) || i.username.toLowerCase().includes(lower)
    );
  }, [installerStats, searchTerm]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalInstallers = installerStats.length;
    const assignedInstallers = installerStats.filter(i => i.status === 'ASSIGNED').length;
    const totalActiveJobs = installerStats.reduce((sum, i) => sum + i.activeProjects, 0);
    const totalCompletedJobs = installerStats.reduce((sum, i) => sum + i.completedProjects, 0);
    const unreadInstallerReplies = installerStats.reduce((sum, i) => sum + i.unreadAdminMessages, 0);

    return {
      totalInstallers,
      assignedInstallers,
      totalActiveJobs,
      totalCompletedJobs,
      unreadInstallerReplies
    };
  }, [installerStats]);

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <Users size={32} className="text-emerald-500" />
            Manage Team
          </h1>
          <p className="text-slate-400">View all registered installers, assignments, performance, and replies to admin messages</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-semibold mb-1">Total Installers</p>
                <p className="text-3xl font-bold text-white">{summaryStats.totalInstallers}</p>
              </div>
              <Users size={32} className="text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-semibold mb-1">Active Installers</p>
                <p className="text-3xl font-bold text-emerald-400">{summaryStats.assignedInstallers}</p>
              </div>
              <Briefcase size={32} className="text-emerald-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-semibold mb-1">Active Jobs</p>
                <p className="text-3xl font-bold text-amber-400">{summaryStats.totalActiveJobs}</p>
              </div>
              <Clock size={32} className="text-amber-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-semibold mb-1">Completed Jobs</p>
                <p className="text-3xl font-bold text-green-400">{summaryStats.totalCompletedJobs}</p>
              </div>
              <CheckCircle size={32} className="text-green-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-semibold mb-1">Unread Replies</p>
                <p className="text-3xl font-bold text-blue-400">{summaryStats.unreadInstallerReplies}</p>
              </div>
              <MessageSquare size={32} className="text-blue-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={20} className="absolute left-4 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by installer name or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Installers List */}
        <div className="space-y-4">
          {filteredInstallers.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg">
              <Users size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No installers found</p>
            </div>
          ) : (
            filteredInstallers.map(installer => (
              <Link
                key={installer.id}
                href={`/installers/${installer.id}`}
              >
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-emerald-500/50 transition-colors cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {installer.nickname}
                        </h3>
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            installer.status === 'ASSIGNED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {installer.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">@{installer.username}</p>
                    </div>
                    <ChevronRight size={24} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 rounded p-3">
                      <p className="text-xs text-slate-400 mb-1">Allocated</p>
                      <p className="text-xl font-bold text-white">{installer.allocatedProjects}</p>
                    </div>

                    <div className="bg-slate-900/50 rounded p-3">
                      <p className="text-xs text-slate-400 mb-1">Active</p>
                      <p className="text-xl font-bold text-amber-400">{installer.activeProjects}</p>
                    </div>

                    <div className="bg-slate-900/50 rounded p-3">
                      <p className="text-xs text-slate-400 mb-1">Completed</p>
                      <p className="text-xl font-bold text-green-400">{installer.completedProjects}</p>
                    </div>

                    <div className="bg-slate-900/50 rounded p-3">
                      <p className="text-xs text-slate-400 mb-1">Total Value</p>
                      <p className="text-xl font-bold text-blue-400">
                        {(installer.totalProjectValue / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 0 })}k
                      </p>
                    </div>

                    <div className="bg-slate-900/50 rounded p-3 col-span-2 md:col-span-4">
                      <p className="text-xs text-slate-400 mb-1">Communication</p>
                      <p className={`text-sm font-bold ${installer.unreadAdminMessages > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {installer.unreadAdminMessages > 0
                          ? `${installer.unreadAdminMessages} unread installer repl${installer.unreadAdminMessages === 1 ? 'y' : 'ies'}`
                          : 'No unread replies'}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
