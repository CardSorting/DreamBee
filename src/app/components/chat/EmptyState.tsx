'use client'

interface EmptyStateProps {
  onNewChat: () => void
}

export const EmptyState = ({ onNewChat }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center h-full text-center px-4">
    <div className="w-16 h-16 mb-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="white" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </div>
    <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome to Chat</h2>
    <p className="text-gray-500 mb-8 max-w-md">
      Start a new conversation or select an existing chat from the sidebar.
    </p>
    <button
      onClick={onNewChat}
      className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium
                 hover:bg-blue-600 transition-colors duration-200
                 focus:outline-none focus:ring-4 focus:ring-blue-100"
    >
      Start New Chat
    </button>
  </div>
)
