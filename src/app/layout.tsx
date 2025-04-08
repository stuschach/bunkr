// src/app/layout.tsx
import { Inter, Titillium_Web } from 'next/font/google';
import { ProvidersWrapper } from '@/lib/contexts/ProvidersWrapper';
import '@/styles/globals.css';

// Define fonts
const titillium = Titillium_Web({ 
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700', '900'],
  variable: '--font-titillium'
});

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'
});

export const metadata = {
  title: 'Bunkr - Golf Social Platform',
  description: 'Connect with golfers, track scores, and improve your game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${titillium.variable} ${inter.variable} font-sans`}>
        <ProvidersWrapper>
          {children}
        </ProvidersWrapper>
      </body>
    </html>
  );
}