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

    const sessionDate = new Date(date as string);
    
    // Riduciamo la finestra di ricerca a soli 5 minuti prima della fine dell'allenamento!
    const startTime = new Date(sessionDate.getTime() - (5 * 60 * 1000)).toISOString();
    const endTime = sessionDate.toISOString();

    const { data, error } = await supabase
      .from('exercise_logs')
      .select(`id, sets, reps, weight, created_at, exercises (name)`)
      .eq('user_id', user.id)
      .gte('created_at', startTime)
      .lte('created_at', endTime)
      .order('created_at', { ascending: true }); 

    if (data) {
      // MAGIA ANTI-DOPPIONI: Teniamo solo la versione più recente di ogni esercizio
      const uniqueLogs: any[] = [];
      const seenNames = new Set();
      
      // Giriamo la lista al contrario per beccare prima i più recenti
     data.reverse().forEach((log: any) => { // <-- Aggiunto ": any" per calmare TypeScript
        
        // Se è un array prendiamo il primo elemento, altrimenti lo leggiamo normale
        const exName = Array.isArray(log.exercises) 
          ? log.exercises[0]?.name 
          : log.exercises?.name;

        // Se ha un nome e non l'abbiamo ancora visto, lo salviamo
        if (exName && !seenNames.has(exName)) {
          seenNames.add(exName);
          uniqueLogs.push(log);
        }
      });
      
      // Li rimettiamo in ordine e li salviamo
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
      
      {/* HEADER COPIATO DALLA TUA GRAFICA */}
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
                <Text style={styles.exerciseName}>{item.exercises?.name || 'Deleted Exercise'}</Text>
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
  exerciseName: { color: Colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { backgroundColor: Colors.background, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  statBoxPrimary: { backgroundColor: Colors.primary },
  statValue: { color: Colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { color: Colors.secondary, fontSize: 10, fontWeight: 'bold' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: Colors.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 20 },
  emptySubtext: { color: Colors.secondary, fontSize: 14, textAlign: 'center', marginTop: 10 },
});