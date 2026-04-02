'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Search, User, MapPin, Phone, Mail, FileText, Briefcase, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';

export default function InstallerMobileClientsPage() {
  const { clients, savedQuotes } = useData();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const hasJobForClient = (clientId: string) => {
    return savedQuotes.some(
      q =>
        q.clientId === clientId &&
        q.allocatedInstallerId === currentUser?.nickname &&
        q.phase !== 'completed' &&
        q.phase !== 'archived'
    );
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const lower = searchTerm.toLowerCase();
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(lower) ||
        c.email.toLowerCase().includes(lower) ||
        c.phone.toLowerCase().includes(lower) ||
        c.needs?.siteCity?.toLowerCase().includes(lower)
    );
  }, [clients, searchTerm]);

  return (
    <div className="min-h-full bg-slate-900 pb-4">
      {/* Sticky header + search */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 pt-5 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <User size={22} className="text-emerald-500 shrink-0" />
          <h1 className="text-xl font-bold text-white">Clients</h1>
          <span className="ml-auto text-xs text-slate-500">{filteredClients.length} shown</span>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search name, location, email, phone…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 active:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Client list */}
      <div className="px-4 pt-3 space-y-3">
        {filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <User size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No clients found</p>
          </div>
        ) : (
          filteredClients.map(client => {
            const hasJob = hasJobForClient(client.id);
            return (
              <Link key={client.id} href={`/installer-mobile/clients/${client.id}`}>
                <div className="bg-slate-800 border border-slate-700 active:border-emerald-500/50 rounded-xl p-4 transition-colors">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-white truncate">{client.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          client.type === 'Private'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {client.type}
                        </span>
                        {hasJob && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold">
                            <Briefcase size={10} />
                            Active Job
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-slate-500 shrink-0 mt-1" />
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1.5">
                    {client.needs?.siteCity && (
                      <div className="flex items-center gap-2 text-slate-300 text-sm">
                        <MapPin size={13} className="text-slate-500 shrink-0" />
                        <span className="truncate">{client.needs.siteCity}, {client.needs.siteCounty}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-300 text-sm">
                      <Phone size={13} className="text-slate-500 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 text-sm">
                      <Mail size={13} className="text-slate-500 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.documents && client.documents.length > 0 && (
                      <div className="flex items-center gap-2 text-emerald-400 text-xs pt-1">
                        <FileText size={12} />
                        <span className="font-semibold">{client.documents.length} document(s)</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
