import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';

// --- LA NOSTRA GALLERIA RANDOM PER I WORKOUT ---
const GYM_IMAGES = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600&auto=format&fit=crop', // Palestra dark
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=600&auto=format&fit=crop', // Manubri rack
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop', // Pesi
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop', // Ragazza che si allena
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop', // Corde da crossfit
  'https://images.unsplash.com/photo-1596357395217-80de13130e92?q=80&w=600&auto=format&fit=crop', // Dischi bilanciere
];

export default function AddWorkoutScreen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [pendingExercises, setPendingExercises] = useState<any[]>([]);
  const [existingExercises, setExistingExercises] = useState<any[]>([]); 
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState('3');
  const [exReps, setExReps] = useState('8');
  const [exWeight, setExWeight] = useState('0');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: catData } = await supabase.from('categories').select('*');
    if (catData) {
      setCategories(catData);
      if (catData.length > 0) setSelectedCategory(catData[0].id);
    }

    const { data: exData } = await supabase.from('exercises').select('name, default_sets, default_reps, default_weight');
    if (exData) {
      const uniqueExercises = Array.from(new Set(exData.map(e => e.name))).map(name => exData.find(e => e.name === name));
      setExistingExercises(uniqueExercises);
    }
    setLoading(false);
  };

  const filteredSuggestions = existingExercises.filter(ex => 
    ex?.name.toLowerCase().includes(exName.toLowerCase()) && exName.length > 0
  );

  const handleSelectSuggestion = (exercise: any) => {
    setExName(exercise.name);
    setExSets(exercise.default_sets.toString());
    setExReps(exercise.default_reps.toString());
    setExWeight(exercise.default_weight.toString());
    setShowSuggestions(false);
  };

  const handleAddExerciseToList = () => {
    if (!exName.trim()) {
      Alert.alert('Errore', "Inserisci il nome dell'esercizio");
      return;
    }
    
    setPendingExercises([
      ...pendingExercises, 
      { name: exName, sets: parseInt(exSets) || 3, reps: parseInt(exReps) || 8, weight: parseFloat(exWeight) || 0 }
    ]);

    setExName(''); setExSets('3'); setExReps('8'); setExWeight('0'); setShowSuggestions(false);
  };

  const removeExercise = (indexToRemove: number) => {
    setPendingExercises(pendingExercises.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveWorkout = async () => {
    if (!title.trim()) return Alert.alert('Attenzione', 'Dai un nome al tuo Workout!');
    if (!selectedCategory) return Alert.alert('Attenzione', 'Scegli una categoria!');
    if (pendingExercises.length === 0) return Alert.alert('Attenzione', 'Aggiungi almeno un esercizio!');

    setIsSaving(true);
    
    // --- MAGIA: PESCA UN'IMMAGINE A CASO DALLA LISTA ---
    const randomIndex = Math.floor(Math.random() * GYM_IMAGES.length);
    const randomImage = GYM_IMAGES[randomIndex];
    
    const { data: newWorkout, error: workoutError } = await supabase
      .from('workouts')
      .insert({ title: title, category_id: selectedCategory, image_url: randomImage })
      .select()
      .single();

    if (workoutError || !newWorkout) {
      Alert.alert('Errore', 'Impossibile creare il workout');
      setIsSaving(false);
      return;
    }

    const exercisesToInsert = pendingExercises.map(ex => ({
      workout_id: newWorkout.id,
      name: ex.name,
      default_sets: ex.sets,
      default_reps: ex.reps,
      default_weight: ex.weight
    }));

    const { error: exerciseError } = await supabase.from('exercises').insert(exercisesToInsert);

    if (exerciseError) {
      Alert.alert('Errore', 'Workout creato, ma errore nel salvataggio degli esercizi');
    } else {
      router.back(); 
    }
    
    setIsSaving(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.background} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Workout</Text>
        <TouchableOpacity onPress={handleSaveWorkout} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.saveHeaderButton}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.label}>Workout Name</Text>
        <TextInput style={styles.input} placeholder="e.g. Push Day, Leg Killer..." placeholderTextColor={Colors.secondary} value={title} onChangeText={setTitle} />

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
          
          <TextInput style={styles.inputExercise} placeholder="Exercise Name (e.g. Squat)" placeholderTextColor={Colors.secondary} value={exName} onChangeText={(text) => { setExName(text); setShowSuggestions(true); }} />

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

          <TouchableOpacity style={styles.addToListButton} onPress={handleAddExerciseToList}>
            <Ionicons name="add" size={20} color={Colors.background} />
            <Text style={styles.addToListText}>Add to list</Text>
          </TouchableOpacity>
        </View>

        {pendingExercises.length > 0 && (
          <View style={styles.addedListContainer}>
            <Text style={styles.label}>Workout Plan</Text>
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
  addedExDetails: { color: Colors.secondary, fontSize: 14 }
});