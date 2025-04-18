// src/app/layout.tsx
import { Inter, Titillium_Web } from 'next/font/google';
import { ProvidersWrapper } from '@/lib/contexts/ProvidersWrapper';
import { MessageNotificationListener } from '@/components/messages/MessageNotificationListener';
import '@/styles/globals.css';

// Define fonts
const titillium = Titillium_Web({ 
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700', '900'],
  variable: '--font-titillium',
  display: 'swap', // Add this for better performance
});

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', // Add this for better performance
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
          <MessageNotificationListener />
          {children}
        </ProvidersWrapper>
      </body>
    </html>
  );
}