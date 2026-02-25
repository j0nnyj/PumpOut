import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* La pagina di Welcome */}
      <Stack.Screen name="index" /> 
      {/* Il gruppo che conterrà le pagine col menu in basso */}
      <Stack.Screen name="(tabs)" /> 
    </Stack>
  );
}