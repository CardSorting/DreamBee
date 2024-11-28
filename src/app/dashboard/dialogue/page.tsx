import { auth } from '@clerk/nextjs/server'
import DialogueGenerator from '@/app/components/DialogueGenerator'

export default async function DialoguePage() {
  const { userId } = await auth()

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Please sign in to access this feature.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">AI Voice Dialogue Generator</h1>
        <DialogueGenerator />
      </div>
    </div>
  )
}
