import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter(); 
  
  const [userName, setUserName] = useState('Athlete');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // <-- STATO DELLA FOTO AGGIUNTO!
  const [exercises, setExercises] = useState<any[]>([]);
  
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isWorkoutFinished, setIsWorkoutFinished] = useState(false); 

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState(0);
  const [editSets, setEditSets] = useState(0);
  const [editWeight, setEditWeight] = useState(0);

  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  
  const [weeklyChart, setWeeklyChart] = useState([
    { day: 'Mon', value: 5 }, { day: 'Tue', value: 5 }, { day: 'Wed', value: 5 },
    { day: 'Thu', value: 5 }, { day: 'Fri', value: 5 }, { day: 'Sat', value: 5 }, { day: 'Sun', value: 5 },
  ]);

  // --- LA MAGIA: ORA LEGGE LA TUA FOTO OGNI VOLTA CHE APRI LA PAGINA! ---
  useFocusEffect(
    useCallback(() => {
      getUserInfo();
      fetchExercises();
      fetchWeeklyChart();
    }, [id])
  );

  useEffect(() => {
    setIsWorkoutFinished(false); 
  }, [id]);

  const getUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata) {
      if (user.user_metadata.username) setUserName(user.user_metadata.username);
      if (user.user_metadata.avatar_url) setAvatarUrl(user.user_metadata.avatar_url); // <-- ASSEGNA LA FOTO
    }
  };

  const fetchWeeklyChart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data } = await supabase.from('workout_sessions').select('created_at').eq('user_id', user.id).gte('created_at', sevenDaysAgo.toISOString());

    let newChart = [
      { day: 'Mon', value: 5 }, { day: 'Tue', value: 5 }, { day: 'Wed', value: 5 },
      { day: 'Thu', value: 5 }, { day: 'Fri', value: 5 }, { day: 'Sat', value: 5 }, { day: 'Sun', value: 5 }
    ];

    if (data) {
      data.forEach(session => {
        const date = new Date(session.created_at);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayIndex = newChart.findIndex(d => d.day === dayName);
        if (dayIndex !== -1) newChart[dayIndex].value = 100;
      });
    }
    setWeeklyChart(newChart);
  };

  const fetchExercises = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: exercisesData } = await supabase.from('exercises').select('*').eq('workout_id', id);

    if (exercisesData && user) {
      const exerciseIds = exercisesData.map(ex => ex.id);
      const { data: logsData } = await supabase.from('exercise_logs').select('*').eq('user_id', user.id).in('exercise_id', exerciseIds).order('created_at', { ascending: false }); 

      const formattedData = exercisesData.map(ex => {
        const latestLog = logsData?.find(log => log.exercise_id === ex.id);
        return {
          id: ex.id,
          name: ex.name,
          sets: latestLog ? latestLog.sets : ex.default_sets,
          reps: latestLog ? latestLog.reps : ex.default_reps,
          weight: latestLog ? latestLog.weight : ex.default_weight
        };
      });
      setExercises(formattedData);
    }
    setIsInitialLoading(false);
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const handleOpenExercise = async (exercise: any) => {
    setExpandedId(exercise.id);
    setEditReps(exercise.reps);
    setEditSets(exercise.sets);
    setEditWeight(exercise.weight);
    setExerciseHistory([]); 

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('exercise_logs').select('weight, created_at').eq('exercise_id', exercise.id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(7);
      if (data) setExerciseHistory(data.reverse());
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setExercises(prev => prev.map(ex => ex.id === expandedId ? { ...ex, reps: editReps, sets: editSets, weight: editWeight } : ex));
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('exercise_logs').insert({ exercise_id: expandedId, user_id: user.id, sets: editSets, reps: editReps, weight: editWeight });
      if (!error) {
        await fetchExercises(); 
        setExpandedId(null); 
      } else {
        Alert.alert('Errore', 'Impossibile salvare sul server.');
      }
    }
    setIsSaving(false);
  };

  const handleFinishWorkout = async () => {
    if (isWorkoutFinished) return;
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('workout_sessions').insert({ user_id: user.id, workout_id: id });
      if (!error) {
        setIsWorkoutFinished(true);
        await fetchWeeklyChart(); 
      }
    }
    setIsSaving(false);
  };

  if (isInitialLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={Colors.primary} /></View>
    );
  }

  const maxHistoryWeight = exerciseHistory.length > 0 ? Math.max(...exerciseHistory.map(log => log.weight)) : 1;

  // Seleziona la foto vera se c'è, sennò mostra l'iniziale del nome
  const imageToShow = avatarUrl 
    ? { uri: avatarUrl } 
    : { uri: `https://ui-avatars.com/api/?name=${userName}&background=fff&color=000` };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      {isSaving && (
        <View style={styles.savingOverlay}><View style={styles.savingBox}><ActivityIndicator size="large" color={Colors.background} /><Text style={styles.savingText}>Processing...</Text></View></View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* --- L'HEADER AGGIORNATO CON LA TUA FOTO --- */}
        <View style={styles.header}>
          <Image source={imageToShow} style={styles.avatar} />
          <View>
            <Text style={styles.greeting}>Hi, {userName}</Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Workout</Text>
          
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => router.push(`/edit-workout/${id}`)}
            >
              <Ionicons name="pencil" size={20} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.finishButton, isWorkoutFinished && styles.finishButtonCompleted]} 
              onPress={handleFinishWorkout}
              disabled={isWorkoutFinished}
            >
              <Ionicons name={isWorkoutFinished ? "checkmark-circle" : "checkmark-done"} size={20} color={isWorkoutFinished ? Colors.primary : Colors.background} style={{marginRight: 5}}/>
              <Text style={[styles.finishButtonText, isWorkoutFinished && styles.finishButtonTextCompleted]}>
                {isWorkoutFinished ? "Completed!" : "Finish"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.exerciseList}>
          {exercises.map((exercise) => {
            const isExpanded = expandedId === exercise.id;

            return (
              <View key={exercise.id} style={[styles.exerciseCard, isExpanded && styles.exerciseCardExpanded]}>
                {!isExpanded ? (
                  <TouchableOpacity style={styles.cardCollapsed} onPress={() => handleOpenExercise(exercise)}>
                    <View>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseDetails}>{exercise.sets}x{exercise.reps} {exercise.weight}kg</Text>
                    </View>
                    <View style={styles.addButton}><Ionicons name="add" size={32} color={Colors.primary} /></View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.cardExpandedContent}>
                    
                    <View style={styles.expandedHeader}>
                      <Text style={styles.exerciseNameExpanded}>{exercise.name}</Text>
                      <TouchableOpacity style={styles.saveButton} onPress={handleSave}><Text style={styles.saveButtonText}>Save</Text></TouchableOpacity>
                    </View>

                    <View style={styles.controlsContainer}>
                      <View style={styles.controlRow}>
                        <Text style={styles.controlLabel}>Rep</Text>
                        <View style={styles.controlButtons}>
                          <TouchableOpacity onPress={() => setEditReps(prev => prev + 1)}><Ionicons name="add-circle" size={44} color={Colors.background} /></TouchableOpacity>
                          <Text style={styles.controlValue}>{editReps}</Text>
                          <TouchableOpacity onPress={() => setEditReps(prev => Math.max(0, prev - 1))}><Ionicons name="remove-circle" size={44} color={Colors.background} /></TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.controlRow}>
                        <Text style={styles.controlLabel}>Set</Text>
                        <View style={styles.controlButtons}>
                          <TouchableOpacity onPress={() => setEditSets(prev => prev + 1)}><Ionicons name="add-circle" size={44} color={Colors.background} /></TouchableOpacity>
                          <Text style={styles.controlValue}>{editSets}</Text>
                          <TouchableOpacity onPress={() => setEditSets(prev => Math.max(0, prev - 1))}><Ionicons name="remove-circle" size={44} color={Colors.background} /></TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.controlRow}>
                        <Text style={styles.controlLabel}>Kg</Text>
                        <View style={styles.controlButtons}>
                          <TouchableOpacity onPress={() => setEditWeight(prev => prev + 2.5)}><Ionicons name="add-circle" size={44} color={Colors.background} /></TouchableOpacity>
                          <Text style={styles.controlValue}>{editWeight}</Text>
                          <TouchableOpacity onPress={() => setEditWeight(prev => Math.max(0, prev - 2.5))}><Ionicons name="remove-circle" size={44} color={Colors.background} /></TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View style={styles.blackChartBox}>
                      {exerciseHistory.length === 0 ? (
                        <Text style={{color: Colors.secondary, textAlign: 'center', marginTop: 60}}>No records yet. Save a set!</Text>
                      ) : (
                        <View style={styles.historyChartContainer}>
                          {exerciseHistory.map((log, index) => {
                            const heightPct = Math.max((log.weight / maxHistoryWeight) * 100, 10);
                            const logDate = new Date(log.created_at);
                            const dateString = `${logDate.getDate()}/${logDate.getMonth() + 1}`;
                            return (
                              <View key={index} style={styles.historyBarColumn}>
                                <Text style={styles.historyBarText}>{log.weight}</Text>
                                <View style={styles.historyBarTrack}><View style={[styles.historyBarFill, { height: `${heightPct}%` }]} /></View>
                                <Text style={styles.historyBarDate}>{dateString}</Text>
                              </View>
                            )
                          })}
                        </View>
                      )}
                    </View>

                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.chartContainer}>
          {weeklyChart.map((data, index) => (
            <View key={index} style={styles.barColumn}><View style={styles.barBackground}><View style={[styles.barFill, { height: `${data.value}%` }]} /></View><Text style={styles.barLabel}>{data.day}</Text></View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, marginTop: 10 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, borderWidth: 2, borderColor: Colors.primary },
  greeting: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  date: { color: Colors.secondary, fontSize: 12, marginTop: 4 },
  
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginVertical: 20 },
  pageTitle: { color: Colors.text, fontSize: 28, fontWeight: 'bold' },
  
  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center' },
  editButton: { backgroundColor: Colors.cardBackground, padding: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  
  finishButton: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  finishButtonText: { color: Colors.background, fontSize: 16, fontWeight: 'bold' },
  finishButtonCompleted: { backgroundColor: '#4CD964', borderColor: Colors.primary, borderWidth: 1 },
  finishButtonTextCompleted: { color: Colors.primary },

  exerciseList: { paddingHorizontal: 20 },
  exerciseCard: { backgroundColor: Colors.primary, borderRadius: 35, marginBottom: 15, overflow: 'hidden' },
  exerciseCardExpanded: { paddingBottom: 20 },
  cardCollapsed: { paddingVertical: 15, paddingHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseName: { color: Colors.background, fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  exerciseDetails: { color: '#333333', fontSize: 16 },
  addButton: { backgroundColor: Colors.background, width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  cardExpandedContent: { paddingTop: 25, paddingHorizontal: 25 },
  expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  exerciseNameExpanded: { color: Colors.background, fontSize: 26, fontWeight: 'bold' },
  saveButton: { backgroundColor: Colors.background, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 20 },
  saveButtonText: { color: Colors.primary, fontSize: 16, fontWeight: 'bold' },
  controlsContainer: { marginBottom: 20, paddingHorizontal: 10 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  controlLabel: { fontSize: 22, fontWeight: '500', color: Colors.background },
  controlButtons: { flexDirection: 'row', alignItems: 'center', width: 150, justifyContent: 'space-between' },
  controlValue: { fontSize: 28, fontWeight: 'bold', color: Colors.background, width: 50, textAlign: 'center' },
  
  blackChartBox: { backgroundColor: Colors.background, height: 180, borderRadius: 20, width: '100%', padding: 15 },
  historyChartContainer: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: 10 },
  historyBarColumn: { alignItems: 'center', width: 35 },
  historyBarText: { color: Colors.primary, fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  historyBarTrack: { height: 90, width: 12, justifyContent: 'flex-end', alignItems: 'center' },
  historyBarFill: { width: 12, backgroundColor: Colors.primary, borderRadius: 6 },
  historyBarDate: { color: Colors.secondary, fontSize: 10, marginTop: 5 },
  
  chartContainer: { backgroundColor: Colors.primary, marginHorizontal: 20, marginTop: 20, borderRadius: 30, padding: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 180 },
  barColumn: { alignItems: 'center', flex: 1 },
  barBackground: { height: 100, width: 20, justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: 20, backgroundColor: Colors.background, borderRadius: 10 },
  barLabel: { marginTop: 10, fontSize: 12, fontWeight: '600', color: Colors.background },

  savingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  savingBox: { backgroundColor: Colors.primary, padding: 30, borderRadius: 20, alignItems: 'center' },
  savingText: { color: Colors.background, fontSize: 18, fontWeight: 'bold', marginTop: 15 }
});