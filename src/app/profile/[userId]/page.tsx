'use client'

import { Suspense } from 'react'
import ProfileClient from './ProfileClient'
import { useParams } from 'next/navigation'

export default function ProfilePage() {
  const params = useParams()
  const userId = params?.userId as string

  return (
    <Suspense fallback={<div>
      Loading profile...
    </div>}>
      <ProfileClient userId={userId} />
    </Suspense>
  )
}
