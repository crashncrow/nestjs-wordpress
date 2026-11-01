import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'nestjs-wordpress demo',
  description: 'Next.js → NestJS (BFF) → WordPress',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand">
              nestjs-wordpress
            </Link>
            <Suspense fallback={<nav className="nav" />}>
              <Nav />
            </Suspense>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
