'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle2, Clock, File, X, FileDown, AlertTriangle, ScrollText } from 'lucide-react';

type DocType = 'CI' | 'CF' | 'Factura' | 'Other';

interface DocRequest {
  id: string;
  type: DocType;
  description: string;
  status: 'pending' | 'received';
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  uploadedAt?: string;
}

interface ContractDocState {
  id: string;
  quoteId: string;
  contractNumber: string;
  shareToken: string;
  clientName?: string;
  requests: DocRequest[];
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  CI: 'CI – Carte de Identitate',
  CF: 'CF – Certificat Fiscal',
  Factura: 'Factura',
  Other: 'Other',
};

function UploadRow({
  req,
  token,
  onUploaded,
}: {
  req: DocRequest;
  token: string;
  onUploaded: (requestId: string, fileUrl: string, fileName: string, uploadedAt: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch(`/api/public/contract-docs/${token}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: req.id, fileName: file.name, base64 }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          throw new Error(err.error || 'Upload failed');
        }

        const { fileUrl, uploadedAt } = await res.json();
        onUploaded(req.id, fileUrl, file.name, uploadedAt);
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
    e.target.value = '';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="font-semibold text-gray-800">{DOC_TYPE_LABELS[req.type]}</p>
          {req.description && (
            <p className="text-sm text-gray-500 mt-0.5">{req.description}</p>
          )}
        </div>
        {req.status === 'received' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 size={12} /> Uploaded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
            <Clock size={12} /> Required
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 pb-5">
        {req.uploadedFileUrl ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <File size={18} className="text-emerald-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{req.uploadedFileName}</p>
              {req.uploadedAt && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Uploaded{' '}
                  {new Date(req.uploadedAt).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <span className="text-xs text-emerald-600 font-semibold flex-shrink-0">✓ Done</span>
          </div>
        ) : (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFile}
              accept="image/*,.pdf,.doc,.docx"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 hover:border-amber-400 rounded-xl transition-colors group bg-gray-50 hover:bg-amber-50"
            >
              <Upload
                size={22}
                className={`${
                  uploading
                    ? 'text-amber-500 animate-bounce'
                    : 'text-gray-400 group-hover:text-amber-500'
                } transition-colors`}
              />
              <span className="text-sm font-medium text-gray-500 group-hover:text-amber-600 transition-colors">
                {uploading ? 'Uploading…' : 'Click to upload'}
              </span>
              <span className="text-xs text-gray-400">PDF, Image, Word accepted</span>
            </button>
            {error && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                <X size={12} /> {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ContractDocsPublicPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<ContractDocState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/public/contract-docs/${token}`)
      .then(r => r.ok ? r.json() : r.json().then((e: any) => { throw new Error(e.error || 'Not found'); }))
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleUploaded = (requestId: string, fileUrl: string, fileName: string, uploadedAt: string) => {
    setData(prev =>
      prev
        ? {
            ...prev,
            requests: prev.requests.map(r =>
              r.id === requestId
                ? { ...r, status: 'received', uploadedFileUrl: fileUrl, uploadedFileName: fileName, uploadedAt }
                : r
            ),
          }
        : prev
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
          <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-800 text-lg mb-1">Link not found</h2>
          <p className="text-gray-500 text-sm">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const receivedCount = data.requests.filter(r => r.status === 'received').length;
  const totalCount = data.requests.length;
  const allDone = receivedCount === totalCount && totalCount > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top accent */}
      <div className="bg-amber-500 h-1.5" />

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-amber-50">
              <ScrollText size={22} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">SolarFlux</p>
              <p className="text-gray-500 text-sm font-medium">{data.contractNumber}</p>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Document Upload Portal</h1>
          {data.clientName && (
            <p className="text-sm text-gray-500 mt-1">For: {data.clientName}</p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            Please upload the documents listed below. Your contractor will be notified once all documents are received.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-xl mx-auto px-4 py-6">
        {allDone ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4 mb-6">
            <CheckCircle2 size={32} className="text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">All documents received!</p>
              <p className="text-sm text-emerald-600">Thank you. Your contractor has been notified.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-600">Progress</span>
              <span className="text-sm font-bold text-gray-800">{receivedCount}/{totalCount}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: totalCount > 0 ? `${(receivedCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {totalCount === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
            <FileDown size={32} className="mx-auto mb-2 text-gray-300" />
            <p>No documents requested yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.requests.map(req => (
              <UploadRow
                key={req.id}
                req={req}
                token={token}
                onUploaded={handleUploaded}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Powered by SolarFlux · Secure document portal
        </p>
      </div>
    </div>
  );
}
