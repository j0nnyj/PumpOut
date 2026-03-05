import React, { useEffect } from 'react';
import { View, Text, ImageBackground, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons'; // <-- Importiamo le icone per la freccia

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home'); 
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/home');
      }
    });
  }, []);

  return (
    <ImageBackground 
      source={require('../assets/images/bg-welcome.jpg')} // ASSICURATI CHE IL NOME/PERCORSO SIA GIUSTO!
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        
        {/* --- BLOCCO CENTRALE (Logo e Titoli) --- */}
        <View style={styles.centerBlock}>
          <Image 
            source={require('../assets/images/logo-white.png')} // ASSICURATI CHE IL NOME/PERCORSO SIA GIUSTO!
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>Welcome To</Text>
          <Text style={styles.brandText}>Pumpout</Text>
        </View>

        {/* --- BLOCCO IN BASSO (Bottone e Login) --- */}
        <View style={styles.bottomBlock}>
          <TouchableOpacity 
            style={styles.button} 
            activeOpacity={0.8}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={26} color="#000" style={styles.arrowIcon} />
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Already have account?{' '}
            <Text style={styles.signIn} onPress={() => router.push('/login')}>
              Sign In
            </Text>
          </Text>
        </View>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.45)', // Filtro scuro come nel tuo design
    justifyContent: 'space-between', // Spinge il blocco in basso giù e centra l'altro
    paddingVertical: 60,
    paddingHorizontal: 20 
  },
  
  // ZONA CENTRALE
  centerBlock: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  logo: { 
    width: 140, 
    height: 140, 
    marginBottom: 10 
  },
  welcomeText: { 
    color: '#FFF', 
    fontSize: 38, 
    fontWeight: '700', 
    marginBottom: -5 // Stringe lo spazio tra le due scritte
  },
  brandText: { 
    color: '#FFF', 
    fontSize: 60, // Enorme come nel mockup
    fontWeight: '900', // Il più grassetto possibile
  },

  // ZONA IN BASSO
  bottomBlock: { 
    alignItems: 'center', 
    width: '100%', 
    paddingBottom: 20 
  },
  button: { 
    flexDirection: 'row', // Mette testo e freccia in linea
    backgroundColor: '#FFF', 
    paddingVertical: 18, 
    borderRadius: 35, // Forma a "Pillola"
    width: '90%', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 30 
  },
  buttonText: { 
    color: '#000', 
    fontSize: 20, 
    fontWeight: '800', 
    marginRight: 10 
  },
  arrowIcon: { 
    marginTop: 2 // Riallinea leggermente la freccia col testo
  },
  footerText: { 
    color: '#FFF', 
    fontSize: 16 
  },
  signIn: { 
    fontWeight: 'bold', 
    textDecorationLine: 'underline' 
  }
});