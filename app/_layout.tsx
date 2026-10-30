import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { ThemeProvider } from '../lib/ThemeContext';
import { registerPushToken } from '../lib/notifications';

// 1. Inner Layout Component that has access to the authentication state context
function InitializerLayout() {
  const { session } = useAuth();

  useEffect(() => {
    // Whenever a valid authenticated user session is active or refreshed on boot,
    // grab the hardware token and upsert it directly to your Supabase table.
    if (session?.user?.id) {
      console.log(`[Token Sync] Activating automatic device token binding loop for user: ${session.user.id}`);
      registerPushToken(session.user.id).catch((err) => {
        console.error('[Token Sync] Token registration failed on root mount:', err);
      });
    }
  }, [session?.user?.id]);

  return <Slot />;
}

// 2. Main Root Export providing contexts globally to the React tree
export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <InitializerLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
