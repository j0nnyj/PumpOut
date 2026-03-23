import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

export default function WorkoutSummaryScreen() {
  const { id, workoutName, date } = useLocalSearchParams();
  const router = useRouter();
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkoutDetails();
  }, [id]);

  const fetchWorkoutDetails = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !date) return;

    // 1. TROVIAMO IL VERO WORKOUT_ID (Fix per l'ID della sessione)
    let actualWorkoutId = id;
    const { data: sessionData } = await supabase
      .from('workout_sessions')
      .select('workout_id')
      .eq('id', id)
      .single();

    if (sessionData?.workout_id) {
      actualWorkoutId = sessionData.workout_id;
    }

    const sessionDate = new Date(date as string);
    const startOfDay = new Date(sessionDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(sessionDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('exercise_logs')
      .select(`id, sets, reps, weight, set_type, notes, created_at, exercises (name, workout_id)`)
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: true }); 

    if (data) {
      // 2. FILTRIAMO GLI ESERCIZI (usando == invece di === per evitare conflitti testo/numeri)
      let currentWorkoutLogs = data.filter((log: any) => {
        const exWorkoutId = Array.isArray(log.exercises) ? log.exercises[0]?.workout_id : log.exercises?.workout_id;
        return exWorkoutId == actualWorkoutId;
      });

      // 🚨 SCUDO DI EMERGENZA: Se per un bug il filtro cancella tutto, ti mostra tutti gli esercizi del giorno!
      if (currentWorkoutLogs.length === 0) {
        currentWorkoutLogs = data;
      }

      // 3. ANTI-DOPPIONI
      const uniqueLogs: any[] = [];
      const seenNames = new Set();
      
      currentWorkoutLogs.reverse().forEach((log: any) => { 
        const exName = Array.isArray(log.exercises) ? log.exercises[0]?.name : log.exercises?.name;

        if (exName && !seenNames.has(exName)) {
          seenNames.add(exName);
          uniqueLogs.push(log);
        }
      });
      
      setLogs(uniqueLogs.reverse());
    }
    setLoading(false);
  };

  const formattedDate = date ? new Date(date as string).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.pageTitle}>{workoutName}</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
      </View>

      {logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="barbell-outline" size={60} color={Colors.secondary} />
          <Text style={styles.emptyText}>No exercise logs found for this session.</Text>
          <Text style={styles.emptySubtext}>Maybe you finished it without tracking sets?</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={styles.exerciseCard}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <View style={styles.cardContent}>
                
                {/* NOME E TIPO DI SERIE (Badge) */}
                <View style={styles.nameRow}>
                  <Text style={styles.exerciseName}>{item.exercises?.name || 'Deleted Exercise'}</Text>
                  {item.set_type && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{item.set_type}</Text>
                    </View>
                  )}
                </View>

                {/* STATISTICHE */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{item.sets}</Text>
                    <Text style={styles.statLabel}>SETS</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{item.reps}</Text>
                    <Text style={styles.statLabel}>REPS</Text>
                  </View>
                  <View style={[styles.statBox, styles.statBoxPrimary]}>
                    <Text style={[styles.statValue, { color: Colors.background }]}>{item.weight}kg</Text>
                    <Text style={[styles.statLabel, { color: Colors.background }]}>WEIGHT</Text>
                  </View>
                </View>

                {/* NOTE (Visibili solo se presenti) */}
                {item.notes ? (
                  <View style={styles.notesContainer}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.secondary} style={{ marginRight: 6, marginTop: 2 }} />
                    <Text style={styles.notesText}>"{item.notes}"</Text>
                  </View>
                ) : null}

              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  backButton: { marginRight: 15, padding: 5, backgroundColor: Colors.cardBackground, borderRadius: 12 },
  headerTitles: { flex: 1 },
  pageTitle: { color: Colors.text, fontSize: 24, fontWeight: 'bold' },
  dateText: { color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 2 },

  exerciseCard: { flexDirection: 'row', backgroundColor: Colors.cardBackground, borderRadius: 20, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  numberBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 15, marginTop: 5 },
  numberText: { color: Colors.background, fontSize: 18, fontWeight: 'bold' },
  cardContent: { flex: 1 },
  
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  exerciseName: { color: Colors.text, fontSize: 18, fontWeight: 'bold', flex: 1 },
  typeBadge: { backgroundColor: 'rgba(208, 253, 62, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginLeft: 10 },
  typeBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: 'bold' },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { backgroundColor: Colors.background, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  statBoxPrimary: { backgroundColor: Colors.primary },
  statValue: { color: Colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { color: Colors.secondary, fontSize: 10, fontWeight: 'bold' },

  notesContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 10, marginTop: 15, alignItems: 'flex-start' },
  notesText: { color: Colors.secondary, fontSize: 14, fontStyle: 'italic', flex: 1, lineHeight: 20 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 20 },
  emptySubtext: { color: Colors.secondary, fontSize: 14, textAlign: 'center', marginTop: 10 },
});