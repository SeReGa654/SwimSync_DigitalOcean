'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));
  const lastAuthToastAtRef = useRef(0);

  useEffect(() => {
    const onUnauthorized = () => {
      const now = Date.now();
      if (now - lastAuthToastAtRef.current < 5000) return;
      lastAuthToastAtRef.current = now;
      toast.error('Сесія завершена. Увійдіть повторно в адмін-панелі.');
    };
    window.addEventListener('swimsync:auth-unauthorized', onUnauthorized);
    return () => {
      window.removeEventListener('swimsync:auth-unauthorized', onUnauthorized);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
