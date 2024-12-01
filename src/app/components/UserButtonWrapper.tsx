'use client'

import { UserButton } from '@clerk/nextjs'

export function UserButtonWrapper() {
  return (
    <UserButton
      afterSignOutUrl="/"
      appearance={{
        elements: {
          avatarBox: "w-8 h-8",
          userButtonBox: "w-8 h-8"
        }
      }}
      userProfileMode="navigation"
      userProfileUrl={`/profile/${process.env.NEXT_PUBLIC_CLERK_USER_TAG || '@user'}`}
    />
  )
}
