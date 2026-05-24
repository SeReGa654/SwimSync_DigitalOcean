import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import Providers from './providers';
import AuthHeaderBadge from '@/components/layout/AuthHeaderBadge';
import Link from 'next/link';
import Image from 'next/image';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SwimSync — Система автоматизації змагань',
  description: 'Веб-сервіс для автоматизації процесу проведення змагань з плавання.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className="dark">
      <body className={`${inter.variable} ${jetBrainsMono.variable} min-h-screen font-sans mesh-bg premium-scrollbar overflow-x-hidden`}>
        <Toaster richColors position="top-right" theme="dark" />

        <header className="glass-header sticky top-0 z-50">
          <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-primary-500/30 group-hover:scale-110 transition-transform">
                <Image
                  src="/logo.svg"
                  alt="SwimSync logo"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-cover"
                  priority
                />
              </div>
              <h1 className="text-2xl font-black tracking-tighter premium-hero-title">
                SwimSync
              </h1>
            </Link>

            <nav className="hidden md:flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] bg-white/5 rounded-2xl border border-white/10 p-1.5">
              <Link href="/" className="px-4 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-all">Головна</Link>
              <Link href="/competitions" className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">Змагання</Link>
              <Link href="/login" className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">Вхід</Link>
            </nav>

            <div className="flex items-center gap-4">
              <AuthHeaderBadge />
              <div className="w-px h-6 bg-white/10 mx-2 hidden md:block" />
              <span className="premium-badge">
                v1.0
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
          <Providers>
            {children}
          </Providers>
        </main>

        <footer className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/5 text-slate-500 text-xs flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <p>© 2026 SwimSync</p>
          <div className="flex gap-4">
            <Link href="/help" className="opacity-50 hover:opacity-100 hover:text-white transition-opacity">Допомога</Link>
            <Link href="/contacts" className="opacity-50 hover:opacity-100 hover:text-white transition-opacity">Контакти</Link>
            <Link href="/normatives" className="opacity-50 hover:opacity-100 hover:text-white transition-opacity">Нормативи</Link>
            <Link href="/cabinet" className="opacity-50 hover:opacity-100 hover:text-white transition-opacity">Кабінет</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
