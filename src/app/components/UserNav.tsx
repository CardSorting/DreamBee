'use client';

import { UserButton } from '@clerk/nextjs';

export default function UserNav() {
  return (
    <div className="relative flex items-center gap-4">
      <UserButton 
        appearance={{
          elements: {
            rootBox: 'relative',
            userButtonTrigger: 'focus:shadow-none',
          }
        }}
        afterSignOutUrl="/"
      />
    </div>
  );
}
