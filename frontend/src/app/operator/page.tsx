import Link from 'next/link';

export default function OperatorPage() {
  return (
    <div className="max-w-[760px] mx-auto py-20">
      <div className="glass-card p-8 border-white/10 space-y-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Операторський маршрут</p>
        <h1 className="text-3xl font-black text-white">Розділ оператора перенесено до адмін-панелі</h1>
        <p className="text-sm text-slate-400">
          Для роботи з операційними інструментами відкрийте адмін-панель або увійдіть у систему через єдину точку входу.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="btn-primary">Відкрити адмін-панель</Link>
          <Link href="/login" className="btn-secondary">Увійти</Link>
        </div>
      </div>
    </div>
  );
}
