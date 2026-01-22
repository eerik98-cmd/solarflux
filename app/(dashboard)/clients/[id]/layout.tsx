'use client';

import React from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Zap, FolderOpen, ClipboardList, FileCog } from 'lucide-react';
import { ClientProvider } from '@/contexts/ClientContext';
import { useData } from '@/contexts/DataContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { clients } = useData();
  const clientId = params.id as string;

  const client = clients.find(c => c.id === clientId);

  if (!client) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-slate-400">Client not found</p>
          <button
            onClick={() => router.push('/clients')}
            className="mt-4 text-amber-500 hover:text-amber-400"
          >
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'data', label: 'Client Data', icon: FileText, path: `/clients/${clientId}/data` },
    { id: 'needs', label: 'Needs & Calculation', icon: Zap, path: `/clients/${clientId}/needs` },
    { id: 'documents', label: 'Documents', icon: FolderOpen, path: `/clients/${clientId}/documents` },
    { id: 'quotes', label: 'Quotes', icon: ClipboardList, path: `/clients/${clientId}/quotes` },
    { id: 'doc-gen', label: 'Doc Generator', icon: FileCog, path: `/clients/${clientId}/doc-gen` },
  ];

  const activeTab = tabs.find(tab => pathname.startsWith(tab.path));

  return (
    <ClientProvider clientId={clientId}>
      <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/clients')}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{client.name}</h1>
              <p className="text-sm text-slate-400">
                {client.internalId} • {client.email} • {client.phone}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = pathname.startsWith(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </ClientProvider>
  );
}
