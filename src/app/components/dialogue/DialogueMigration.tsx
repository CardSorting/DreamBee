'use client';

import { useState } from 'react';

export function DialogueMigration() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [results, setResults] = useState<{
    migrated: number;
    errors: Array<{ id: string; error: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMigration = async () => {
    try {
      setIsMigrating(true);
      setError(null);
      setResults(null);

      const response = await fetch('/api/dialogues/migrate', {
        method: 'POST'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to migrate dialogues');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during migration');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Dialogue Migration</h2>
        <button
          onClick={handleMigration}
          disabled={isMigrating}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${isMigrating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
            }
          `}
        >
          {isMigrating ? 'Migrating...' : 'Start Migration'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Successfully Migrated:</span>
            <span className="text-sm font-medium text-gray-900">{results.migrated}</span>
          </div>

          {results.errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">Failed Migrations:</h3>
              <ul className="space-y-1">
                {results.errors.map((error, index) => (
                  <li
                    key={index}
                    className="text-sm text-red-600 bg-red-50 p-2 rounded"
                  >
                    ID: {error.id} - {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
