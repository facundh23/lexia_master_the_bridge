import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Lexia',
  description: 'Asistente informativo de extranjería',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
