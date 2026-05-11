'use client';
import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CompetitionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Competition Error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="glass-card p-12 max-w-lg text-center border-red-500/20 shadow-red-500/5 shadow-2xl">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mx-auto mb-8 border border-red-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-3">Помилка завантаження змагання</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          {error.message || 'Не вдалося завантажити дані змагання. Можливо, сервер недоступний або змагання не існує.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Оновити
          </button>
          <Link href="/" className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Список змагань
          </Link>
        </div>
      </div>
    </div>
  );
}
