import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <section className="surface-elevated p-8 md:p-12 max-w-3xl mx-auto text-center animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/10 mb-6">
        <AlertTriangle className="w-8 h-8 text-primary-400" />
      </div>

      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400 mb-3">404</p>
      <h1 className="text-4xl md:text-5xl font-black mb-4 premium-hero-title">Сторінку не знайдено</h1>
      <p className="text-slate-300 mb-8">
        Посилання може бути застарілим або сторінка була переміщена.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">На головну</Link>
      </div>
    </section>
  );
}
