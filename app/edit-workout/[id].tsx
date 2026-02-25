import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

export default function EditWorkoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [pendingExercises, setPendingExercises] = useState<any[]>([]);
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<string[]>([]);
  
  const [existingExercises, setExistingExercises] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('8');
  const [exWeight, setExWeight] = useState('0');

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    setLoading(true);
    
    const { data: catData } = await supabase.from('categories').select('*');
    if (catData) setCategories(catData);

    const { data: workoutData } = await supabase.from('workouts').select('*').eq('id', id).single();
    if (workoutData) {
      setTitle(workoutData.title);
      setSelectedCategory(workoutData.category_id);
    }

    const { data: currentExercises } = await supabase.from('exercises').select('*').eq('workout_id', id);
    if (currentExercises) {
      const formatted = currentExercises.map(ex => ({
        id: ex.id, name: ex.name, sets: ex.default_sets, reps: ex.default_reps, weight: ex.default_weight
      }));
      setPendingExercises(formatted);
    }

    const { data: exData } = await supabase.from('exercises').select('name, default_sets, default_reps, default_weight');
    if (exData) {
      const uniqueExercises = Array.from(new Set(exData.map(e => e.name))).map(name => exData.find(e => e.name === name));
      setExistingExercises(uniqueExercises);
    }
    setLoading(false);
  };

  const filteredSuggestions = existingExercises.filter(ex => ex?.name.toLowerCase().includes(exName.toLowerCase()) && exName.length > 0);

  const handleSelectSuggestion = (exercise: any) => {
    setExName(exercise.name); setExSets(exercise.default_sets.toString()); setExReps(exercise.default_reps.toString()); setExWeight(exercise.default_weight.toString());
    setShowSuggestions(false);
  };

  const handleAddExerciseToList = () => {
    if (!exName.trim()) return Alert.alert('Errore', "Inserisci il nome dell'esercizio");
    setPendingExercises([...pendingExercises, { name: exName, sets: parseInt(exSets) || 3, reps: parseInt(exReps) || 8, weight: parseFloat(exWeight) || 0 }]);
    setExName(''); setExSets('3'); setExReps('8'); setExWeight('0'); setShowSuggestions(false);
  };

  const removeExercise = (indexToRemove: number) => {
    const exerciseToRemove = pendingExercises[indexToRemove];
    if (exerciseToRemove.id) {
      Alert.alert("Attenzione!", "Eliminare questo esercizio cancellerà anche i salvataggi (Kg) collegati. Procedere?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
            setDeletedExerciseIds([...deletedExerciseIds, exerciseToRemove.id]);
            setPendingExercises(pendingExercises.filter((_, index) => index !== indexToRemove));
          }
        }
      ]);
    } else {
      setPendingExercises(pendingExercises.filter((_, index) => index !== indexToRemove));
    }
  };

  const handleSaveEdit = async () => {
    if (!title.trim()) return Alert.alert('Attenzione', 'Dai un nome al tuo Workout!');
    if (pendingExercises.length === 0) return Alert.alert('Attenzione', 'Lascia almeno un esercizio!');

    setIsSaving(true);
    await supabase.from('workouts').update({ title: title, category_id: selectedCategory }).eq('id', id);

    if (deletedExerciseIds.length > 0) {
      await supabase.from('exercises').delete().in('id', deletedExerciseIds);
    }

    const newExercises = pendingExercises.filter(ex => !ex.id).map(ex => ({
      workout_id: id, name: ex.name, default_sets: ex.sets, default_reps: ex.reps, default_weight: ex.weight
    }));

    if (newExercises.length > 0) await supabase.from('exercises').insert(newExercises);

    setIsSaving(false);
    Alert.alert('Successo! 🎉', 'Workout modificato perfettamente!');
    router.back(); 
  };

  // --- FUNZIONE PER ELIMINARE TUTTO IL WORKOUT ---
  const handleDeleteWorkout = () => {
    Alert.alert(
      "Elimina Workout 🗑️",
      "Sei sicuro di voler eliminare questa intera scheda? Tutti gli esercizi e i record andranno persi per sempre.",
      [
        { text: "Annulla", style: "cancel" },
        { 
          text: "Elimina", 
          style: "destructive",
          onPress: async () => {
            setIsSaving(true);
            await supabase.from('workouts').delete().eq('id', id);
            setIsSaving(false);
            
            // IL FIX È QUI: Torniamo alla Home passandole il "bigliettino" con la categoria attuale!
            router.navigate({
              pathname: '/(tabs)/home',
              params: { restoreCategory: selectedCategory }
            });
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      {/* OVERLAY DI CARICAMENTO */}
      {isSaving && (
        <View style={styles.savingOverlay}><ActivityIndicator size="large" color={Colors.primary} /></View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={Colors.background} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Workout</Text>
        <TouchableOpacity onPress={handleSaveEdit} disabled={isSaving}>
          <Text style={styles.saveHeaderButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.label}>Workout Name</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 30 }}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat.id} style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipSelected]} onPress={() => setSelectedCategory(cat.id)}>
              <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextSelected]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Add Exercises</Text>
        <View style={styles.addExerciseBox}>
          <TextInput style={styles.inputExercise} placeholder="Exercise Name..." placeholderTextColor={Colors.secondary} value={exName} onChangeText={(text) => { setExName(text); setShowSuggestions(true); }} />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {filteredSuggestions.map((sugg, idx) => (
                <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(sugg)}>
                  <Text style={{color: Colors.text}}>{sugg?.name}</Text>
                  <Text style={{color: Colors.secondary, fontSize: 12}}>{sugg?.default_sets}x{sugg?.default_reps} - {sugg?.default_weight}kg</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.rowInputs}>
            <View style={styles.flexInput}><Text style={styles.smallLabel}>Sets</Text><TextInput style={styles.miniInput} keyboardType="numeric" value={exSets} onChangeText={setExSets} /></View>
            <View style={styles.flexInput}><Text style={styles.smallLabel}>Reps</Text><TextInput style={styles.miniInput} keyboardType="numeric" value={exReps} onChangeText={setExReps} /></View>
            <View style={styles.flexInput}><Text style={styles.smallLabel}>Kg</Text><TextInput style={styles.miniInput} keyboardType="numeric" value={exWeight} onChangeText={setExWeight} /></View>
          </View>
          <TouchableOpacity style={styles.addToListButton} onPress={handleAddExerciseToList}><Ionicons name="add" size={20} color={Colors.background} /><Text style={styles.addToListText}>Add to list</Text></TouchableOpacity>
        </View>

        {pendingExercises.length > 0 && (
          <View style={styles.addedListContainer}>
            <Text style={styles.label}>Current Plan</Text>
            {pendingExercises.map((ex, index) => (
              <View key={index} style={styles.addedExerciseRow}>
                <View>
                  <Text style={styles.addedExName}>{ex.name}</Text>
                  <Text style={styles.addedExDetails}>{ex.sets} Sets  x  {ex.reps} Reps  •  {ex.weight} kg</Text>
                </View>
                <TouchableOpacity onPress={() => removeExercise(index)}>
                  <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* --- TASTO ELIMINA SCHEDA --- */}
        <TouchableOpacity style={styles.deleteWorkoutButton} onPress={handleDeleteWorkout}>
          <Ionicons name="trash" size={22} color={Colors.background} />
          <Text style={styles.deleteWorkoutText}>Delete Workout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  backButton: { backgroundColor: Colors.primary, padding: 8, borderRadius: 20 },
  headerTitle: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  saveHeaderButton: { color: Colors.primary, fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 50 },
  
  label: { color: Colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  input: { backgroundColor: Colors.cardBackground, color: Colors.text, padding: 15, borderRadius: 15, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  
  categoryChip: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: Colors.cardBackground, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  categoryChipSelected: { backgroundColor: Colors.primary },
  categoryChipText: { color: Colors.text, fontWeight: 'bold' },
  categoryChipTextSelected: { color: Colors.background },

  addExerciseBox: { backgroundColor: Colors.cardBackground, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  inputExercise: { backgroundColor: Colors.background, color: Colors.text, padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 15 },
  
  suggestionsContainer: { backgroundColor: Colors.background, borderRadius: 10, marginBottom: 15, maxHeight: 150, overflow: 'hidden' },
  suggestionItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333', flexDirection: 'row', justifyContent: 'space-between' },
  
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  flexInput: { flex: 1, marginHorizontal: 5 },
  smallLabel: { color: Colors.secondary, fontSize: 12, marginBottom: 5, textAlign: 'center' },
  miniInput: { backgroundColor: Colors.background, color: Colors.text, padding: 15, borderRadius: 10, fontSize: 16, textAlign: 'center' },
  
  addToListButton: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 15, marginTop: 10 },
  addToListText: { color: Colors.background, fontWeight: 'bold', fontSize: 16, marginLeft: 5 },

  addedListContainer: { marginTop: 10 },
  addedExerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.cardBackground, padding: 15, borderRadius: 15, marginBottom: 10 },
  addedExName: { color: Colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  addedExDetails: { color: Colors.secondary, fontSize: 14 },

  // --- STILI BOTTONE ELIMINA ---
  deleteWorkoutButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    marginTop: 40,
    marginBottom: 20,
  },
  deleteWorkoutText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  savingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, justifyContent: 'center', alignItems: 'center' }
});