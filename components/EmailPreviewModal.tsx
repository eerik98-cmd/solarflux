'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Mail, Eye, Edit, Send, Paperclip, Trash2, FileText } from 'lucide-react';
import { EmailTemplate } from '@/types';
import NovelEditor from './NovelEditor';
import type { Editor } from '@tiptap/react';

export interface EmailAttachment {
  name: string;
  data: string; // Base64 encoded
  type: string;
  size?: number;
}

export interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: {
    to: string;
    subject: string;
    body: string;
    attachments: EmailAttachment[];
  }) => void | Promise<void>;
  initialData: {
    to: string;
    subject: string;
    body: string;
    attachments?: EmailAttachment[];
  };
  signature?: string; // HTML signature to append
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  onSend,
  initialData,
  signature = '',
}: EmailPreviewModalProps) {
  const [to, setTo] = useState(initialData.to);
  const [subject, setSubject] = useState(initialData.subject);
  const [bodyContent, setBodyContent] = useState(initialData.body);
  const [attachments, setAttachments] = useState<EmailAttachment[]>(
    initialData.attachments || []
  );
  const [showPreview, setShowPreview] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  // Get the complete email body with signature
  const fullEmailBody = useMemo(() => {
    if (signature) {
      return `${bodyContent}<br/><br/><div class="signature">${signature}</div>`;
    }
    return bodyContent;
  }, [bodyContent, signature]);

  // Validate email address
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSend = async () => {
    // Validate email
    if (!validateEmail(to)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!subject.trim()) {
      alert('Please enter an email subject');
      return;
    }

    setEmailError('');
    setIsSending(true);

    try {
      await onSend({
        to,
        subject,
        body: fullEmailBody,
        attachments,
      });
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setIsSending(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTo(initialData.to);
      setSubject(initialData.subject);
      setBodyContent(initialData.body);
      setAttachments(initialData.attachments || []);
      setShowPreview(true);
      setEmailError('');
      loadEmailTemplates();
    }
  }, [isOpen, initialData]);

  // Load email templates from API
  const loadEmailTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/api/settings/email-templates');
      if (response.ok) {
        const data = await response.json();
        setEmailTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load email templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Apply selected template
  const applyTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (!template) return;

    // Replace variables in subject and body
    // For now, we'll just set the template content as-is
    // Variables will be replaced when actually sending
    setSubject(template.subject);
    setBodyContent(template.body);
    setSelectedTemplateId(templateId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">Email Preview</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSending}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Editor */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit Email
              </h3>

              {/* Template Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Load Template (Optional)
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  disabled={isSending || loadingTemplates}
                >
                  <option value="">-- No template --</option>
                  {emailTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.category})
                    </option>
                  ))}
                </select>
                {loadingTemplates && (
                  <p className="text-xs text-gray-500 mt-1">Loading templates...</p>
                )}
              </div>

              {/* To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To: <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setEmailError('');
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    emailError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="recipient@example.com"
                  disabled={isSending}
                />
                {emailError && (
                  <p className="text-red-500 text-sm mt-1">{emailError}</p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject"
                  disabled={isSending}
                />
              </div>

              {/* Body Editor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message:
                </label>
                
                {/* Novel Editor */}
                <div className="border border-gray-300 rounded-md overflow-hidden">
                  <NovelEditor
                    content={bodyContent}
                    onChange={setBodyContent}
                    placeholder="Write your email message. Use / for commands..."
                    dark={false}
                    minHeight="300px"
                    editable={!isSending}
                    onEditorReady={(editor) => {
                      editorRef.current = editor;
                    }}
                  />
                </div>
                
                {signature && (
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-xs text-gray-500 mb-1">Signature (will be appended):</p>
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: signature }}
                    />
                  </div>
                )}
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attachments:
                  </label>
                  <div className="space-y-2">
                    {attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">
                            {attachment.name}
                          </span>
                          {attachment.size && (
                            <span className="text-xs text-gray-500">
                              ({formatFileSize(attachment.size)})
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                          disabled={isSending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="w-1/2 overflow-y-auto p-6 bg-gray-50">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Preview
              </h3>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {/* Email Header */}
                <div className="bg-gray-100 p-4 border-b border-gray-200">
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-semibold text-gray-600">To:</span>{' '}
                      <span className="text-gray-800">{to || '(recipient email)'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Subject:</span>{' '}
                      <span className="text-gray-800">{subject || '(no subject)'}</span>
                    </div>
                    {attachments.length > 0 && (
                      <div>
                        <span className="font-semibold text-gray-600">
                          Attachments ({attachments.length}):
                        </span>{' '}
                        <span className="text-gray-800">
                          {attachments.map(a => a.name).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-6">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: fullEmailBody }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            disabled={isSending}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !to || !subject.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
