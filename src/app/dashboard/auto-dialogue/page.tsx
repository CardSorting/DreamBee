'use client'

import AutoDialogueGenerator from '@/app/components/AutoDialogueGenerator'

export default function AutoDialoguePage() {
  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50 overflow-auto">
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">AI Script Generator</h1>
          <p className="text-gray-600 mb-8">
            Generate complete dialogue scripts with AI for specific genres and scenarios. 
            Perfect for creating realistic conversations, character interactions, and story development.
          </p>
          <div className="border-t pt-8">
            <AutoDialogueGenerator />
          </div>
        </div>
      </div>
    </div>
  )
}
