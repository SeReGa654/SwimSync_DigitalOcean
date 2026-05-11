'use client';

import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Підтвердити',
  cancelText = 'Скасувати',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-bg-dark/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg p-6 border-white/10 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
            danger ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-primary-500/10 text-primary-400 border-primary-500/30'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-white">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary !px-4 !py-2 text-xs">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`!px-4 !py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-primary-600 hover:bg-primary-500 text-white'
            }`}
          >
            {loading ? 'Обробка...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
