'use client';

import { useAuth } from "@clerk/nextjs";

export default function Home() {
  const { userId } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">
          Welcome to Next.js with Clerk Auth
        </h1>
        <p className="text-lg mb-4">
          {userId ? 
            "You're signed in! Click on your profile picture to manage your account." :
            "Sign in to get started!"
          }
        </p>
      </div>
    </main>
  );
}
