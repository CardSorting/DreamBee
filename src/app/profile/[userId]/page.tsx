import { Suspense } from 'react'
import ProfileClient from './ProfileClient'

export default function ProfilePage({ params }: { params: { userId: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ProfileClient userId={params.userId} />
    </Suspense>
  )
}
