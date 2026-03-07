'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Users, Briefcase, Clock3, Package, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { clients, savedQuotes, inventory } = useData();
  const { currentUser } = useAuth();

  const stats = useMemo(() => {
    const allQuotes = savedQuotes || [];
    const pendingInspection = allQuotes.filter(q => q.phase === 'pending-inspection').length;
    const activeProjects = allQuotes.filter(q => q.phase && !['completed', 'archived'].includes(q.phase)).length;

    return {
      clients: (clients || []).length,
      activeProjects,
      pendingInspection,
      inventoryItems: (inventory || []).length,
    };
  }, [clients, savedQuotes, inventory]);

  const installerFinishNotifications = useMemo(() => {
    const declared = (savedQuotes || []).filter((quote) => quote.installerDeclaredFinishedAt);
    const latestByProject = new Map<string, typeof declared[number]>();

    declared.forEach((quote) => {
      const key = `${quote.clientId || 'no-client'}::${(quote.title || '').trim().toLowerCase()}`;
      const existing = latestByProject.get(key);
      if (!existing) {
        latestByProject.set(key, quote);
        return;
      }

      const existingTs = new Date(existing.installerDeclaredFinishedAt as any).getTime();
      const currentTs = new Date(quote.installerDeclaredFinishedAt as any).getTime();
      if (currentTs > existingTs) {
        latestByProject.set(key, quote);
      }
    });

    return Array.from(latestByProject.values())
      .sort((a, b) => new Date(b.installerDeclaredFinishedAt as any).getTime() - new Date(a.installerDeclaredFinishedAt as any).getTime());
  }, [savedQuotes]);

  const installerMentionNotifications = useMemo(() => {
    return (savedQuotes || [])
      .flatMap((quote) => (quote.installerMentions || []).map((mention) => ({ quote, mention })))
      .sort((a, b) => new Date(b.mention.createdAt as any).getTime() - new Date(a.mention.createdAt as any).getTime());
  }, [savedQuotes]);

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <section>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-2">Welcome back, {currentUser?.nickname || 'User'}. Quick overview below.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Clients</p>
              <Users size={18} className="text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">{stats.clients}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Active Projects</p>
              <Briefcase size={18} className="text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">{stats.activeProjects}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Pending Inspection</p>
              <Clock3 size={18} className="text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">{stats.pendingInspection}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Inventory Items</p>
              <Package size={18} className="text-violet-400" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">{stats.inventoryItems}</p>
          </div>
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-amber-400" />
            <h2 className="text-lg font-bold text-white">Installer Finish Notifications</h2>
          </div>

          {installerFinishNotifications.length === 0 ? (
            <p className="text-slate-400 text-sm">No finish notifications yet.</p>
          ) : (
            <div className="space-y-2">
              {installerFinishNotifications.slice(0, 10).map((quote) => {
                const quoteClient = clients.find(c => c.id === quote.clientId);
                const isConfirmed = !!quote.adminApprovedAt || quote.phase === 'completed';
                return (
                  <button
                    key={quote.id}
                    onClick={() => router.push(`/clients/${quote.clientId}/installation`)}
                    className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                      isConfirmed
                        ? 'border-green-500/40 bg-green-500/10 hover:border-green-500/70'
                        : 'border-slate-700 bg-slate-900/70 hover:border-amber-500/60'
                    }`}
                  >
                    <p className="text-sm text-white">
                      <span className="font-bold text-amber-300">{quote.installerDeclaredFinishedBy || quote.allocatedInstallerId || 'Installer'}</span>{' '}
                      finished{' '}
                      <span className="font-bold">{quote.title || 'Untitled Project'}</span>{' '}
                      for{' '}
                      <span className="font-bold">{quoteClient?.name || quote.customerName}</span>.
                    </p>
                    {isConfirmed && (
                      <p className="text-xs text-green-300 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Successfully installed (admin confirmed)
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {quote.installerDeclaredFinishedAt ? new Date(quote.installerDeclaredFinishedAt).toLocaleString('ro-RO') : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-blue-400" />
            <h2 className="text-lg font-bold text-white">Installer Mentions</h2>
          </div>

          {installerMentionNotifications.length === 0 ? (
            <p className="text-slate-400 text-sm">No mentions from installers.</p>
          ) : (
            <div className="space-y-2">
              {installerMentionNotifications.slice(0, 10).map(({ quote, mention }) => {
                const quoteClient = clients.find(c => c.id === quote.clientId);
                return (
                  <button
                    key={`${quote.id}-${mention.id}`}
                    onClick={() => router.push(`/clients/${quote.clientId}/installation`)}
                    className="w-full text-left rounded-lg border border-slate-700 bg-slate-900/70 hover:border-blue-500/60 px-3 py-3 transition-colors"
                  >
                    <p className="text-sm text-white">
                      <span className="font-bold text-blue-300">{mention.createdBy || quote.allocatedInstallerId || 'Installer'}</span>{' '}
                      added a mention for project{' '}
                      <span className="font-bold">{quote.title || 'Untitled Project'}</span>{' '}
                      for{' '}
                      <span className="font-bold">{quoteClient?.name || quote.customerName}</span>.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{mention.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {mention.createdAt ? new Date(mention.createdAt).toLocaleString('ro-RO') : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
