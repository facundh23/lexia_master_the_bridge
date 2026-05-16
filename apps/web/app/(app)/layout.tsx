'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  if (isPending) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <Link href="/chat" className="font-semibold text-lg">Lexia</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <Button variant="outline" size="sm" onClick={() => signOut().then(() => router.push('/login'))}>
            Salir
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
