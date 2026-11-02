import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  Download
} from 'lucide-react';
import { getAttachmentDownloadUrl } from '@/services/api';

// Format bytes into human-readable string
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Select icon & color based on extension
const getFileIconConfig = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return { icon: FileText, color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'PDF' };
    case 'doc':
    case 'docx':
      return { icon: FileText, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'DOC' };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { icon: FileSpreadsheet, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'SHEET' };
    case 'zip':
    case 'rar':
    case '7z':
      return { icon: FileArchive, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'ARCHIVE' };
    case 'txt':
      return { icon: FileCode, color: 'text-brand-subtle bg-white/5 border-white/10', label: 'TXT' };
    default:
      return { icon: File, color: 'text-brand-primary bg-brand-primary/10 border-brand-primary/20', label: ext?.toUpperCase() || 'FILE' };
  }
};

export const DocumentMessage = ({ attachment, isOwn }) => {
  const filename = attachment?.original_filename || attachment?.file_name || 'Document';
  const fileSize = formatFileSize(attachment?.file_size);
  const { icon: Icon, color, label } = getFileIconConfig(filename);

  const downloadUrl = attachment?.id
    ? getAttachmentDownloadUrl(attachment.id)
    : attachment?.file_url;

  return (
    <div className="flex items-center gap-2.5 p-2 xs:p-2.5 rounded-xl bg-black/20 border border-brand-border/40 hover:border-brand-primary/40 transition-colors my-1 max-w-full sm:max-w-[340px]">
      {/* File Badge */}
      <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 border ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-[8px] font-bold tracking-tight uppercase mt-0.5">{label}</span>
      </div>

      {/* Filename & Size */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-brand-text truncate" title={filename}>
          {filename}
        </div>
        <div className="text-[10px] text-brand-subtle font-mono mt-0.5">
          {fileSize}
        </div>
      </div>

      {/* Download Action */}
      <a
        href={downloadUrl}
        download={filename}
        className={`p-2 rounded-lg transition-colors shrink-0 ${
          isOwn
            ? 'text-white hover:bg-white/20'
            : 'text-brand-primary hover:bg-brand-primary/20'
        }`}
        title={`Download ${filename}`}
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
};

export default DocumentMessage;

