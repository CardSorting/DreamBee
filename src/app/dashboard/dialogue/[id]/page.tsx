'use client'

import { useEffect, useState } from 'react'
import { EnhancedAudioPreview } from '../../../components/dialogue/EnhancedAudioPreview'
// Import other necessary components and utilities

interface DialogueData {
  title: string
  // Add other properties that your dialogue data might have
}

export default function DialoguePage({ params }: { params: { id: string } }) {
  const [dialogueData, setDialogueData] = useState<DialogueData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch dialogue data based on the ID
    const fetchDialogueData = async () => {
      try {
        const response = await fetch(`/api/dialogues/${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch dialogue data')
        }
        const data: DialogueData = await response.json()
        setDialogueData(data)
      } catch (err) {
        setError('Error fetching dialogue data')
        console.error(err)
      }
    }

    fetchDialogueData()
  }, [params.id])

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (!dialogueData) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1>Dialogue: {dialogueData.title}</h1>
      <EnhancedAudioPreview
        result={dialogueData}
        onError={handleError}
      />
      {/* Add other components or information related to the dialogue */}
    </div>
  )
}
