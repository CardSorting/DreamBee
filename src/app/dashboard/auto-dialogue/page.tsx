'use client'

import AutoDialogueGenerator from '@/app/components/AutoDialogueGenerator'
import { useState } from 'react'

interface ConversationMetadata {
  totalDuration: number
  speakers: string[]
  turnCount: number
  genre: string
}

interface ConversationTranscript {
  srt: string
  vtt: string
  json: any
}

export default function AutoDialoguePage() {
  const [metadata, setMetadata] = useState<ConversationMetadata | null>(null)
  const [transcript, setTranscript] = useState<ConversationTranscript | null>(null)
  const [activeTab, setActiveTab] = useState<'generator' | 'transcript' | 'analysis'>('generator')

  const handleGenerationComplete = (data: any) => {
    if (data.metadata) {
      setMetadata(data.metadata)
    }
    if (data.transcript) {
      setTranscript(data.transcript)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-3 py-4 text-sm font-medium ${
                activeTab === 'generator'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              AI Script Generator
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-3 py-4 text-sm font-medium ${
                activeTab === 'transcript'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Transcripts
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-3 py-4 text-sm font-medium ${
                activeTab === 'analysis'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'generator' && (
          <div className="bg-white shadow rounded-lg">
            <AutoDialogueGenerator onGenerationComplete={handleGenerationComplete} />
          </div>
        )}

        {activeTab === 'transcript' && transcript && (
          <div className="bg-white shadow rounded-lg p-6 space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">JSON Transcript</h2>
              <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(transcript.json, null, 2)}
              </pre>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">SRT Subtitles</h2>
              <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
                {transcript.srt}
              </pre>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">VTT Subtitles</h2>
              <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
                {transcript.vtt}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && metadata && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Script Analysis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="text-lg font-medium mb-4">Basic Statistics</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Duration</dt>
                    <dd className="font-medium">{formatDuration(metadata.totalDuration)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Turn Count</dt>
                    <dd className="font-medium">{metadata.turnCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Genre</dt>
                    <dd className="font-medium">{metadata.genre}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <h3 className="text-lg font-medium mb-4">Speakers</h3>
                <ul className="space-y-2">
                  {metadata.speakers.map((speaker, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>{speaker}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
