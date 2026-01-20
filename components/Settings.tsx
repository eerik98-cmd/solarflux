

import React, { useState } from 'react';
import { User, UserRole, DocTemplate } from '../types';
import { Shield, UserPlus, Trash2, FileText, Upload, Save, CheckCircle, Users, Wrench, Package, Info } from 'lucide-react';

interface SettingsProps {
  currentUser: User;
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  docTemplates: DocTemplate[];
  onAddTemplate: (template: DocTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  currentUser, users, onAddUser, onDeleteUser,
  docTemplates, onAddTemplate, onDeleteTemplate
}) => {
  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'TEMPLATES'>('ACCOUNTS');

  // User Form State
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'INSTALLER' });

  // Template Form State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.nickname) return;
    
    onAddUser({
      id: Date.now().toString(),
      username: newUser.username,
      password: newUser.password,
      nickname: newUser.nickname,
      role: newUser.role as UserRole
    });
    setNewUser({ role: 'INSTALLER', username: '', password: '', nickname: '' });
  };

  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTemplateFile(e.target.files[0]);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateFile || !newTemplateName) return;

    const reader = new FileReader();
    reader.onload = () => {
      onAddTemplate({
        id: Date.now().toString(),
        name: newTemplateName,
        content: reader.result as string,
        date: new Date()
      });
      setTemplateFile(null);
      setNewTemplateName('');
    };
    reader.readAsDataURL(templateFile);
  };

  const ROLE_DEFINITIONS = [
    {
      role: 'SUPER_ADMIN',
      label: 'Super Admin',
      icon: Shield,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      permissions: [
        'Full system access & configuration',
        'Create/Delete User Accounts',
        'Manage Document Templates',
        'Irreversible data deletion rights'
      ]
    },
    {
      role: 'WAREHOUSEMAN',
      label: 'Warehouseman',
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      permissions: [
        'Add/Edit Inventory Items',
        'Manage Serial Numbers',
        'View Client Registry',
        'Cannot manage Users or Settings'
      ]
    },
    {
      role: 'INSTALLER',
      label: 'Installer',
      icon: Wrench,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      permissions: [
        'View Inventory (Read Only)',
        'View Client Details & Jobs',
        'Upload Site Pictures',
        'Restricted from financial data'
      ]
    }
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900 p-8 overflow-hidden">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">System configuration and administration</p>
      </header>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('ACCOUNTS')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'ACCOUNTS' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <Users size={20} /> Accounts
        </button>
        <button 
          onClick={() => setActiveTab('TEMPLATES')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'TEMPLATES' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <FileText size={20} /> Document Templates
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-800 rounded-2xl border border-slate-700 p-6">
        
        {activeTab === 'ACCOUNTS' && (
          <div className="max-w-4xl space-y-10">
            {currentUser.role !== 'SUPER_ADMIN' ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Shield size={48} className="mb-4 text-red-500" />
                <h2 className="text-xl font-bold text-white">Restricted Access</h2>
                <p>Only Super Admins can manage accounts.</p>
              </div>
            ) : (
              <>
                <div className="space-y-8">
                  {/* Create User Form */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <UserPlus size={20} className="text-emerald-500" /> Create New Account
                    </h3>
                    <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
                        <input 
                          required
                          value={newUser.username || ''}
                          onChange={e => setNewUser({...newUser, username: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                        <input 
                          required
                          type="text"
                          value={newUser.password || ''}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Nickname</label>
                        <input 
                          required
                          value={newUser.nickname || ''}
                          onChange={e => setNewUser({...newUser, nickname: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                        <select 
                          value={newUser.role}
                          onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                        >
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="WAREHOUSEMAN">Warehouseman</option>
                          <option value="INSTALLER">Installer</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 flex justify-end mt-2">
                        <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors">
                          Create Account
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Users List */}
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4">Active Accounts</h3>
                    <div className="space-y-2">
                      {users.map(user => (
                        <div key={user.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-900 ${
                               user.role === 'SUPER_ADMIN' ? 'bg-amber-500' :
                               user.role === 'WAREHOUSEMAN' ? 'bg-blue-500' : 'bg-emerald-500'
                             }`}>
                               {user.nickname.charAt(0).toUpperCase()}
                             </div>
                             <div>
                               <div className="font-bold text-white">{user.nickname}</div>
                               <div className="text-xs text-slate-500 flex gap-2">
                                 <span>@{user.username}</span>
                                 <span className="text-slate-600">•</span>
                                 <span className="uppercase">{user.role.replace('_', ' ')}</span>
                               </div>
                             </div>
                          </div>
                          {user.id !== currentUser.id && (
                            <button 
                              onClick={() => onDeleteUser(user.id)}
                              className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Role Reference Section */}
                <div className="border-t border-slate-700 pt-8">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Info size={20} className="text-slate-400" />
                    Role Permissions Reference
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {ROLE_DEFINITIONS.map((def) => (
                      <div key={def.role} className={`bg-slate-900 border rounded-xl p-5 ${def.borderColor}`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-2 rounded-lg ${def.bgColor} ${def.color}`}>
                            <def.icon size={20} />
                          </div>
                          <h4 className="font-bold text-white text-sm uppercase tracking-wide">{def.label}</h4>
                        </div>
                        <ul className="space-y-2">
                          {def.permissions.map((perm, idx) => (
                            <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${def.color.replace('text-', 'bg-')}`}></span>
                              {perm}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'TEMPLATES' && (
           <div className="max-w-4xl space-y-8">
              <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Upload size={20} className="text-amber-500" /> Upload New Template
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Template Name</label>
                      <input 
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="e.g. Standard Contract 2024"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-white mt-1 focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Select File (.docx)</label>
                      <input 
                        type="file" 
                        accept=".docx"
                        onChange={handleTemplateFileChange}
                        className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 transition-all"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                       <button 
                        onClick={handleSaveTemplate}
                        disabled={!templateFile || !newTemplateName}
                        className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                      >
                         <Save size={18} /> Save Template
                      </button>
                    </div>
                  </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4">Saved Templates</h3>
                {docTemplates.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                    No templates uploaded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {docTemplates.map(template => (
                      <div key={template.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between group">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                               <FileText size={20} />
                            </div>
                            <div>
                               <div className="font-bold text-white">{template.name}</div>
                               <div className="text-xs text-slate-500">Uploaded {new Date(template.date).toLocaleDateString()}</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-500" />
                            <button 
                              onClick={() => onDeleteTemplate(template.id)}
                              className="p-2 text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                               <Trash2 size={18} />
                            </button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};