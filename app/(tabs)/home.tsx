import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 

  const [userName, setUserName] = useState('Athlete');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // Stato della foto
  
  const [categories, setCategories] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [weeklyChart, setWeeklyChart] = useState([
    { day: 'Mon', value: 5 }, { day: 'Tue', value: 5 }, { day: 'Wed', value: 5 },
    { day: 'Thu', value: 5 }, { day: 'Fri', value: 5 }, { day: 'Sat', value: 5 }, { day: 'Sun', value: 5 },
  ]);

  // --- IL FIX È QUI! ---
  // Tutto quello che c'è qui dentro viene ricaricato OGNI SINGOLA VOLTA che guardi la Home
  useFocusEffect(
    useCallback(() => {
      
      if (params.restoreCategory) {
        setSelectedCategory(params.restoreCategory as string);
        router.setParams({ restoreCategory: '' }); 
      }

      getUserInfo(); // <--- ORA SCARICA LA TUA FOTO OGNI VOLTA!
      fetchData();
      fetchWeeklyChart();
    }, [params.restoreCategory]) 
  );

  const getUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.user_metadata) {
      if (user.user_metadata.username) setUserName(user.user_metadata.username);
      if (user.user_metadata.avatar_url) setAvatarUrl(user.user_metadata.avatar_url);
    }
  };

  const fetchData = async () => {
    try {
      const { data: catData, error: catError } = await supabase.from('categories').select('*');
      if (catError) throw catError;
      
      setCategories(catData || []);
      
      if (catData && catData.length > 0) {
        setSelectedCategory((prevCategory) => prevCategory !== null ? prevCategory : catData[0].id);
      }

      const { data: workData, error: workError } = await supabase.from('workouts').select('*');
      if (workError) throw workError;

      const workoutsWithAddButton = [
        ...(workData || []),
        { id: 'add', title: 'Add Workout', isAdd: true }
      ];
      setWorkouts(workoutsWithAddButton);

    } catch (error) {
      console.error("Errore nel caricamento:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyChart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data } = await supabase
      .from('workout_sessions')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', sevenDaysAgo.toISOString());

    let newChart = [
      { day: 'Mon', value: 5 }, { day: 'Tue', value: 5 }, { day: 'Wed', value: 5 },
      { day: 'Thu', value: 5 }, { day: 'Fri', value: 5 }, { day: 'Sat', value: 5 }, { day: 'Sun', value: 5 }
    ];

    if (data) {
      data.forEach(session => {
        const date = new Date(session.created_at);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }); 
        const dayIndex = newChart.findIndex(d => d.day === dayName);
        if (dayIndex !== -1) {
          newChart[dayIndex].value = 100;
        }
      });
    }
    setWeeklyChart(newChart);
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Prepara la foto da mostrare
  const imageToShow = avatarUrl 
    ? { uri: avatarUrl } 
    : { uri: `https://ui-avatars.com/api/?name=${userName}&background=fff&color=000` };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Image source={imageToShow} style={styles.avatar} />
          <View>
            <Text style={styles.greeting}>Hi, {userName}</Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>

       {/* CATEGORIES */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoriesContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedCategory === item.id;
              return (
                <TouchableOpacity 
                  style={[styles.categoryCard, isSelected ? styles.categorySelected : styles.categoryUnselected]}
                  onPress={() => setSelectedCategory(item.id)}
                >
                  {/* --- SIAMO TORNATI ALLE FOTO! --- */}
                  <Image source={{ uri: item.image_url }} style={styles.categoryImage} />
                  <Text style={[styles.categoryText, isSelected ? styles.textSelected : styles.textUnselected]}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* WORKOUT LIST */}
        <Text style={[styles.sectionTitle, { textAlign: 'center', marginTop: 30 }]}>Workout List</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={workouts.filter(w => w.isAdd || w.category_id === selectedCategory)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            if (item.isAdd) {
              return (
                <TouchableOpacity 
                  style={styles.addCard}
                  onPress={() => router.push('/add-workout')}
                >
                  <Text style={styles.addCardTitle}>Add Workout</Text>
                  <View style={styles.addIconContainer}>
                    <Ionicons name="add" size={60} color={Colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity 
                style={styles.workoutCard}
                onPress={() => router.push(`/workout/${item.id}`)} 
              >
                <Image source={{ uri: item.image_url }} style={styles.workoutImage} />
                <View style={styles.workoutOverlay}>
                  <Text style={styles.workoutTitle}>{item.title}</Text>
                  <Text style={styles.workoutSubtitle}>Tap to view exercises</Text> 
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* GRAFICO SETTIMANALE */}
        <View style={styles.chartContainer}>
          {weeklyChart.map((data, index) => (
            <View key={index} style={styles.barColumn}>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { height: `${data.value}%` }]} />
              </View>
              <Text style={styles.barLabel}>{data.day}</Text>
            </View>
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
  sectionTitle: { color: Colors.text, fontSize: 24, fontWeight: 'bold', marginLeft: 20, marginBottom: 15, marginTop: 10 },
  categoriesContainer: { paddingLeft: 20 },
  categoryCard: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingRight: 20, borderRadius: 30, marginRight: 15 },
  categoryImage: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  categoryText: { fontSize: 16, fontWeight: '600' },
  categorySelected: { backgroundColor: '#4A4A4A' },
  categoryUnselected: { backgroundColor: '#FFFFFF' },
  textSelected: { color: '#FFFFFF' },
  textUnselected: { color: '#000000' },
  workoutCard: { width: 220, height: 280, borderRadius: 30, marginRight: 20, overflow: 'hidden', backgroundColor: Colors.cardBackground },
  workoutImage: { width: '100%', height: '100%', position: 'absolute', opacity: 0.8 },
  workoutOverlay: { padding: 20, flex: 1, justifyContent: 'flex-start' },
  workoutTitle: { color: Colors.text, fontSize: 28, fontWeight: 'bold', lineHeight: 34 },
  workoutSubtitle: { color: Colors.text, fontSize: 14, marginTop: 5 },
  addCard: { width: 220, height: 280, borderRadius: 30, marginRight: 20, backgroundColor: Colors.primary, padding: 20, alignItems: 'center', justifyContent: 'center' },
  addCardTitle: { color: Colors.background, fontSize: 24, fontWeight: 'bold', position: 'absolute', top: 30 },
  addIconContainer: { width: 100, height: 100, backgroundColor: Colors.background, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  

  chartContainer: { backgroundColor: Colors.primary, marginHorizontal: 20, marginTop: 40, borderRadius: 30, padding: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 180 },
  barColumn: { alignItems: 'center', flex: 1 },
  barBackground: { height: 100, width: 20, justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: 20, backgroundColor: Colors.background, borderRadius: 10 },
  barLabel: { marginTop: 10, fontSize: 12, fontWeight: '600', color: Colors.background },
});