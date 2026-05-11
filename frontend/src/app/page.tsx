import { ShieldCheck, Waves, FileCheck2, Activity } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="surface-elevated p-8 md:p-12 overflow-hidden">
        <div className="inline-flex items-center gap-2 bg-primary-500/20 text-primary-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-primary-400/30">
          <ShieldCheck className="w-3.5 h-3.5" /> SwimSync
        </div>
        <h2 className="text-4xl md:text-5xl font-black mb-4 premium-hero-title">Автоматизація змагань з плавання</h2>
        <p className="text-slate-300 text-lg leading-relaxed max-w-3xl">
          Платформа для секретаріату та адміністрації: імпорт заявок, жеребкування, внесення результатів,
          фіналізація та генерація протоколів. Публічна головна сторінка відображає лише презентаційний контент.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/competitions" className="btn-primary">Перейти до змагань</Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface-elevated p-6">
          <div className="flex items-center gap-2 text-primary-300 mb-3">
            <Waves className="w-5 h-5" />
            <h3 className="text-lg font-black text-white">Керування змаганнями</h3>
          </div>
          <p className="text-sm text-slate-300">
            Створення та керування змаганнями доступне лише в авторизованому кабінеті секретаря.
          </p>
        </div>
        <div className="surface-elevated p-6">
          <div className="flex items-center gap-2 text-primary-300 mb-3">
            <FileCheck2 className="w-5 h-5" />
            <h3 className="text-lg font-black text-white">Документи та протоколи</h3>
          </div>
          <p className="text-sm text-slate-300">
            DOCX-черга підтримує статуси обробки та контроль завантаження результатів.
          </p>
        </div>
        <div className="surface-elevated p-6 md:col-span-2">
          <div className="flex items-center gap-2 text-primary-300 mb-3">
            <Activity className="w-5 h-5" />
            <h3 className="text-lg font-black text-white">Операційна прозорість</h3>
          </div>
          <p className="text-sm text-slate-300">
            Стан сервісів, метрики та аудит доступні в захищених розділах для відповідних ролей.
          </p>
        </div>
      </section>
    </div>
  );
}
