import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'The Amazing Race — Live Game',
  description: 'Race through real-world checkpoints. Solve puzzles. Prove it. Win.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Amazing Race',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
