import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';

export default function FriendWorkoutScreen() {
  const router = useRouter();
  // Assicurati che i parametri in ingresso siano corretti rispetto a come li passi dal feed social
  const { workoutId, friendName, avatarUrl, friendId } = useLocalSearchParams(); 

  const [loading, setLoading] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState(false);
  
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);

  useEffect(() => {
    fetchFriendWorkout();
  }, [workoutId]);

  const fetchFriendWorkout = async () => {
    setLoading(true);
    
    // 1. Scarica i dettagli base della scheda
    const { data: workout } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .single();
      
    if (workout) setWorkoutData(workout);

    // 🔥 LA MOSSA GENIALE: L'ID dell'amico ce l'abbiamo già qui, dentro la scheda!
    const realFriendId = workout?.user_id || friendId;

    // 2. Scarica la lista degli esercizi
    const { data: exData } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_id', workoutId)
      .order('order_index', { ascending: true });

    if (exData) {
       let logsData = null;

       // 3. Peschiamo i suoi veri logs usando l'ID estratto dalla scheda
       if (realFriendId) {
         const exerciseIds = exData.map(ex => ex.id);
         const { data: fetchedLogs } = await supabase
            .from('exercise_logs')
            .select('*')
            .eq('user_id', realFriendId)
            .in('exercise_id', exerciseIds)
            .order('created_at', { ascending: false });
            
         logsData = fetchedLogs;
       }

       // 4. UNIFICHIAMO I DATI (A prova di bomba)
       const formattedData = exData.map(ex => {
         const latestLog = logsData?.find((log: any) => log.exercise_id === ex.id);
         
         const finalSets = latestLog ? latestLog.sets : (ex.default_sets || 0);
         const finalReps = latestLog ? latestLog.reps : (ex.default_reps || 0);
         const finalWeight = latestLog ? latestLog.weight : (ex.default_weight || 0);

         return {
           id: ex.id,
           name: ex.name,
           // Li mappiamo con entrambi i nomi, così la grafica li trova SEMPRE!
           sets: finalSets,
           reps: finalReps,
           weight: finalWeight,
           default_sets: finalSets,
           default_reps: finalReps,
           default_weight: finalWeight,
           set_type: latestLog ? latestLog.set_type : null, 
           notes: latestLog ? latestLog.notes : '',
         };
       });
       
       setExercises(formattedData);
    }
    
    setLoading(false);
  };

  // --- LA MAGIA: FUNZIONE PER RUBARE IL WORKOUT! 🥷 ---
  const handleStealWorkout = async () => {
    Alert.alert(
      "Steal Workout 🥷",
      `Vuoi copiare la scheda "${workoutData?.title}" nei tuoi allenamenti?`,
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

              // 1. Trova o crea una categoria "Stolen Workouts" (Più ordinato!)
              let myCategoryId;
              const { data: categoryCheck } = await supabase
                .from('categories')
                .select('id')
                .eq('user_id', user.id)
                .ilike('name', 'Stolen%') // Cerca se hai già una categoria che inizia con "Stolen"
                .limit(1);

              if (categoryCheck && categoryCheck.length > 0) {
                 myCategoryId = categoryCheck[0].id;
              } else {
                 // Se non ce l'ha, gliela creiamo noi al volo
                 const { data: newCat } = await supabase.from('categories').insert({
                    user_id: user.id,
                    name: "Stolen Workouts 🥷",
                    image_url: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=2069&auto=format&fit=crop"
                 }).select().single();
                 myCategoryId = newCat?.id;
              }

              if(!myCategoryId) {
                 // Estremo fallback: prendi la prima categoria che capita
                 const { data: anyCat } = await supabase.from('categories').select('id').eq('user_id', user.id).limit(1);
                 myCategoryId = anyCat?.[0]?.id;
              }

              if (!myCategoryId) {
                 Alert.alert("Errore", "Impossibile trovare o creare una categoria per salvare la scheda.");
                 setIsDuplicating(false);
                 return;
              }

              // 2. Creiamo il nuovo Workout per TE
              const { data: newWorkout, error: workoutError } = await supabase
                .from('workouts')
                .insert({
                  title: `${workoutData.title} (by ${friendName})`,
                  image_url: workoutData.image_url,
                  category_id: myCategoryId,
                  user_id: user.id
                })
                .select()
                .single();

              if (workoutError || !newWorkout) throw workoutError;

              // 3. Copiamo tutti gli esercizi (prendendo i kg e le rep attuali) dentro il tuo nuovo workout
              if (exercises.length > 0) {
                const exercisesToInsert = exercises.map((ex, index) => ({
                  workout_id: newWorkout.id,
                  name: ex.name,
                  default_sets: ex.sets,       // Usiamo i valori "veri" dell'amico come base di partenza per te
                  default_reps: ex.reps,
                  default_weight: ex.weight,
                  order_index: index
                }));

                const { error: exError } = await supabase.from('exercises').insert(exercisesToInsert);
                if (exError) throw exError;
              }

              Alert.alert("Fatto! 🎉", "Il workout è ora nella tua Home!");
              router.navigate({
                  pathname: '/(tabs)/home',
                  params: { restoreCategory: myCategoryId }
              });

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
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
                
                {/* INTESTAZIONE CON BADGE INTENSITA' */}
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {exercise.set_type && (
                     <View style={styles.typeBadge}>
                       <Text style={styles.typeBadgeText}>{exercise.set_type}</Text>
                     </View>
                  )}
                </View>

                {/* STATISTICHE (I veri kg del tuo amico) */}
                <View style={styles.exerciseDetailsRow}>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>SETS</Text>
                    <Text style={styles.detailValue}>{exercise.sets}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>REPS</Text>
                    <Text style={styles.detailValue}>{exercise.reps}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>WEIGHT</Text>
                    <Text style={styles.detailValue}>{exercise.weight} kg</Text>
                  </View>
                </View>

                {/* LE SUE NOTE SEGRETE */}
                {exercise.notes ? (
                  <View style={styles.notesContainer}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.secondary} style={{ marginRight: 6, marginTop: 2 }} />
                    <Text style={styles.notesText}>"{exercise.notes}"</Text>
                  </View>
                ) : null}

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
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 15, marginBottom: 15 },
  exerciseName: { color: Colors.text, fontSize: 22, fontWeight: 'bold', flex: 1 },
  
  typeBadge: { backgroundColor: 'rgba(208, 253, 62, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginLeft: 10 },
  typeBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: 'bold' },

  exerciseDetailsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailBox: { alignItems: 'center', flex: 1 },
  detailLabel: { color: Colors.secondary, fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  detailValue: { color: Colors.primary, fontSize: 24, fontWeight: 'bold' },

  notesContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 10, marginTop: 15, alignItems: 'flex-start' },
  notesText: { color: Colors.secondary, fontSize: 14, fontStyle: 'italic', flex: 1, lineHeight: 20 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: '#333' },
  stealButton: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 18, borderRadius: 30 },
  stealButtonText: { color: Colors.background, fontSize: 18, fontWeight: 'bold' }
});