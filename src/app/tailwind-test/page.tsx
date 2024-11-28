export default function TailwindTest() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">
          Tailwind Test
        </h1>
        <div className="space-y-4">
          <div className="bg-white shadow-lg rounded-lg p-6">
            <p className="text-gray-800">
              Testing basic Tailwind classes
            </p>
          </div>
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Click me
          </button>
        </div>
      </div>
    </div>
  );
}
