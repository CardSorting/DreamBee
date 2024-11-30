'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

export default function UserDataSync() {
  const { user } = useUser()
  const syncedRef = useRef(false)

  useEffect(() => {
    const syncUser = async () => {
      if (!user || syncedRef.current) return
      
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
        })

        if (response.ok) {
          syncedRef.current = true
        }
      } catch (error) {
        console.error('Error syncing user data:', error)
      }
    }

    syncUser()
  }, [user])

  return null
}
