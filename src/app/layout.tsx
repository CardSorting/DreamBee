import './globals.css'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import Header from './components/Header'
import UserDataSync from './components/UserDataSync'
import ConditionalFooter from './components/ConditionalFooter'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <ClerkProvider
          appearance={{
            elements: {
              formButtonPrimary: 'bg-blue-500 hover:bg-blue-600',
              card: 'bg-white shadow-lg rounded-lg',
            }
          }}
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          telemetry={false}
        >
          <div className="min-h-screen flex flex-col">
            <UserDataSync />
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <ConditionalFooter />
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
