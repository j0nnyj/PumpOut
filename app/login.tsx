import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';

export default function LoginScreen() {
  const router = useRouter();
  
  // Stato per decidere se mostrare il form di Login o quello di Registrazione
  const [isLogin, setIsLogin] = useState(true); 

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // --- FUNZIONE DI LOGIN ---
  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    
    if (error) {
      Alert.alert('Errore di Accesso', error.message);
    } else {
      router.replace('/home'); 
    }
  }

  // --- FUNZIONE DI REGISTRAZIONE ---
  async function signUpWithEmail() {
    if (!username) {
      Alert.alert('Attenzione', 'Inserisci un nome utente per registrarti!');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      // MAGIA: Salviamo il nome utente direttamente nell'account Supabase!
      options: {
        data: {
          username: username,
        }
      }
    });
    setLoading(false);
    
    if (error) {
      Alert.alert('Errore di Registrazione', error.message);
    } else {
      Alert.alert('Successo!', 'Account creato! Ora puoi fare il Login.');
      setIsLogin(true); // Lo riportiamo alla schermata di accesso
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        <Image 
          source={{ uri: 'https://ui-avatars.com/api/?name=P&background=fff&color=000&rounded=true&size=128' }} 
          style={styles.logo} 
        />
        <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Join Pumpout'}</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Sign in to save your workouts' : 'Create an account to start'}</Text>

        {/* --- FORM --- */}
        <View style={styles.inputContainer}>
          
          {/* Mostriamo il campo Username SOLO se stiamo creando un account */}
          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={Colors.secondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.secondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.secondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* --- BOTTONI --- */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={isLogin ? signInWithEmail : signUpWithEmail}
            >
              <Text style={styles.primaryButtonText}>
                {isLogin ? 'Sign In' : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton} 
              // Cambia la modalità tra Login e Registrazione
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.secondaryButtonText}>
                {isLogin ? 'Create Account' : 'Back to Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

// --- STILI (Invariati) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 30, justifyContent: 'center', alignItems: 'center' },
  logo: { width: 100, height: 100, marginBottom: 30, borderRadius: 50 },
  title: { color: Colors.text, fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: Colors.secondary, fontSize: 16, marginBottom: 40 },
  inputContainer: { width: '100%', marginBottom: 30 },
  input: { backgroundColor: Colors.cardBackground, color: Colors.text, height: 60, borderRadius: 15, paddingHorizontal: 20, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  buttonContainer: { width: '100%' },
  primaryButton: { backgroundColor: Colors.primary, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  primaryButtonText: { color: Colors.background, fontSize: 18, fontWeight: 'bold' },
  secondaryButton: { backgroundColor: 'transparent', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.primary },
  secondaryButtonText: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
});