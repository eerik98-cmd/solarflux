'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, Info } from 'lucide-react';
import { EmailTemplate, EmailTemplateCategory } from '@/types';
import { createDefaultTemplate, getAvailableVariablesForCategory } from '@/lib/emailTemplateUtils';
import NovelEditor from './NovelEditor';
import type { Editor } from '@tiptap/react';

interface EmailTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: EmailTemplate) => void;
  template?: EmailTemplate | null;
}

export default function EmailTemplateEditor({
  isOpen,
  onClose,
  onSave,
  template,
}: EmailTemplateEditorProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<EmailTemplateCategory>('general');
  const [subject, setSubject] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [bodyContent, setBodyContent] = useState('');
  const bodyEditorRef = useRef<Editor | null>(null);

  // Load template data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (template) {
        // Edit existing template
        setName(template.name);
        setCategory(template.category);
        setSubject(template.subject);
        setVariables(template.variables);
        setBodyContent(template.body);
      } else {
        // Create new template
        const defaultTemplate = createDefaultTemplate('general');
        setName('');
        setCategory('general');
        setSubject(defaultTemplate.subject);
        setVariables(defaultTemplate.variables);
        setBodyContent(defaultTemplate.body);
      }
    }
  }, [isOpen, template]);

  // Update variables when category changes
  useEffect(() => {
    const availableVars = getAvailableVariablesForCategory(category);
    setVariables(availableVars);
    
    // If creating new template, load default template for category
    if (!template && isOpen) {
      const defaultTemplate = createDefaultTemplate(category);
      setSubject(defaultTemplate.subject);
      setBodyContent(defaultTemplate.body);
    }
  }, [category]);

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    const bodyHtml = bodyEditorRef.current?.getHTML() || bodyContent;

    const templateData: EmailTemplate = {
      id: template?.id || Date.now().toString(),
      name,
      category,
      subject,
      body: bodyHtml,
      variables,
      createdAt: template?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: template?.createdBy || '',
      updatedBy: '',
    };

    onSave(templateData);
  };

  const insertVariable = (varName: string) => {
    bodyEditorRef.current?.chain().focus().insertContent(`{${varName}}`).run();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">
            {template ? 'Edit Email Template' : 'New Email Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Template Name & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Quote Email"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EmailTemplateCategory)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="quote">Quote</option>
                <option value="invoice">Invoice</option>
                <option value="project">Project</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject with {variables}"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Variables Helper */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-white mb-2">
                  Available Variables for {category}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {variables.map((varName) => (
                    <button
                      key={varName}
                      onClick={() => insertVariable(varName)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-blue-300 text-xs rounded border border-slate-600 transition-colors"
                      type="button"
                    >
                      {`{${varName}}`}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Click a variable to insert it at cursor position
                </p>
              </div>
            </div>
          </div>

          {/* Body Editor */}
          <div>
            <label className="block text-sm font-bold text-slate-400 mb-2">
              Email Body
            </label>
            
            {/* Novel Editor */}
            <div className="bg-white rounded-lg overflow-hidden border border-slate-600">
              <NovelEditor
                content={bodyContent}
                onChange={setBodyContent}
                placeholder="Write your email body here. Use / for commands..."
                dark={true}
                minHeight="400px"
                onEditorReady={(editor) => {
                  bodyEditorRef.current = editor;
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
