import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';

export default function FriendWorkoutScreen() {
  const router = useRouter();
  const { workoutId, friendName, avatarUrl } = useLocalSearchParams(); 

  const [loading, setLoading] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState(false); // <-- Stato per il caricamento del furto!
  
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => {
    fetchFriendWorkout();
  }, [workoutId]);

  const fetchFriendWorkout = async () => {
    setLoading(true);
    
    const { data: workout } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .single();
      
    if (workout) setWorkoutData(workout);

    const { data: exData } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_id', workoutId);

    if (exData) setExercises(exData);
    
    setLoading(false);
  };

  // --- LA MAGIA: FUNZIONE PER RUBARE IL WORKOUT! 🥷 ---
  const handleStealWorkout = async () => {
    Alert.alert(
      "Steal Workout 🥷",
      `Vuoi copiare la scheda "${workoutData?.title}" di ${friendName} nei tuoi allenamenti?`,
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Copia", 
          style: "default",
          onPress: async () => {
            setIsDuplicating(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error("Utente non trovato");

              // 1. Troviamo la tua prima categoria disponibile per appoggiarci il workout
              const { data: myCategories } = await supabase
                .from('categories')
                .select('id')
                .eq('user_id', user.id)
                .limit(1);

              if (!myCategories || myCategories.length === 0) {
                Alert.alert("Errore", "Non hai nessuna categoria. Creane una prima!");
                setIsDuplicating(false);
                return;
              }
              const myCategoryId = myCategories[0].id;

              // 2. Creiamo il nuovo Workout per TE
              const { data: newWorkout, error: workoutError } = await supabase
                .from('workouts')
                .insert({
                  title: `${workoutData.title} (by ${friendName})`, // Aggiungiamo un tag per ricordarci di chi era!
                  image_url: workoutData.image_url,
                  category_id: myCategoryId,
                  user_id: user.id
                })
                .select()
                .single();

              if (workoutError || !newWorkout) throw workoutError;

              // 3. Copiamo tutti gli esercizi dentro il tuo nuovo workout
              if (exercises.length > 0) {
                const exercisesToInsert = exercises.map(ex => ({
                  workout_id: newWorkout.id,
                  name: ex.name,
                  default_sets: ex.default_sets,
                  default_reps: ex.default_reps,
                  default_weight: ex.default_weight
                }));

                const { error: exError } = await supabase.from('exercises').insert(exercisesToInsert);
                if (exError) throw exError;
              }

              // 4. Successo! Ti riportiamo alla Home per farti vedere il bottino
              Alert.alert("Fatto! 🎉", "Il workout è ora nella tua Home!");
              router.navigate('/(tabs)/home');

            } catch (error) {
              Alert.alert("Errore", "Impossibile copiare il workout.");
              console.error(error);
            } finally {
              setIsDuplicating(false);
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const friendAvatar = avatarUrl 
    ? { uri: avatarUrl as string } 
    : { uri: `https://ui-avatars.com/api/?name=${friendName}&background=fff&color=000` };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.background} />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          <Image source={friendAvatar} style={styles.avatar} />
          <Text style={styles.headerTitle}>{friendName}'s Plan</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {workoutData?.image_url && (
          <Image source={{ uri: workoutData.image_url }} style={styles.coverImage} />
        )}

        <Text style={styles.workoutTitle}>{workoutData?.title}</Text>
        
        <View style={styles.infoBadge}>
          <Ionicons name="eye" size={16} color={Colors.primary} style={{marginRight: 5}} />
          <Text style={styles.infoText}>Read-Only Mode</Text>
        </View>

        <View style={styles.exerciseList}>
          {exercises.length === 0 ? (
            <Text style={{color: Colors.secondary, textAlign: 'center', marginTop: 20}}>No exercises found.</Text>
          ) : (
            exercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                </View>
                <View style={styles.exerciseDetailsRow}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>SETS</Text>
                    <Text style={styles.detailValue}>{exercise.default_sets}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>REPS</Text>
                    <Text style={styles.detailValue}>{exercise.default_reps}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>WEIGHT</Text>
                    <Text style={styles.detailValue}>{exercise.default_weight} kg</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* --- IL SUPER TASTO PER RUBARE IL WORKOUT (Fisso in basso) --- */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.stealButton} 
          onPress={handleStealWorkout}
          disabled={isDuplicating}
        >
          {isDuplicating ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <>
              <Ionicons name="download-outline" size={24} color={Colors.background} style={{marginRight: 8}} />
              <Text style={styles.stealButtonText}>Save to My Workouts</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  backButton: { backgroundColor: Colors.primary, padding: 8, borderRadius: 20 },
  headerProfile: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },

  coverImage: { width: '100%', height: 200, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, opacity: 0.8 },
  workoutTitle: { color: Colors.text, fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginTop: 20, paddingHorizontal: 20 },
  
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.1)', alignSelf: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginTop: 10, marginBottom: 30, borderWidth: 1, borderColor: Colors.primary },
  infoText: { color: Colors.primary, fontWeight: 'bold' },

  exerciseList: { paddingHorizontal: 20 },
  exerciseCard: { backgroundColor: Colors.cardBackground, borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  exerciseHeader: { borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 15, marginBottom: 15 },
  exerciseName: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  
  exerciseDetailsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailBox: { alignItems: 'center', flex: 1 },
  detailLabel: { color: Colors.secondary, fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  detailValue: { color: Colors.primary, fontSize: 24, fontWeight: 'bold' },

  // Stile per la barra in basso
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: '#333' },
  stealButton: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 18, borderRadius: 30 },
  stealButtonText: { color: Colors.background, fontSize: 18, fontWeight: 'bold' }
});