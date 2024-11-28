'use client';

import { SignOutButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

const Header = () => {
  const { userId, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle smooth scrolling for anchor links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.hash && link.origin + link.pathname === window.location.origin + window.location.pathname) {
        e.preventDefault();
        const targetId = link.hash.slice(1);
        const element = document.getElementById(targetId);
        
        if (element) {
          const headerOffset = 80;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  if (!mounted || !isLoaded) {
    return null;
  }

  return (
    <header className="w-full bg-black/50 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
            <span className="text-xl font-bold text-white">DreamBee</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => {
              const element = document.getElementById('features');
              if (element) {
                const headerOffset = 80;
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: "smooth"
                });
              }
            }} className="text-gray-300 hover:text-white transition">
              Features
            </button>
            <button onClick={() => {
              const element = document.getElementById('process');
              if (element) {
                const headerOffset = 80;
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: "smooth"
                });
              }
            }} className="text-gray-300 hover:text-white transition">
              How It Works
            </button>
            <button className="text-gray-300 hover:text-white transition">
              Pricing
            </button>
            <button className="text-gray-300 hover:text-white transition">
              Showcase
            </button>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            {!userId ? (
              <>
                <Link 
                  href="/sign-in" 
                  className="text-gray-300 hover:text-white transition"
                >
                  Sign In
                </Link>
                <Link 
                  href="/sign-up" 
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-semibold text-white hover:opacity-90 transition"
                >
                  Start Creating
                </Link>
              </>
            ) : (
              <>
                <Link 
                  href="/dashboard" 
                  className="text-gray-300 hover:text-white transition"
                >
                  Dashboard
                </Link>
                <SignOutButton>
                  <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-semibold text-white hover:opacity-90 transition">
                    Sign Out
                  </button>
                </SignOutButton>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu (hidden by default) */}
      <div className="hidden md:hidden px-4 py-2 bg-black/90 border-t border-white/10">
        <nav className="flex flex-col space-y-2">
          <button onClick={() => {
            const element = document.getElementById('features');
            if (element) {
              const headerOffset = 80;
              const elementPosition = element.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
              });
            }
          }} className="text-gray-300 hover:text-white transition py-2 text-left">
            Features
          </button>
          <button onClick={() => {
            const element = document.getElementById('process');
            if (element) {
              const headerOffset = 80;
              const elementPosition = element.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
              });
            }
          }} className="text-gray-300 hover:text-white transition py-2 text-left">
            How It Works
          </button>
          <button className="text-gray-300 hover:text-white transition py-2 text-left">
            Pricing
          </button>
          <button className="text-gray-300 hover:text-white transition py-2 text-left">
            Showcase
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
