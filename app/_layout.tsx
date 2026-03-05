// ⚠️ PRIMA RIGA IN ASSOLUTO ⚠️
import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack 
        screenOptions={{ 
          headerShown: false, 
          gestureEnabled: true, // Riattiva il gesto che avevamo perso
          animation: 'slide_from_right', // <-- ECCO IL COMANDO CORRETTO (Niente più rosso!)
          fullScreenGestureEnabled: true // Puoi fare lo slide da ovunque!
        }} 
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}