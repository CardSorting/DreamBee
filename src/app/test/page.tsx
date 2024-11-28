export default function TestPage() {
  return (
    <main className="p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-blue-500 mb-4">
          Tailwind Test
        </h1>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-lg text-white mb-4">
            Testing Tailwind CSS functionality
          </p>
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            Test Button
          </button>
        </div>
      </div>
    </main>
  );
}
