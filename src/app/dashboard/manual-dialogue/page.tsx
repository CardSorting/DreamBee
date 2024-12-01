'use client'

import { useEffect, useState } from 'react'
import ManualDialogueCreator from '../../components/ManualDialogueCreator'

export default function ManualDialoguePage() {
  const [initialData, setInitialData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      // Get exported data from localStorage
      const exportedData = localStorage.getItem('exportedDialogue')
      console.log('Retrieved from localStorage:', exportedData)
      
      if (!exportedData) {
        console.log('No exported dialogue data found in localStorage')
        return
      }

      try {
        const parsedData = JSON.parse(exportedData)
        console.log('Successfully parsed data:', parsedData)

        // Set the initial data first
        setInitialData(parsedData)
        console.log('Set initial data:', parsedData)

        // Only clear localStorage after we've successfully set the data
        setTimeout(() => {
          localStorage.removeItem('exportedDialogue')
          console.log('Cleared localStorage data')
        }, 1000)
      } catch (parseError) {
        console.error('Error parsing dialogue data:', parseError)
        setError('Failed to parse exported dialogue data')
      }
    } catch (error) {
      console.error('Error accessing localStorage:', error)
      setError('Failed to access localStorage')
    }
  }, [])

  // Log when initialData changes
  useEffect(() => {
    console.log('initialData state updated:', initialData)
  }, [initialData])

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {initialData ? 'Edit Exported Dialogue' : 'Create New Dialogue'}
      </h1>
      
      {error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <ManualDialogueCreator 
          key={initialData ? 'with-data' : 'empty'} 
          initialData={initialData} 
        />
      )}
    </div>
  )
}
