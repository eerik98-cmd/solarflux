'use client';

import React, { useState } from 'react';
import { Installer } from '../types';
import { Wrench, Phone, Search, Plus, Trash2, X, Save } from 'lucide-react';

interface InstallerManagerProps {
  installers: Installer[];
  onAddInstaller: (installer: Installer) => void;
  onUpdateInstaller: (installer: Installer) => void;
  onDeleteInstaller: (id: string) => void;
}

export const InstallerManager: React.FC<InstallerManagerProps> = ({ 
  installers, onAddInstaller, onUpdateInstaller, onDeleteInstaller 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Installer>>({
    name: '', role: '', status: 'AVAILABLE', phone: '', currentSite: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleOpenAdd = () => {
    setFormData({ name: '', role: '', status: 'AVAILABLE', phone: '', currentSite: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role) return;

    if (formData.id) {
       onUpdateInstaller(formData as Installer);
    } else {
       onAddInstaller({
         ...formData,
         id: Date.now().toString(),
         status: formData.status || 'AVAILABLE'
       } as Installer);
    }
    setIsModalOpen(false);
  };

  const filteredInstallers = installers.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-slate-900 p-8 overflow-hidden">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Installers</h1>
          <p className="text-slate-400">Manage field teams and assignments</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus size={20} />
          Add Installer
        </button>
      </header>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col flex-1">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search installers..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Table/List */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-700 text-sm uppercase tracking-wider sticky top-0 bg-slate-900 z-10">
                <th className="p-4 font-semibold">Name & Role</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Current Assignment</th>
                <th className="p-4 font-semibold">Contact</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredInstallers.map(installer => (
                <tr key={installer.id} className="hover:bg-slate-700/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                        <Wrench size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-white">{installer.name}</div>
                        <div className="text-xs text-slate-500">{installer.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       {installer.status === 'AVAILABLE' && (
                         <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                           Available
                         </div>
                       )}
                       {installer.status === 'ASSIGNED' && (
                         <div className="flex items-center gap-2 text-amber-500 text-xs font-bold bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                           <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                           Assigned
                         </div>
                       )}
                       {installer.status === 'OFF_DUTY' && (
                         <div className="flex items-center gap-2 text-slate-500 text-xs font-bold bg-slate-700/50 px-2 py-1 rounded-full border border-slate-600">
                           <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                           Off Duty
                         </div>
                       )}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-300">
                    {installer.currentSite ? (
                      <span className="text-white font-medium">{installer.currentSite}</span>
                    ) : (
                      <span className="text-slate-600 italic">No active assignment</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-slate-500" />
                      {installer.phone}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setFormData(installer); setIsModalOpen(true); }}
                        className="text-sm font-medium text-amber-500 hover:text-amber-400 hover:underline p-2"
                      >
                        Edit
                      </button>
                      <button 
                         onClick={() => onDeleteInstaller(installer.id)}
                         className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                      >
                         <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                 <h2 className="text-xl font-bold text-white">{formData.id ? 'Edit' : 'Add'} Installer</h2>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Full Name</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Role</label>
                    <input required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="e.g. Lead Installer" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'AVAILABLE' | 'ASSIGNED' | 'OFF_DUTY'})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none">
                           <option value="AVAILABLE">Available</option>
                           <option value="ASSIGNED">Assigned</option>
                           <option value="OFF_DUTY">Off Duty</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Phone</label>
                        <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none" />
                    </div>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Current Assignment (Optional)</label>
                    <input value={formData.currentSite || ''} onChange={e => setFormData({...formData, currentSite: e.target.value})} placeholder="Project Name" className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-amber-500 outline-none" />
                 </div>
                 <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 flex items-center gap-2"><Save size={18} /> Save</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};