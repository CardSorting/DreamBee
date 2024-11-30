'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

export default function UserDataSync() {
  const { user, isLoaded } = useUser()
  const syncedRef = useRef(false)

  useEffect(() => {
    const syncUser = async () => {
      if (!isLoaded || !user || syncedRef.current) return
      
      try {
        const response = await fetch('/api/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
          }),
          credentials: 'include', // Include cookies in the request
        })

        if (response.ok) {
          syncedRef.current = true
        } else {
          console.error('Failed to sync user data:', await response.text())
        }
      } catch (error) {
        console.error('Error syncing user data:', error)
      }
    }

    syncUser()
  }, [user, isLoaded])

  // This is a utility component that doesn't render anything
  return null
}
