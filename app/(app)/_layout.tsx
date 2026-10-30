import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="alarm-settings" options={{ presentation: 'card' }} />
      <Stack.Screen name="member/[id]" />
      <Stack.Screen name="add-alarm" options={{ presentation: 'modal' }} />
      <Stack.Screen name="alarm-ringing" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
    </Stack>
  );
}