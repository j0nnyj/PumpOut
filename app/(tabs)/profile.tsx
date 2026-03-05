import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';
import { Swipeable } from 'react-native-gesture-handler';

export default function ProfileScreen() {
  const router = useRouter();
  
  // STATI ESISTENTI E FOTO
  const [userName, setUserName] = useState('Athlete');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // NUOVI STATI PER IL CAMBIO NOME
  const [isEditingName, setIsEditingName] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  // NUOVI STATI PER LO STORICO WORKOUTS
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [workoutsHistory, setWorkoutsHistory] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      if (user.user_metadata) {
        setUserName(user.user_metadata.username || 'Athlete');
        setNewNameInput(user.user_metadata.username || 'Athlete'); // Pre-popoliamo l'input
        if (user.user_metadata.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        }
      }

      // Conta i workout totali
      const { count } = await supabase
        .from('workout_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
        
      if (count !== null) setTotalWorkouts(count);
    }
    setLoading(false);
  };

  // --- 1. COMPRESSIONE FOTO PROFILO ---
  const handleChangeProfilePicture = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2, // SUPER COMPRESSIONE! Pesa pochissimo ora.
        base64: true, 
      });

      if (result.canceled || !result.assets[0].base64) return;

      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non trovato");

      const filePath = `${user.id}/${new Date().getTime()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      // --- 🚀 IL FIX FONDAMENTALE PER LA COMMUNITY 🚀 ---
      // Salviamo la foto anche nella tabella 'profiles' pubblica!
      await supabase.from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      // ---------------------------------------------------

      // 6. Aggiorniamo la grafica!
      setAvatarUrl(publicUrl);

    } catch (error) {
      Alert.alert("Errore", "Impossibile caricare l'immagine. Riprova.");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  // --- 2. SALVATAGGIO NUOVO NOME ---
  const handleSaveName = async () => {
    if (newNameInput.trim() === '') {
      Alert.alert("Errore", "Il nome non può essere vuoto.");
      return;
    }
    
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); // <-- Ci serve l'ID dell'utente!
      if (!user) throw new Error("Utente non trovato");

      const newUsername = newNameInput.trim();

      // 1. Aggiorna la cassaforte privata
      const { error: authError } = await supabase.auth.updateUser({
        data: { username: newUsername }
      });
      if (authError) throw authError;

      // 2. 🚀 AGGIORNA IL PROFILO PUBBLICO PER GLI AMICI 🚀
      const { error: profileError } = await supabase.from('profiles')
        .update({ username: newUsername })
        .eq('id', user.id);
      if (profileError) throw profileError;
      
      setUserName(newUsername);
      setIsEditingName(false);
    } catch (error) {
      Alert.alert("Errore", "Non è stato possibile aggiornare il nome.");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  // --- 3. FETCH DELLO STORICO WORKOUTS (DETECTIVE MODE 🕵️‍♂️) ---
  const handleOpenHistory = async () => {
    setIsHistoryModalVisible(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // 1. Pesca tutte le sessioni
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }); 

      if (error || !sessions) {
        console.error("Errore recupero storico:", error);
        return;
      }

      // 2. Raccogliamo gli ID
      const workoutIds = [...new Set(sessions.map(s => s.workout_id).filter(Boolean))];

      if (workoutIds.length > 0) {
        // 3. PRENDIAMO TUTTO (*) COSÌ NON SBAGLIAMO COLONNA!
        const { data: workoutsData, error: wError } = await supabase
          .from('workouts')
          .select('*') 
          .in('id', workoutIds);

        if (wError) console.error("Errore ricerca Nomi Workouts:", wError);

        if (workoutsData) {
          const enrichedSessions = sessions.map(session => {
            const matchingWorkout = workoutsData.find(w => String(w.id) === String(session.workout_id));
            
            // 4. MAGIA: Cerchiamo sia "name" che "title"
            const realName = matchingWorkout ? (matchingWorkout.name || matchingWorkout.title) : null;
            
            return {
              ...session,
              workout_name: realName
            };
          });
          
          setWorkoutsHistory(enrichedSessions);
          return; // Finito!
        }
      }

      // Se fallisce tutto, passa le sessioni lisce
      setWorkoutsHistory(sessions);
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

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
            setIsUploading(true); 
            const { error } = await supabase.rpc('delete_user');
            if (error) {
              Alert.alert("Errore", "Impossibile eliminare l'account in questo momento.");
              setIsUploading(false);
            } else {
              await supabase.auth.signOut();
              router.replace('/login');
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const defaultAvatar = `https://ui-avatars.com/api/?name=${userName}&background=fff&color=000&size=128`;
  const imageToShow = avatarUrl ? { uri: avatarUrl } : { uri: defaultAvatar };

