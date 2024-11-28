'use client';

import { SignInButton, SignOutButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";

export default function Header() {
  const { isLoaded, userId } = useAuth();

  // Show loading state
  if (!isLoaded) {
    return (
      <header className="w-full bg-black/50 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-white">
              DreamBee
            </Link>
            <div className="w-24 h-8 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full bg-black/50 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-white">
            DreamBee
          </Link>
          <div className="flex items-center gap-4">
            {userId ? (
              <>
                <Link 
                  href="/dashboard" 
                  className="text-gray-300 hover:text-white transition"
                >
                  Dashboard
                </Link>
                <SignOutButton>
                  <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-semibold text-white hover:opacity-90 transition">
                    Sign Out
                  </button>
                </SignOutButton>
              </>
            ) : (
              <SignInButton>
                <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-semibold text-white hover:opacity-90 transition">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
