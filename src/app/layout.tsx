import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import Header from './components/Header';

export const metadata = {
  title: 'DreamBee - AI Video Scene Generation',
  description: 'Direct your vision with AI. Create stunning video scenes through AI collaboration.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-black text-white">
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
              {children}
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
