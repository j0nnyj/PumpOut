import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; // <-- Importa la galleria
import { decode } from 'base64-arraybuffer'; // <-- Serve per tradurre l'immagine per Supabase
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

export default function ProfileScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('Athlete');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // Nuovo stato per la foto!
  
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false); // Stato per il caricamento foto

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    //setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      if (user.user_metadata) {
        setUserName(user.user_metadata.username || 'Athlete');
        // Se l'utente ha già salvato una foto in passato, la carichiamo!
        if (user.user_metadata.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        }
      }

      const { count } = await supabase
        .from('workout_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
        
      if (count !== null) setTotalWorkouts(count);
    }
    setLoading(false);
  };

  // --- FUNZIONE PER CAMBIARE LA FOTO ---
  const handleChangeProfilePicture = async () => {
    try {
      // 1. Apriamo la galleria del telefono
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Ti fa ritagliare la foto a quadrato!
        aspect: [1, 1],
        quality: 0.5, // Riduciamo la qualità per un caricamento veloce
        base64: true, // Chiediamo a Expo di darci il codice "grezzo" dell'immagine
      });

      if (result.canceled || !result.assets[0].base64) {
        return; // Se l'utente chiude la galleria senza scegliere nulla, ci fermiamo qui
      }

      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non trovato");

      // 2. Creiamo un nome unico per il file (es: id-utente/123456789.jpg)
      const filePath = `${user.id}/${new Date().getTime()}.jpg`;

      // 3. Carichiamo la foto nel bucket "avatars" di Supabase
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      // 4. Chiediamo a Supabase il link pubblico della foto appena caricata
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 5. Salviamo questo link nel profilo dell'utente (metadata)
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      // 6. Aggiorniamo la grafica!
      setAvatarUrl(publicUrl);

    } catch (error) {
      Alert.alert("Errore", "Impossibile caricare l'immagine. Riprova.");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // --- FUNZIONE ELIMINA ACCOUNT (LEGGE DI APPLE) ---
  const handleDeleteAccount = () => {
    Alert.alert(
      "Warning 🚨",
      "Are you sure you want to delete your account? All your workouts, friends, and progress will be permanently lost. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete My Account", 
          style: "destructive",
          onPress: async () => {
            setIsUploading(true); // Usiamo la rotellina per far capire che sta lavorando
            
            // Chiama la nostra funzione SQL "Distruttore"
            const { error } = await supabase.rpc('delete_user');
            
            if (error) {
              Alert.alert("Errore", "Impossibile eliminare l'account in questo momento.");
              setIsUploading(false);
            } else {
              // Se ha funzionato, lo scolleghiamo e lo buttiamo fuori dall'app!
              await supabase.auth.signOut();
              router.replace('/login');
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  // Decidiamo quale foto mostrare: Quella personalizzata o quella di default
  const defaultAvatar = `https://ui-avatars.com/api/?name=${userName}&background=fff&color=000&size=128`;
  const imageToShow = avatarUrl ? { uri: avatarUrl } : { uri: defaultAvatar };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        
        {/* --- ZONA FOTO PROFILO CLICCABILE --- */}
        <TouchableOpacity style={styles.avatarContainer} onPress={handleChangeProfilePicture} disabled={isUploading}>
          <Image source={imageToShow} style={styles.avatar} />
          
          {/* Icona della matita sopra la foto */}
          <View style={styles.editIconBadge}>
            <Ionicons name="camera" size={16} color={Colors.background} />
          </View>
          
          {/* Rotellina di caricamento quando si fa l'upload */}
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.title}>{userName}</Text>
        <Text style={styles.subtitle}>Pumpout Member</Text>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="barbell" size={32} color={Colors.background} />
            <Text style={styles.statNumber}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts Done</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.manageCategoriesButton} onPress={() => router.push('/manage-categories')}>
          <Ionicons name="settings-outline" size={24} color={Colors.primary} style={{marginRight: 8}} />
          <Text style={styles.manageCategoriesText}>Manage Categories</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={Colors.text} style={{marginRight: 8}} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* --- NUOVO TASTO ELIMINA ACCOUNT --- */}
        <TouchableOpacity 
          style={{ marginTop: 20, padding: 10 }} 
          onPress={handleDeleteAccount}
        >
          <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' }}>
            Delete Account
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  // Stili Immagine Profilo Cliccabile
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    borderWidth: 3, 
    borderColor: Colors.primary 
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: { color: Colors.text, fontSize: 32, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { color: Colors.secondary, fontSize: 16, marginBottom: 40 },
  
  statsCard: { backgroundColor: Colors.primary, paddingVertical: 30, paddingHorizontal: 50, borderRadius: 30, alignItems: 'center', marginBottom: 40, width: '100%' },
  statItem: { alignItems: 'center' },
  statNumber: { color: Colors.background, fontSize: 48, fontWeight: 'bold', marginVertical: 10 },
  statLabel: { color: Colors.background, fontSize: 16, fontWeight: '600' },
  
  manageCategoriesButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, borderWidth: 1, borderColor: '#333', marginBottom: 20, width: '80%', justifyContent: 'center' },
  manageCategoriesText: { color: Colors.primary, fontSize: 18, fontWeight: 'bold' },

  logoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, width: '80%', justifyContent: 'center' },
  logoutText: { color: Colors.text, fontSize: 18, fontWeight: 'bold' }
});