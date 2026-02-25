import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';

// --- GALLERIA DI FOTO PREMIUM PER LE CATEGORIE ---
const GYM_PICS = [
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=200&auto=format&fit=crop', // Rack
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=200&auto=format&fit=crop', // Corde
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=200&auto=format&fit=crop', // Dark gym
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=200&auto=format&fit=crop', // Manubri
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=200&auto=format&fit=crop', // Girl training
];

export default function ManageCategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedPic, setSelectedPic] = useState(GYM_PICS[0]); // Seleziona la prima foto di default
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('categories').select('*').eq('user_id', user.id).order('name');
      if (data) setCategories(data);
    }
    setLoading(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return Alert.alert('Errore', 'Inserisci un nome!');
    setIsAdding(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { error } = await supabase.from('categories').insert({
        name: newCategoryName,
        user_id: user.id,
        image_url: selectedPic // Salviamo la foto scelta!
      });

      if (error) {
        Alert.alert('Errore', 'Impossibile aggiungere la categoria.');
      } else {
        setNewCategoryName('');
        await fetchCategories();
      }
    }
    setIsAdding(false);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    const { error } = await supabase.from('categories').update({ name: editName }).eq('id', id);
    if (!error) await fetchCategories();
    setEditingId(null);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert("Elimina", `Vuoi eliminare "${name}"?`, [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => {
          await supabase.from('categories').delete().eq('id', id);
          await fetchCategories();
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.background} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Categories</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        
        <View style={styles.addSection}>
          <Text style={styles.sectionLabel}>Create New</Text>
          <View style={styles.addRow}>
            <TextInput 
              style={styles.addInput} 
              placeholder="e.g. Core, Arms..." 
              placeholderTextColor={Colors.secondary}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddCategory} disabled={isAdding}>
              {isAdding ? <ActivityIndicator color={Colors.background} /> : <Ionicons name="add" size={24} color={Colors.background} />}
            </TouchableOpacity>
          </View>

          {/* Mostra la galleria foto quando scrivi il nome */}
          {newCategoryName.length > 0 && (
            <View style={styles.designOptions}>
              <Text style={styles.smallLabel}>Select Cover Photo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {GYM_PICS.map((pic, index) => (
                  <TouchableOpacity key={index} onPress={() => setSelectedPic(pic)}>
                    <Image 
                      source={{ uri: pic }} 
                      style={[styles.picThumbnail, selectedPic === pic && styles.picThumbnailSelected]} 
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>Your Categories</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{marginTop: 20}} />
        ) : (
          <FlatList
            data={categories}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isEditing = editingId === item.id;

              return (
                <View style={styles.categoryCard}>
                  {/* SIAMO TORNATI ALLA FOTO QUI */}
                  <Image source={{ uri: item.image_url }} style={styles.categoryBadge} />
                  
                  {isEditing ? (
                    <View style={styles.editRow}>
                      <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} autoFocus />
                      <TouchableOpacity onPress={() => handleSaveEdit(item.id)} style={styles.actionBtn}>
                        <Ionicons name="checkmark-circle" size={28} color="#4CD964" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.viewRow}>
                      <Text style={styles.categoryName}>{item.name}</Text>
                      <View style={styles.actions}>
                        <TouchableOpacity onPress={() => { setEditingId(item.id); setEditName(item.name); }} style={styles.actionBtn}>
                          <Ionicons name="pencil" size={24} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteCategory(item.id, item.name)} style={styles.actionBtn}>
                          <Ionicons name="trash" size={24} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  backButton: { backgroundColor: Colors.primary, padding: 8, borderRadius: 20 },
  headerTitle: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  content: { flex: 1, paddingHorizontal: 20 },
  
  sectionLabel: { color: Colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  smallLabel: { color: Colors.secondary, fontSize: 12, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  
  addSection: { backgroundColor: Colors.cardBackground, padding: 15, borderRadius: 20, marginBottom: 30, borderWidth: 1, borderColor: '#333' },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  addInput: { flex: 1, backgroundColor: Colors.background, color: Colors.text, padding: 15, borderRadius: 15, fontSize: 16, marginRight: 10 },
  addButton: { backgroundColor: Colors.primary, width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  
  designOptions: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10 },
  pickerRow: { flexDirection: 'row' },
  picThumbnail: { width: 50, height: 50, borderRadius: 10, marginRight: 10, opacity: 0.4 },
  picThumbnailSelected: { opacity: 1, borderWidth: 2, borderColor: Colors.primary },

  categoryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  categoryBadge: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  viewRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryName: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  actions: { flexDirection: 'row' },
  actionBtn: { marginLeft: 15 },
  
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editInput: { flex: 1, backgroundColor: Colors.background, color: Colors.text, padding: 10, borderRadius: 10, fontSize: 16, marginRight: 10 },
});