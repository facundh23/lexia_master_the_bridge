'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (signUp as any).email({ email, password, name });
        if (result.error) {
          setError(result.error.message ?? 'Error al registrarse');
        } else {
          setInfo('Revisá tu email para verificar tu cuenta antes de iniciar sesión.');
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (signIn as any).email({ email, password });
        if (result.error) {
          setError(result.error.message ?? 'Credenciales incorrectas');
        } else {
          router.push('/chat');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === 'signin' ? 'Iniciá sesión' : 'Crear cuenta'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <Input
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Contraseña (mín. 12 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-700">{info}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Cargando...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
            </Button>
            <button
              type="button"
              className="text-sm text-gray-500 underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
