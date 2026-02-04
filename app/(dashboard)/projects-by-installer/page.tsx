'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Search, MapPin, User, Phone, TrendingDown, Filter, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Quote } from '@/types';
import Link from 'next/link';

type ProjectFilter = 'all' | 'unassigned' | 'pending-ack' | 'active' | 'completed';

export default function ProjectsByInstallerPage() {
  const { currentUser } = useAuth();
  const { savedQuotes, clients, users } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('all');

  // Get all quotes and categorize them
  const categorizedProjects = useMemo(() => {
    const quotes = savedQuotes || [];

    const unassigned = quotes.filter(q => !q.allocatedInstallerId);
    const pendingAck = quotes.filter(q => q.allocatedInstallerId && !q.acknowledgedAt && !q.completedAt);
    const active = quotes.filter(q => q.acknowledgedAt && !q.completedAt);
    const completed = quotes.filter(q => q.completedAt);

    return {
      all: quotes,
      unassigned,
      'pending-ack': pendingAck,
      active,
      completed,
    };
  }, [savedQuotes]);

  // Filter projects based on selected filter and search term
  const filteredProjects = useMemo(() => {
    let projects = categorizedProjects[filter];

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      projects = projects.filter(q => {
        const clientName = clients?.find(c => c.id === q.clientId)?.name || '';
        return (
          q.title?.toLowerCase().includes(lower) ||
          clientName.toLowerCase().includes(lower) ||
          q.allocatedInstallerId?.toLowerCase().includes(lower) ||
          q.customerName.toLowerCase().includes(lower)
        );
      });
    }

    return projects;
  }, [categorizedProjects, filter, searchTerm, clients]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: categorizedProjects.all.length,
      unassigned: categorizedProjects.unassigned.length,
      pendingAck: categorizedProjects['pending-ack'].length,
      active: categorizedProjects.active.length,
      completed: categorizedProjects.completed.length,
    };
  }, [categorizedProjects]);

  const getClientInfo = (clientId?: string) => {
    return clients?.find(c => c.id === clientId);
  };

  const getInstallerInfo = (nickname?: string) => {
    return users?.find(u => u.nickname === nickname);
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

  const renderProjectRow = (project: Quote) => {
    const client = getClientInfo(project.clientId);
    const installer = getInstallerInfo(project.allocatedInstallerId);
    const variance = project.materialVariances?.reduce((sum, mv) => sum + mv.variance, 0) || 0;

    const getStatusBadge = () => {
      if (project.completedAt) {
        return <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-semibold">Completed</span>;
      }
      if (project.acknowledgedAt) {
        return <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-semibold">In Progress</span>;
      }
      if (project.allocatedInstallerId) {
        return <span className="text-xs bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full font-semibold">Pending ACK</span>;
      }
      return <span className="text-xs bg-slate-500/20 text-slate-300 px-3 py-1 rounded-full font-semibold">Unassigned</span>;
    };

    return (
      <div key={project.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Project Info */}
          <div className="md:col-span-3">
            <Link href={`/dashboard/clients/${project.clientId}`}>
              <div className="hover:cursor-pointer">
                <h4 className="font-bold text-white hover:text-emerald-400 transition-colors truncate">
                  {project.title || 'Untitled'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">{client?.name || 'Unknown'}</p>
              </div>
            </Link>
          </div>

          {/* Installer Info */}
          <div className="md:col-span-2">
            {installer ? (
              <Link href={`/dashboard/installers/${installer.id}`}>
                <div className="hover:cursor-pointer">
                  <p className="text-sm font-semibold text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2">
                    <User size={14} />
                    {installer.nickname}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">@{installer.username}</p>
                </div>
              </Link>
            ) : (
              <div className="text-xs text-slate-500 italic">Not assigned</div>
            )}
          </div>

          {/* Status */}
          <div className="md:col-span-2">
            {getStatusBadge()}
          </div>

          {/* Location */}
          <div className="md:col-span-2 text-sm">
            <p className="text-slate-300 flex items-center gap-1">
              <MapPin size={14} className="text-slate-500" />
              {client?.needs?.siteCity || 'N/A'}
            </p>
            <p className="text-xs text-slate-500 mt-1">{client?.needs?.siteCounty || ''}</p>
          </div>

          {/* Value & Variance */}
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-white">
              {project.totalGross?.toLocaleString('ro-RO', { maximumFractionDigits: 0 }) || '0'} RON
            </p>
            {project.completedAt && variance !== 0 && (
              <p className={`text-xs mt-1 font-semibold ${variance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {variance > 0 ? '+' : ''}{(variance / 1000).toFixed(1)}k variance
              </p>
            )}
          </div>

          {/* Action */}
          <div className="md:col-span-1 flex justify-end">
            {installer ? (
              <Link href={`/dashboard/installers/${installer.id}`}>
                <button className="p-2 rounded-lg transition-colors hover:bg-slate-700 text-slate-400 hover:text-emerald-400">
                  <ChevronRight size={20} />
                </button>
              </Link>
            ) : (
              <button disabled className="p-2 rounded-lg text-slate-600 cursor-not-allowed">
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2 flex-wrap">
          {!project.allocatedInstallerId && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded flex items-center gap-1">
              <AlertCircle size={12} />
              No installer assigned
            </span>
          )}
          {project.allocatedInstallerId && !project.acknowledgedAt && !project.completedAt && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded flex items-center gap-1">
              <AlertCircle size={12} />
              Waiting for acknowledgment
            </span>
          )}
          {project.completedAt && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1">
              <CheckCircle size={12} />
              Completed {new Date(project.completedAt).toLocaleDateString('ro-RO')}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <Clock size={32} className="text-emerald-500" />
            Projects by Installer
          </h1>
          <p className="text-slate-400">Overview of all projects and their installer assignments</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className={`rounded-lg p-4 border cursor-pointer transition-all ${filter === 'all' ? 'bg-slate-800 border-emerald-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
            onClick={() => setFilter('all')}>
            <p className="text-slate-400 text-xs font-semibold mb-1">Total</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>

          <div className={`rounded-lg p-4 border cursor-pointer transition-all ${filter === 'unassigned' ? 'bg-slate-800 border-red-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
            onClick={() => setFilter('unassigned')}>
            <p className="text-slate-400 text-xs font-semibold mb-1">Unassigned</p>
            <p className={`text-2xl font-bold ${stats.unassigned > 0 ? 'text-red-400' : 'text-white'}`}>{stats.unassigned}</p>
          </div>

          <div className={`rounded-lg p-4 border cursor-pointer transition-all ${filter === 'pending-ack' ? 'bg-slate-800 border-yellow-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
            onClick={() => setFilter('pending-ack')}>
            <p className="text-slate-400 text-xs font-semibold mb-1">Pending ACK</p>
            <p className={`text-2xl font-bold ${stats.pendingAck > 0 ? 'text-yellow-400' : 'text-white'}`}>{stats.pendingAck}</p>
          </div>

          <div className={`rounded-lg p-4 border cursor-pointer transition-all ${filter === 'active' ? 'bg-slate-800 border-blue-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
            onClick={() => setFilter('active')}>
            <p className="text-slate-400 text-xs font-semibold mb-1">Active</p>
            <p className="text-2xl font-bold text-blue-400">{stats.active}</p>
          </div>

          <div className={`rounded-lg p-4 border cursor-pointer transition-all ${filter === 'completed' ? 'bg-slate-800 border-green-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
            onClick={() => setFilter('completed')}>
            <p className="text-slate-400 text-xs font-semibold mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
          </div>
        </div>

        {/* Critical Alerts */}
        {stats.unassigned > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-400">{stats.unassigned} Project(s) Not Assigned</p>
              <p className="text-xs text-red-300">These projects need to be allocated to an installer</p>
            </div>
          </div>
        )}

        {stats.pendingAck > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-400">{stats.pendingAck} Project(s) Awaiting Acknowledgment</p>
              <p className="text-xs text-yellow-300">Installers need to review and acknowledge these assignments</p>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex gap-4 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search by project, client, installer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* Projects Table */}
        <div className="space-y-4">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg">
              <AlertCircle size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-semibold">
                {searchTerm ? 'No projects match your search' : 'No projects in this category'}
              </p>
            </div>
          ) : (
            filteredProjects.map(project => renderProjectRow(project))
          )}
        </div>

        {/* Summary */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-400 mb-1">Total Project Value</p>
              <p className="text-xl font-bold text-emerald-400">
                {categorizedProjects.all.reduce((sum, q) => sum + (q.totalGross || 0), 0).toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
              </p>
            </div>
            <div>
              <p className="text-slate-400 mb-1">Active Project Value</p>
              <p className="text-xl font-bold text-blue-400">
                {categorizedProjects.active.reduce((sum, q) => sum + (q.totalGross || 0), 0).toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })}
              </p>
            </div>
            <div>
              <p className="text-slate-400 mb-1">Completion Rate</p>
              <p className="text-xl font-bold text-green-400">
                {categorizedProjects.all.length > 0 ? Math.round((stats.completed / categorizedProjects.all.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
