import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://pmo-makro-cockpit.finfred-6125.chatgpt.site'),
  title: 'Cockpit do Portfólio | PMO Makro',
  description: 'Prévia conceitual do painel executivo do PMO da Makro Engenharia.',
  openGraph: {
    title: 'Cockpit do Portfólio | PMO Makro',
    description: 'Visão executiva de desempenho, exposição e decisões prioritárias.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Cockpit do Portfólio — PMO Makro Engenharia' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cockpit do Portfólio | PMO Makro',
    description: 'Visão executiva de desempenho, exposição e decisões prioritárias.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
