'use client';

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { createOrUpdateUser } from "@/utils/firebase";

export default function UserDataSync() {
  const { isLoaded: isAuthLoaded, userId } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();

  useEffect(() => {
    const syncUserData = async () => {
      if (!isAuthLoaded || !isUserLoaded || !userId || !user) {
        return;
      }

      try {
        const success = await createOrUpdateUser(userId, {
          userId,
          email: user.primaryEmailAddress?.emailAddress || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          lastSignIn: new Date().toISOString(),
        });

        if (success) {
          console.log('User data synced with Firestore');
        } else {
          console.log('Skipped Firestore sync - Firebase not initialized');
        }
      } catch (error) {
        // Log error but don't throw - allow app to function without Firebase
        console.error('Error syncing user data:', error);
      }
    };

    syncUserData();
  }, [isAuthLoaded, isUserLoaded, userId, user]);

  // This component doesn't render anything
  return null;
}
