'use client';

import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function UserNav() {
  const router = useRouter();

  return (
    <div className="relative">
      <UserButton 
        afterSignOutUrl="/"
        appearance={{
          elements: {
            rootBox: 'relative',
            userButtonTrigger: 'focus:shadow-none',
          }
        }}
      />
    </div>
  );
}
