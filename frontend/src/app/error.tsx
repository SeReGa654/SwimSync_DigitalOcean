'use client';
import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SwimSync Error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="glass-card p-12 max-w-lg text-center border-red-500/20 shadow-red-500/5 shadow-2xl">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mx-auto mb-8 border border-red-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-3">Щось пішло не так</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-2">
          {error.message || 'Виникла неочікувана помилка. Спробуйте оновити сторінку.'}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-slate-600 mb-8">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Спробувати знову
          </button>
          <Link href="/" className="btn-secondary flex items-center gap-2">
            <Home className="w-4 h-4" /> На головну
          </Link>
        </div>
      </div>
    </div>
  );
}
