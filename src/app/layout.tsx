import "./globals.css";
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { TranscriptProvider } from '@/lib/contexts/TranscriptContext';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <TranscriptProvider>
            {children}
          </TranscriptProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
