'use client';

import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from 'next/navigation';

export default function Page() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-gray-900 to-black p-4">
      <div className="w-full max-w-md">
        <SignIn 
          appearance={{
            elements: {
              formButtonPrimary: 
                "bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-opacity",
              footerActionLink: "text-purple-400 hover:text-purple-300",
            },
          }}
          redirectUrl={redirectUrl}
        />
      </div>
    </div>
  );
}
