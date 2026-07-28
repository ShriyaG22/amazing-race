import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Wandr — Explore Your City Like Never Before',
  description: 'Create and play real-world scavenger hunts with friends. AI-generated checkpoints, live puzzles, photo proof, and interactive maps. Inspired by The Amazing Race.',
  openGraph: {
    title: 'Wandr — Explore Your City Like Never Before',
    description: 'Create and play real-world scavenger hunts with friends. AI-generated checkpoints, live puzzles, photo proof, and interactive maps.',
    type: 'website',
    url: 'https://wandr-race-app.vercel.app',
    siteName: 'Wandr',
    images: [{
      url: 'https://wandr-race-app.vercel.app/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Wandr — Real-world adventure game',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wandr — Explore Your City Like Never Before',
    description: 'Create and play real-world scavenger hunts with friends. AI-generated checkpoints, live puzzles, and interactive maps.',
    images: ['https://wandr-race-app.vercel.app/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
