'use client';

import { useAuth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { userId, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && !userId) {
      redirect('/sign-in');
    }
  }, [userId, isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <>
      <h1 className="text-4xl font-bold mb-8 text-white">Dashboard</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-2xl font-semibold mb-4 text-white">Recent Projects</h2>
          <p className="text-gray-400">Your recent AI scene generation projects will appear here.</p>
        </div>
        <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-2xl font-semibold mb-4 text-white">Quick Actions</h2>
          <div className="space-y-4">
            <button className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity duration-200">
              New Scene
            </button>
            <button className="w-full px-4 py-3 border border-white/20 rounded-lg font-semibold text-white hover:bg-white/10 transition-colors duration-200">
              Browse Templates
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
