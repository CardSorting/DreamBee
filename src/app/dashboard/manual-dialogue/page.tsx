'use client'

import ManualDialogueCreator from '@/app/components/ManualDialogueCreator'

export default function ManualDialoguePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manual Dialogue Creator</h1>
        <p className="text-gray-600">
          Create custom dialogues by manually entering character lines. The system will process your dialogue
          using the same pipeline as auto-generated dialogues, including conversation flow analysis, voice
          generation, and subtitle creation.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <ManualDialogueCreator />
      </div>
    </div>
  )
}
