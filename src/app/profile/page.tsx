'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import Image from 'next/image';

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) return null;

  const handleManageAccount = () => {
    openUserProfile({
      appearance: {
        layout: {
          shimmer: true,
          socialButtonsPlacement: "bottom",
          socialButtonsVariant: "iconButton",
        },
        variables: {
          borderRadius: "0.5rem",
          colorPrimary: "rgb(37 99 235)",
        },
        elements: {
          modalBackdrop: "flex items-center justify-center bg-black bg-opacity-50",
          modal: "relative !transform-none !top-0 !left-0 !m-auto",
          card: "rounded-lg shadow-xl",
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">Account</h1>
            <p className="text-sm text-gray-500">Manage your account info</p>
          </div>

          {/* Profile Section */}
          <div className="p-6 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16">
                <Image
                  src={user.imageUrl}
                  alt="Profile"
                  fill
                  className="rounded-full object-cover"
                  sizes="64px"
                />
              </div>
              <div>
                <h2 className="text-lg font-medium">{user.fullName}</h2>
                <p className="text-sm text-gray-500">{user.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>

            {/* Email Addresses */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Email addresses</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{user.primaryEmailAddress?.emailAddress}</p>
                  <p className="text-xs text-gray-500">Primary</p>
                </div>
                <button
                  onClick={handleManageAccount}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Manage
                </button>
              </div>
            </div>

            {/* Connected Accounts */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Connected accounts</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.545,12.151L12.545,12.151c0,1.054,0.855,1.909,1.909,1.909h3.536c-0.607,1.972-2.101,3.467-4.073,4.073v-1.909 c0-1.054-0.855-1.909-1.909-1.909h0c-1.054,0-1.909,0.855-1.909,1.909v1.909c-1.972-0.607-3.467-2.101-4.073-4.073h3.536 c1.054,0,1.909-0.855,1.909-1.909v0c0-1.054-0.855-1.909-1.909-1.909H6.926c0.607-1.972,2.101-3.467,4.073-4.073v1.909 c0,1.054,0.855,1.909,1.909,1.909h0c1.054,0,1.909-0.855,1.909-1.909V6.169c1.972,0.607,3.467,2.101,4.073,4.073h-3.536 C13.4,10.242,12.545,11.097,12.545,12.151z M12,2C6.477,2,2,6.477,2,12c0,5.523,4.477,10,10,10s10-4.477,10-10 C22,6.477,17.523,2,12,2z"></path>
                  </svg>
                  <div>
                    <p className="text-sm font-medium">Google</p>
                    <p className="text-xs text-gray-500">{user.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>
                <button
                  onClick={handleManageAccount}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Manage
                </button>
              </div>
            </div>

            {/* Security */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Security</h3>
              <button
                onClick={handleManageAccount}
                className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium">Password</p>
                  <p className="text-xs text-gray-500">Update your password</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
