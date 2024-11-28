import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs'
import Link from 'next/link'
import './globals.css'

export const metadata = {
  title: 'Next.js with Clerk Auth',
  description: 'A Next.js app with Clerk authentication',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header className="flex justify-between items-center p-4 bg-white shadow-sm">
            <Link href="/" className="text-xl font-bold">My App</Link>
            <nav className="flex items-center space-x-4">
              <SignedIn>
                <Link 
                  href="/profile" 
                  className="text-gray-600 hover:text-gray-900"
                >
                  My Account
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal" />
              </SignedOut>
            </nav>
          </header>
          <main>
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  )
}