// --- INCOLLA QUESTA FUNZIONE PRIMA DEL RETURN DEL PROFILE SCREEN ---
 // --- FUNZIONE ELIMINA AGGIORNATA (PULISCE TUTTO!) ---
  const handleDeleteSession = (sessionId: string, sessionCreatedAt: string) => {
    Alert.alert("Elimina Workout", "Vuoi cancellare questo allenamento e tutti i dati dei pesi di oggi?", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => {
          setIsUploading(true);
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            // Calcoliamo la stessa finestra di tempo del riassunto (ultimi 5 minuti)
            const sessionDate = new Date(sessionCreatedAt);
            const startTime = new Date(sessionDate.getTime() - (5 * 60 * 1000)).toISOString();
            const endTime = sessionDate.toISOString();

            // 1. ELIMINIAMO TUTTI I RECORD DEI PESI DI QUELLA SESSIONE
            await supabase
              .from('exercise_logs')
              .delete()
              .eq('user_id', user.id)
              .gte('created_at', startTime)
              .lte('created_at', endTime);

            // 2. ELIMINIAMO LA SESSIONE DALLO STORICO
            const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
            
            if (!error) {
              setWorkoutsHistory(prev => prev.filter(s => s.id !== sessionId));
              setTotalWorkouts(prev => Math.max(0, prev - 1)); // Scala il numeretto totale!
            }
          }
          setIsUploading(false);
      }}
    ]);
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        
        {/* ZONA FOTO PROFILO */}
        <TouchableOpacity style={styles.avatarContainer} onPress={handleChangeProfilePicture} disabled={isUploading}>
          <Image source={imageToShow} style={styles.avatar} />
          <View style={styles.editIconBadge}>
            <Ionicons name="camera" size={16} color={Colors.background} />
          </View>
          {isUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        {/* --- ZONA CAMBIO NOME --- */}
        {isEditingName ? (
          <View style={styles.nameEditContainer}>
            <TextInput 
              style={styles.nameInput}
              value={newNameInput}
              onChangeText={setNewNameInput}
              autoFocus
              maxLength={20}
              placeholderTextColor={Colors.secondary}
            />
            <TouchableOpacity onPress={handleSaveName} style={styles.saveNameBtn}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsEditingName(false)} style={styles.cancelNameBtn}>
              <Ionicons name="close-circle" size={36} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameDisplayContainer}>
            <Text style={styles.title}>{userName}</Text>
            <TouchableOpacity onPress={() => setIsEditingName(true)} style={{ marginLeft: 10 }}>
              <Ionicons name="pencil" size={24} color={Colors.secondary} />
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.subtitle}>Pumpout Member</Text>

        
{/* --- SCHEDA STORICO WORKOUTS (ORA CLICCABILE) --- */}
        <TouchableOpacity style={styles.statsCard} onPress={handleOpenHistory} activeOpacity={0.8}>
          <View style={styles.statItem}>
            <Ionicons name="barbell" size={32} color={Colors.background} />
            <Text style={styles.statNumber}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts Done</Text>
            <View style={styles.clickToSeeHint}>
                <Text style={styles.hintText}>Tap to see history</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.manageCategoriesButton} onPress={() => router.push('/manage-categories')}>
          <Ionicons name="settings-outline" size={24} color={Colors.primary} style={{marginRight: 8}} />
          <Text style={styles.manageCategoriesText}>Manage Categories</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={Colors.text} style={{marginRight: 8}} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 20, padding: 10 }} onPress={handleDeleteAccount}>
          <Text style={{ color: '#FF3B30', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' }}>
            Delete Account
          </Text>
        </TouchableOpacity>

      </View>

     {/* --- MODAL STORICO WORKOUTS --- */}
      <Modal visible={isHistoryModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>History</Text>
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
                <Ionicons name="close-circle" size={32} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {workoutsHistory.length === 0 ? (
              <Text style={{ textAlign: 'center', color: Colors.secondary, marginTop: 40, fontSize: 16 }}>No workouts completed yet! 💪</Text>
            ) : (
              <FlatList
                data={workoutsHistory}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
               renderItem={({ item }) => {
                  const d = new Date(item.created_at);
                  const formattedDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  const workoutName = item.workout_name || `Workout del ${d.getDate()}/${d.getMonth() + 1}`;
                  
                 // IL BOTTONE CESTINO CHE APPARE QUANDO FAI LO SLIDE
                  const renderRightActions = () => (
                    <TouchableOpacity 
                      style={{ backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', width: 80, height: '90%', borderRadius: 20, marginLeft: 10 }}
                      onPress={() => handleDeleteSession(item.id, item.created_at)} // <-- QUI ABBIAMO AGGIUNTO LA DATA!
                    >
                      <Ionicons name="trash" size={28} color="#FFF" />
                    </TouchableOpacity>
                  );

                  return (
                    // AVVOLGIAMO LA RIGA CON LO SWIPEABLE
                    <Swipeable renderRightActions={renderRightActions} friction={2}>
                      <TouchableOpacity 
                        style={styles.historyRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          setIsHistoryModalVisible(false);
                          router.push({
                            pathname: `/workout-summary/${item.id}`,
                            params: { workoutName: workoutName, date: d.toISOString() }
                          });
                        }}
                      >
                        <View style={styles.historyIconBox}>
                          <Ionicons name="checkmark-done" size={24} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyWorkoutName}>{workoutName}</Text>
                          <Text style={styles.historyRowDate}>{formattedDate} • {formattedTime}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors.secondary} />
                      </TouchableOpacity>
                    </Swipeable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: Colors.primary },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.background },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 60, justifyContent: 'center', alignItems: 'center' },

  // Stili per il nome editabile
  nameDisplayContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  nameEditContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  nameInput: { backgroundColor: Colors.cardBackground, color: Colors.text, fontSize: 24, fontWeight: 'bold', paddingVertical: 5, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, borderColor: Colors.primary, minWidth: 150, textAlign: 'center' },
  saveNameBtn: { marginLeft: 10 },
  cancelNameBtn: { marginLeft: 5 },

  title: { color: Colors.text, fontSize: 32, fontWeight: 'bold' },
  subtitle: { color: Colors.secondary, fontSize: 16, marginBottom: 40 },
  
  statsCard: { backgroundColor: Colors.primary, paddingVertical: 30, paddingHorizontal: 50, borderRadius: 30, alignItems: 'center', marginBottom: 40, width: '100%' },
  statItem: { alignItems: 'center' },
  statNumber: { color: Colors.background, fontSize: 48, fontWeight: 'bold', marginVertical: 10 },
  statLabel: { color: Colors.background, fontSize: 16, fontWeight: '600' },
  clickToSeeHint: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: 20 },
  hintText: { color: Colors.primary, fontSize: 12, fontWeight: 'bold', marginRight: 4 },
  
  manageCategoriesButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, borderWidth: 1, borderColor: '#333', marginBottom: 20, width: '80%', justifyContent: 'center' },
  manageCategoriesText: { color: Colors.primary, fontSize: 18, fontWeight: 'bold' },

  logoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, width: '80%', justifyContent: 'center' },
  logoutText: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },

  // Stili Modal Storico
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.cardBackground, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, maxHeight: '80%', minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text },
  historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 15, borderRadius: 20, marginBottom: 12 },
  historyIconBox: { backgroundColor: '#CCFF0020', padding: 10, borderRadius: 15, marginRight: 15 },
  historyWorkoutName: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 2 },
  historyRowDate: { fontSize: 13, color: Colors.secondary, fontWeight: '500' },
});