export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <main className="flex-grow container mx-auto px-4">
        {children}
      </main>
    </div>
  );
}
