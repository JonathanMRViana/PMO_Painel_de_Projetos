import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://pmo-makro-cockpit.finfred-6125.chatgpt.site'),
  title: 'Quadro de Ações | PMO Makro',
  description: 'Acompanhamento de ações do PMO Makro.',
  openGraph: {
    title: 'Quadro de Ações | PMO Makro',
    description: 'Acompanhamento de ações do PMO Makro.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Quadro de Ações — PMO Makro',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Quadro de Ações | PMO Makro',
    description: 'Acompanhamento de ações do PMO Makro.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
