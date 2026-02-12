'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, DocTemplate, SmtpSettings, EmailTemplate, EmailTemplateCategory } from '../types';
import { Shield, UserPlus, Trash2, FileText, Upload, Save, CheckCircle, Users, Wrench, Package, Info, Mail, Send, Edit, Plus, X, FileEdit } from 'lucide-react';
import mammoth from 'mammoth';
import { createDefaultTemplate, getAvailableVariablesForCategory } from '../lib/emailTemplateUtils';
import EmailTemplateEditor from './EmailTemplateEditor';
import NovelEditor from './NovelEditor';
import type { Editor } from '@tiptap/react';

interface SettingsProps {
  currentUser: User;
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  docTemplates: DocTemplate[];
  onAddTemplate: (template: DocTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onUpdateTemplate?: (id: string, updates: Partial<DocTemplate>) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  currentUser, users, onAddUser, onDeleteUser,
  docTemplates, onAddTemplate, onDeleteTemplate, onUpdateTemplate
}) => {
  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'TEMPLATES' | 'EMAIL'>('ACCOUNTS');

  // User Form State
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'INSTALLER' });

  // Template Form State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDocTemplate, setEditingDocTemplate] = useState<DocTemplate | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editingDocContent, setEditingDocContent] = useState<DocTemplate | null>(null);
  const [editingDocLoading, setEditingDocLoading] = useState(false);

  // SMTP Settings State
  const [smtpSettings, setSmtpSettings] = useState<Partial<SmtpSettings>>({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'SolarFlux',
    replyTo: '',
    signature: '',
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaveStatus, setSmtpSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [testingConnection, setTestingConnection] = useState(false);

  // Email Template State
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Signature State
  const [signatureMode, setSignatureMode] = useState<'editor' | 'html'>('editor');
  const [signatureHtmlSource, setSignatureHtmlSource] = useState('');
  const [signatureContent, setSignatureContent] = useState('');
  const signatureEditorRef = useRef<Editor | null>(null);

  // Document Content State
  const [docContent, setDocContent] = useState('');
  const docContentEditorRef = useRef<Editor | null>(null);

  // Fix Password State
  const [fixingPasswordUserId, setFixingPasswordUserId] = useState<string | null>(null);
  const [fixPasswordValue, setFixPasswordValue] = useState('');

  // Signature file input ref
  const signatureFileInputRef = React.useRef<HTMLInputElement>(null);

  // Check if password needs hashing (doesn't start with $2 bcrypt prefix)
  const needsPasswordFix = (password: string) => !password.startsWith('$2');

  // Handle fixing unhashed passwords
  const handleFixPassword = async (userId: string, user: User) => {
    if (!fixPasswordValue) {
      alert('Please enter a new password');
      return;
    }

    try {
      const response = await fetch('/api/admin/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fix-password',
          userId,
          user: { ...user, password: fixPasswordValue },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fix password');
      }

      alert('Password hashed successfully!');
      setFixingPasswordUserId(null);
      setFixPasswordValue('');
    } catch (error) {
      console.error('Error fixing password:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.nickname) {
      alert('Please fill in all fields');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onAddUser({
        id: Date.now().toString(),
        username: newUser.username,
        password: newUser.password,
        nickname: newUser.nickname,
        role: newUser.role as UserRole
      });
      setNewUser({ role: 'INSTALLER', username: '', password: '', nickname: '' });
      alert('User created successfully!');
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
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

  // Handle opening document content editor
  const handleEditDocContent = async (template: DocTemplate) => {
    setEditingDocContent(template);
    setEditingDocLoading(true);
    
    try {
      // Check if content is a data URL
      if (!template.content || typeof template.content !== 'string') {
        throw new Error('Invalid template content - no content found');
      }

      // Handle different content types
      if (template.content.startsWith('<')) {
        // Plain HTML content (not a data URL)
        setDocContent(template.content);
      } else if (template.content.startsWith('data:text/html')) {
        // HTML content stored from previous edits
        const base64Data = template.content.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid HTML content - no base64 data');
        }
        const htmlContent = atob(base64Data);
        setDocContent(htmlContent);
      } else if (
        template.content.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
        template.content.startsWith('data:application/msword')
      ) {
        // DOCX or DOC content
        const base64Data = template.content.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid Word document - no base64 data');
        }
        
        try {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const arrayBuffer = bytes.buffer;
          
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setDocContent(result.value || '<p>Document loaded but appears empty</p>');
          
          if (result.messages && result.messages.length > 0) {
            console.warn('Document conversion warnings:', result.messages);
          }
        } catch (conversionError) {
          console.error('DOCX/DOC conversion error:', conversionError);
          throw new Error('Failed to convert Word document to HTML. Please ensure the file is a valid .docx or .doc file.');
        }
      } else {
        // Detect the MIME type from the data URL
        const mimeMatch = template.content.match(/^data:([^;,]+)/);
        const detectedType = mimeMatch ? mimeMatch[1] : 'unknown';
        throw new Error(`Unsupported content format: ${detectedType}. Only HTML and Word documents (.docx, .doc) are supported for editing.`);
      }
    } catch (error) {
      console.error('Error loading document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to load document content:\n\n${errorMessage}\n\nPlease try uploading the document again or contact support if the issue persists.`);
      setEditingDocContent(null);
    } finally {
      setEditingDocLoading(false);
    }
  };

  // Handle saving document content
  const handleSaveDocContent = () => {
    if (!editingDocContent || !onUpdateTemplate) return;
    
    // Get the HTML content from the editor
    const htmlContent = docContentEditorRef.current?.getHTML() || docContent;
    
    // For now, we'll store the HTML content
    // In a production environment, you might want to convert it back to DOCX
    const dataUrl = `data:text/html;base64,${btoa(htmlContent)}`;
    
    onUpdateTemplate(editingDocContent.id, { content: dataUrl });
    setEditingDocContent(null);
  };

  // Handle HTML file upload for signature
  const handleSignatureFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an HTML file
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('Please upload an HTML file (.html or .htm)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const htmlContent = e.target?.result as string;
      if (htmlContent) {
        setSignatureHtmlSource(htmlContent);
        // Switch to HTML mode when uploading
        setSignatureMode('html');
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    if (signatureFileInputRef.current) {
      signatureFileInputRef.current.value = '';
    }
  };

  // Load SMTP settings on EMAIL tab mount
  useEffect(() => {
    if (activeTab === 'EMAIL') {
      loadSmtpSettings();
    }
  }, [activeTab]);

  // Load email templates on TEMPLATES tab mount
  useEffect(() => {
    if (activeTab === 'TEMPLATES') {
      loadEmailTemplates();
    }
  }, [activeTab]);

  const loadEmailTemplates = async () => {
    setEmailTemplatesLoading(true);
    try {
      const response = await fetch('/api/settings/email-templates');
      if (response.ok) {
        const data = await response.json();
        setEmailTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load email templates:', error);
    } finally {
      setEmailTemplatesLoading(false);
    }
  };

  const handleSaveEmailTemplate = async (template: EmailTemplate) => {
    try {
      const response = await fetch('/api/settings/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          updatedBy: currentUser.username,
          updatedAt: new Date(),
        }),
      });

      if (response.ok) {
        await loadEmailTemplates();
        setShowTemplateModal(false);
        setEditingTemplate(null);
        alert('Email template saved successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to save template: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save email template:', error);
      alert('Failed to save email template');
    }
  };

  const handleDeleteEmailTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/email-templates/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadEmailTemplates();
        alert('Template deleted successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to delete template: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete email template:', error);
      alert('Failed to delete template');
    }
  };

  const loadSmtpSettings = async () => {
    setSmtpLoading(true);
    try {
      const response = await fetch('/api/settings/smtp');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSmtpSettings({
            ...data.settings,
            password: '', // Don't show encrypted password
          });
          // Load signature into both modes
          if (data.settings.signature) {
            setSignatureHtmlSource(data.settings.signature);
            setSignatureContent(data.settings.signature);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load SMTP settings:', error);
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSaveSmtpSettings = async () => {
    if (!smtpSettings.host || !smtpSettings.username || !smtpSettings.fromEmail) {
      alert('Please fill in all required fields');
      return;
    }

    setSmtpSaveStatus('saving');
    try {
      // Get signature from the active mode
      const signatureHtml = signatureMode === 'html' 
        ? signatureHtmlSource 
        : (signatureEditorRef.current?.getHTML() || signatureContent);
      
      const response = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...smtpSettings,
          signature: signatureHtml,
          updatedBy: currentUser.username,
        }),
      });

      if (response.ok) {
        setSmtpSaveStatus('success');
        setTimeout(() => setSmtpSaveStatus('idle'), 2000);
      } else {
        const error = await response.json();
        alert(`Failed to save SMTP settings: ${error.error}`);
        setSmtpSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save SMTP settings:', error);
      alert('Failed to save SMTP settings');
      setSmtpSaveStatus('error');
    }
  };

  const handleTestSmtpConnection = async () => {
    if (!smtpSettings.host || !smtpSettings.username) {
      alert('Please configure SMTP settings first');
      return;
    }

    setTestingConnection(true);
    try {
      const response = await fetch('/api/settings/smtp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpSettings),
      });

      const result = await response.json();
      if (response.ok) {
        alert(`✅ Connection successful!\n\n${result.message}`);
      } else {
        alert(`❌ Connection failed:\n\n${result.error}`);
      }
    } catch (error) {
      console.error('Failed to test SMTP connection:', error);
      alert('Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
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
        <button 
          onClick={() => setActiveTab('EMAIL')}
          className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${activeTab === 'EMAIL' ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <Mail size={20} /> Email Settings
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
                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className={`font-bold px-6 py-2 rounded-lg transition-colors ${isSubmitting ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900'}`}
                        >
                          {isSubmitting ? 'Creating...' : 'Create Account'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Users List */}
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4">Active Accounts</h3>
                    <div className="space-y-2">
                      {users.map(user => (
                        <div key={user.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-900 ${
                                 user.role === 'SUPER_ADMIN' ? 'bg-amber-500' :
                                 user.role === 'WAREHOUSEMAN' ? 'bg-blue-500' : 'bg-emerald-500'
                               }`}>
                                 {user.nickname.charAt(0).toUpperCase()}
                               </div>
                               <div className="flex-1">
                                 <div className="font-bold text-white">{user.nickname}</div>
                                 <div className="text-xs text-slate-500 flex gap-2">
                                   <span>@{user.username}</span>
                                   <span className="text-slate-600">•</span>
                                   <span className="uppercase">{user.role.replace('_', ' ')}</span>
                                 </div>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {needsPasswordFix(user.password) && (
                                <button
                                  onClick={() => setFixingPasswordUserId(user.id)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
                                  title="Password not hashed - click to fix"
                                >
                                  Fix Password
                                </button>
                              )}
                              {user.id !== currentUser.id && (
                                <button 
                                  onClick={() => onDeleteUser(user.id)}
                                  className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Fix Password Modal */}
                          {fixingPasswordUserId === user.id && (
                            <div className="mt-4 p-3 bg-slate-800 border border-red-500/50 rounded-lg">
                              <p className="text-sm text-red-400 mb-3">⚠️ This user's password is not properly hashed. Enter a new password to fix this:</p>
                              <input
                                type="password"
                                placeholder="Enter new password"
                                value={fixPasswordValue}
                                onChange={(e) => setFixPasswordValue(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500 mb-3"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleFixPassword(user.id, user)}
                                  className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded transition-colors"
                                >
                                  Hash Password
                                </button>
                                <button
                                  onClick={() => {
                                    setFixingPasswordUserId(null);
                                    setFixPasswordValue('');
                                  }}
                                  className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
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
           <div className="max-w-7xl">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Upload & Templates */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Document Templates Section */}
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Upload size={20} className="text-amber-500" /> Upload Document Template
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
                    <h3 className="text-lg font-bold text-white mb-4">Saved Document Templates</h3>
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
                                <button
                                  onClick={() => handleEditDocContent(template)}
                                  className="p-2 text-slate-400 hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Edit document content"
                                >
                                  <FileEdit size={18} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingDocTemplate(template);
                                    setEditTemplateName(template.name);
                                  }}
                                  className="p-2 text-slate-400 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Edit template name"
                                >
                                  <Edit size={18} />
                                </button>
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

                {/* Right Column - Placeholders */}
                <div className="lg:col-span-1">
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 sticky top-6">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <Info size={20} className="text-blue-500" />
                      Available Placeholders
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Use these in your .docx templates. They will be replaced with actual data.
                    </p>
                    <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                      {[
                        { key: '{{clientName}}', desc: 'Client name' },
                        { key: '{{clientType}}', desc: 'Client type' },
                        { key: '{{clientAddress}}', desc: 'Full address' },
                        { key: '{{clientPhone}}', desc: 'Phone number' },
                        { key: '{{clientEmail}}', desc: 'Email' },
                        { key: '{{clientCUI}}', desc: 'CUI (Tax ID)' },
                        { key: '{{clientCNP}}', desc: 'CNP (Personal ID)' },
                        { key: '{{clientIban}}', desc: 'IBAN' },
                        { key: '{{clientRegCom}}', desc: 'Registration number' },
                        { key: '{{quoteName}}', desc: 'Quote title' },
                        { key: '{{quoteDate}}', desc: 'Quote date' },
                        { key: '{{subtotalNet}}', desc: 'Net subtotal' },
                        { key: '{{vatTotal}}', desc: 'VAT amount' },
                        { key: '{{totalGross}}', desc: 'Total with VAT' },
                        { key: '{{projectName}}', desc: 'Project name' },
                        { key: '{{connectionType}}', desc: 'Connection type' },
                        { key: '{{roofType}}', desc: 'Roof type' },
                        { key: '{{podNumber}}', desc: 'POD number' },
                        { key: '{{cfNumber}}', desc: 'CF number' },
                        { key: '{{internalId}}', desc: 'Internal ID' },
                        { key: '{{dateGenerated}}', desc: 'Generation date' },
                      ].map(p => (
                        <div key={p.key} className="bg-slate-800 rounded p-2 border border-slate-700">
                          <code className="text-xs font-mono text-purple-400 block mb-0.5">{p.key}</code>
                          <span className="text-[10px] text-slate-500">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-300 leading-relaxed">
                        <strong>Loop items:</strong> Use <code className="bg-slate-800 px-1 rounded">{'{{#quoteItems}}'}</code> to loop through quote items.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Templates Section */}
              <div className="border-t border-slate-700 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Mail size={20} className="text-blue-500" />
                      Email Templates
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Create reusable email templates for quotes, invoices, and more
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setShowTemplateModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={18} />
                    New Template
                  </button>
                </div>

                {emailTemplatesLoading ? (
                  <div className="text-center py-10 text-slate-400">Loading templates...</div>
                ) : emailTemplates.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                    No email templates created yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {emailTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Mail size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white">{template.name}</div>
                            <div className="text-xs text-slate-500">
                              <span className="inline-block px-2 py-0.5 bg-slate-800 rounded mr-2 capitalize">
                                {template.category}
                              </span>
                              Updated {new Date(template.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setShowTemplateModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteEmailTemplate(template.id)}
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

              {/* Email Template Editor Modal */}
              <EmailTemplateEditor
                isOpen={showTemplateModal}
                onClose={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                onSave={handleSaveEmailTemplate}
                template={editingTemplate}
              />
           </div>
        )}

        {activeTab === 'EMAIL' && (
          <div className="max-w-4xl space-y-10">
            {currentUser.role !== 'SUPER_ADMIN' ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Shield size={48} className="mb-4 text-red-500" />
                <h2 className="text-xl font-bold text-white">Restricted Access</h2>
                <p>Only Super Admins can configure email settings.</p>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                    <Mail className="text-blue-500" />
                    SMTP Email Configuration
                  </h2>
                  <p className="text-slate-400 mb-6">
                    Configure SMTP settings to send quote documents via email
                  </p>

                  {smtpLoading ? (
                    <div className="text-center py-10 text-slate-400">Loading settings...</div>
                  ) : (
                    <div className="bg-slate-900/50 rounded-xl border border-slate-700 p-6 space-y-4">
                      {/* SMTP Server Settings */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-400 mb-2">
                            SMTP Host <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={smtpSettings.host || ''}
                            onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                            placeholder="smtp.gmail.com"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <p className="text-xs text-slate-500 mt-1">Gmail: smtp.gmail.com, Outlook: smtp.office365.com</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-400 mb-2">
                            SMTP Port <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={smtpSettings.port || 587}
                            onChange={(e) => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <p className="text-xs text-slate-500 mt-1">Usually 587 (TLS) or 465 (SSL)</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="secure"
                          checked={smtpSettings.secure || false}
                          onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                          className="w-5 h-5 text-blue-500 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="secure" className="text-sm font-bold text-slate-400">
                          Use TLS/SSL (Recommended for port 587)
                        </label>
                      </div>

                      {/* Authentication */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-400 mb-2">
                            Username / Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={smtpSettings.username || ''}
                            onChange={(e) => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
                            placeholder="your-email@example.com"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-400 mb-2">
                            Password <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={smtpSettings.password || ''}
                            onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                            placeholder="Enter password or app password"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <p className="text-xs text-slate-500 mt-1">For Gmail: Use App Password if 2FA enabled</p>
                        </div>
                      </div>

                      {/* Sender Information */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-400 mb-2">
                            From Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={smtpSettings.fromEmail || ''}
                            onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                            placeholder="noreply@company.com"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-400 mb-2">
                            From Name
                          </label>
                          <input
                            type="text"
                            value={smtpSettings.fromName || ''}
                            onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                            placeholder="SolarFlux"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">
                          Reply-To Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={smtpSettings.replyTo || ''}
                          onChange={(e) => setSmtpSettings({ ...smtpSettings, replyTo: e.target.value })}
                          placeholder="support@company.com"
                          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      {/* Email Signature */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-bold text-slate-400">
                            Email Signature (Optional)
                          </label>
                          <div className="flex items-center gap-2">
                            {signatureMode === 'html' && (
                              <button
                                type="button"
                                onClick={() => signatureFileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                <Upload size={14} />
                                Upload HTML
                              </button>
                            )}
                            <input
                              ref={signatureFileInputRef}
                              type="file"
                              accept=".html,.htm"
                              onChange={handleSignatureFileUpload}
                              className="hidden"
                            />
                          </div>
                        </div>
                        
                        {/* Mode Toggle */}
                        <div className="flex gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setSignatureMode('html')}
                            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                              signatureMode === 'html'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            HTML Source
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSignatureMode('editor');
                              // Sync HTML source to editor when switching
                              if (signatureHtmlSource) {
                                setSignatureContent(signatureHtmlSource);
                              }
                            }}
                            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                              signatureMode === 'editor'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            Rich Text Editor
                          </button>
                        </div>

                        {signatureMode === 'html' ? (
                          <>
                            {/* HTML Source Mode */}
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">
                                  Paste or edit raw HTML code:
                                </label>
                                <textarea
                                  value={signatureHtmlSource}
                                  onChange={(e) => setSignatureHtmlSource(e.target.value)}
                                  className="w-full h-48 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                                  placeholder="<div>Your HTML signature here...</div>"
                                  spellCheck={false}
                                />
                              </div>
                              
                              {/* Live Preview */}
                              {signatureHtmlSource && (
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">
                                    Preview:
                                  </label>
                                  <div 
                                    className="bg-white border border-slate-600 rounded-lg p-4 min-h-[100px] max-h-[300px] overflow-auto prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: signatureHtmlSource }}
                                  />
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              💡 Tip: Save your Outlook signature as HTML and upload it, or paste the HTML code directly. This mode preserves all formatting, images, and styles exactly as-is.
                            </p>
                          </>
                        ) : (
                          <>
                            {/* Rich Text Editor Mode */}
                            <div className="bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
                              <NovelEditor
                                content={signatureContent}
                                onChange={(content) => {
                                  setSignatureContent(content);
                                  setSignatureHtmlSource(content);
                                }}
                                placeholder="Create your email signature..."
                                dark={true}
                                minHeight="200px"
                                onEditorReady={(editor) => {
                                  signatureEditorRef.current = editor;
                                }}
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Use / for commands to format your signature. For complex Outlook signatures, switch to "HTML Source" mode.
                            </p>
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleSaveSmtpSettings}
                          disabled={smtpSaveStatus === 'saving'}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {smtpSaveStatus === 'saving' ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : smtpSaveStatus === 'success' ? (
                            <>
                              <CheckCircle size={18} />
                              Saved!
                            </>
                          ) : (
                            <>
                              <Save size={18} />
                              Save Settings
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleTestSmtpConnection}
                          disabled={testingConnection || !smtpSettings.host || !smtpSettings.username}
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {testingConnection ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Send size={18} />
                              Test Connection
                            </>
                          )}
                        </button>
                      </div>

                      {/* Helper Info */}
                      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mt-4">
                        <div className="flex items-start gap-3">
                          <Info size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-slate-300 space-y-2">
                            <p className="font-bold text-white">Common SMTP Settings:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li><strong>Gmail:</strong> smtp.gmail.com:587 (TLS) - Requires App Password if 2FA enabled</li>
                              <li><strong>Outlook/Office365:</strong> smtp.office365.com:587 (TLS)</li>
                              <li><strong>Yahoo:</strong> smtp.mail.yahoo.com:587 (TLS)</li>
                              <li><strong>Custom Domain:</strong> Check with your hosting provider</li>
                            </ul>
                            <p className="text-xs text-slate-400 mt-3">
                              ⚠️ Passwords are encrypted before storage. Test connection after saving to verify settings.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Document Template Edit Modal */}
      {editingDocTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">Edit Template</h3>
              <button
                onClick={() => {
                  setEditingDocTemplate(null);
                  setEditTemplateName('');
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={editTemplateName}
                  onChange={(e) => setEditTemplateName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Template name..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => {
                    setEditingDocTemplate(null);
                    setEditTemplateName('');
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (onUpdateTemplate && editTemplateName.trim()) {
                      onUpdateTemplate(editingDocTemplate.id, { name: editTemplateName.trim() });
                      setEditingDocTemplate(null);
                      setEditTemplateName('');
                    }
                  }}
                  disabled={!editTemplateName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Content Edit Modal */}
      {editingDocContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileEdit size={20} className="text-green-500" />
                Edit Document: {editingDocContent.name}
              </h3>
              <button
                onClick={() => setEditingDocContent(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            {editingDocLoading ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-400">Loading document...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto p-6 bg-slate-900">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                      <NovelEditor
                        content={docContent}
                        onChange={setDocContent}
                        placeholder="Edit your document content. Use / for commands..."
                        dark={false}
                        minHeight="500px"
                        onEditorReady={(editor) => {
                          docContentEditorRef.current = editor;
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 p-6 border-t border-slate-700 bg-slate-800">
                  <button
                    onClick={() => setEditingDocContent(null)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDocContent}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <Save size={18} />
                    Save Changes
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};