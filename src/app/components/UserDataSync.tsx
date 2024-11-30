'use client'

import { useEffect } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'

export default function UserDataSync() {
  const { isLoaded: isAuthLoaded, userId } = useAuth()
  const { isLoaded: isUserLoaded, user } = useUser()

  useEffect(() => {
    const syncUserData = async () => {
      try {
        if (!isAuthLoaded || !isUserLoaded || !userId || !user) {
          console.log('[UserSync] Auth state still loading')
          return
        }

        const primaryEmail = user.primaryEmailAddress?.emailAddress
        if (!primaryEmail) {
          console.error('[UserSync] No primary email found')
          return
        }

        // Prepare user data
        const userData = {
          clerkId: userId,
          email: primaryEmail,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          imageUrl: user.imageUrl || undefined,
        }

        // Send user data to API endpoint
        console.log('[UserSync] Syncing user data...')
        const response = await fetch('/api/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to sync user data: ${errorText}`)
        }

        console.log('[UserSync] User data synced successfully')
      } catch (error) {
        console.error('[UserSync] Error syncing user data:', error)
        if (error instanceof Error) {
          console.error('[UserSync] Error details:', {
            message: error.message,
            stack: error.stack
          })
        }
      }
    }

    syncUserData()
  }, [isAuthLoaded, isUserLoaded, userId, user])

  return null
}
