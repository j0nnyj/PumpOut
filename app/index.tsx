import React, { useEffect } from 'react';
import { View, Text, ImageBackground, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase'; // <-- Aggiunto per parlare col database

export default function WelcomeScreen() {
  const router = useRouter();

  // --- IL CONTROLLO MAGICO ---
  useEffect(() => {
    // Appena si apre l'app, controlliamo se c'è una "sessione" salvata
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Se sei già loggato, scavalca questa pagina e vai alla Home!
        router.replace('/home'); 
      }
    });

    // Per sicurezza, se lo stato cambia mentre siamo qui, naviga in automatico
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/home');
      }
    });
  }, []);

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop' }} 
      style={styles.container}
    >
      <View style={styles.overlay}>
        <Image 
          source={{ uri: 'https://ui-avatars.com/api/?name=P&background=fff&color=000&rounded=true&size=128' }} 
          style={styles.logo} 
        />
        
        <Text style={styles.welcomeText}>Welcome To</Text>
        <Text style={styles.brandText}>Pumpout</Text>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.push('/login')}
        >
          <Text style={styles.buttonText}>Get Started  →</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Already have account?{' '}
          <Text style={styles.signIn} onPress={() => router.push('/login')}>
            Sign In
          </Text>
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  logo: { width: 100, height: 100, marginBottom: 40, borderRadius: 50 },
  welcomeText: { color: 'white', fontSize: 28, fontWeight: '600' },
  brandText: { color: 'white', fontSize: 48, fontWeight: 'bold', marginBottom: 40 },
  button: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, width: '80%', alignItems: 'center' },
  buttonText: { fontSize: 18, fontWeight: 'bold' },
  footerText: { color: 'white', marginTop: 20 },
  signIn: { fontWeight: 'bold', textDecorationLine: 'underline' }
});