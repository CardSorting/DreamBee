'use client';

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

const HeroSection = () => {
  const { userId, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToFeatures = () => {
    const element = document.getElementById('features');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Don't render anything until the component is mounted and Clerk is loaded
  if (!mounted || !isLoaded) {
    return null;
  }

  return (
    <section className="w-full py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Direct Your Vision with AI
          </h1>
          <p className="text-xl text-gray-300 mb-12">
            Be the director of your own scenes. Collaborate with AI to bring your creative vision to life, one scene at a time.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href={userId ? "/dashboard" : "/sign-up"}
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-semibold hover:opacity-90 transition-opacity duration-200 text-lg"
            >
              {userId ? "Enter Studio" : "Start Creating Now"}
            </Link>
            <button 
              onClick={scrollToFeatures}
              className="inline-flex items-center justify-center px-8 py-4 border border-white/20 rounded-full font-semibold hover:bg-white/10 transition-colors duration-200 text-lg"
            >
              See How It Works
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
