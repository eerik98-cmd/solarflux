'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Search, User, MapPin, Phone, Mail, FileText, Eye, Briefcase } from 'lucide-react';
import Link from 'next/link';

export default function InstallerClientsPage() {
  const { clients, savedQuotes } = useData();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Check if installer has job assigned for a client
  const hasJobForClient = (clientId: string) => {
    return savedQuotes.some(quote => 
      quote.clientId === clientId && 
      quote.allocatedInstallerId === currentUser?.nickname &&
      quote.phase !== 'completed' &&
      quote.phase !== 'archived'
    );
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const lower = searchTerm.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.email.toLowerCase().includes(lower) ||
      c.phone.toLowerCase().includes(lower) ||
      c.needs?.siteCity?.toLowerCase().includes(lower)
    );
  }, [clients, searchTerm]);

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <User size={32} className="text-emerald-500" />
            Clients
          </h1>
          <p className="text-slate-400">View client information and project details (Read-only)</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={20} className="absolute left-4 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, location, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-slate-800/50 border border-slate-700 rounded-lg">
              <User size={48} className="text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No clients found</p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const hasJob = hasJobForClient(client.id);
              return (
                <Link key={client.id} href={`/installer/clients/${client.id}`}>
                  <div className="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-lg p-6 transition-all hover:shadow-lg hover:shadow-emerald-500/10 cursor-pointer group h-full relative">
                    {hasJob && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full border border-amber-500/50">
                        <Briefcase size={12} />
                        <span className="text-xs font-bold">Active Job</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors mb-1">
                          {client.name}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          client.type === 'PRIVATE' 
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {client.type}
                        </span>
                      </div>
                      <Eye size={20} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    </div>

                    <div className="space-y-2 text-sm">
                      {client.needs?.siteCity && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <MapPin size={14} className="text-slate-500" />
                          <span>{client.needs.siteCity}, {client.needs.siteCounty}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone size={14} className="text-slate-500" />
                        <span>{client.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Mail size={14} className="text-slate-500" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      {client.documents && client.documents.length > 0 && (
                        <div className="flex items-center gap-2 text-emerald-400 mt-3">
                          <FileText size={14} />
                          <span className="text-xs font-semibold">{client.documents.length} document(s)</span>
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
    </div>
  );
}
