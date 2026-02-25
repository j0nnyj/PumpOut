import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router'; // <-- AGGIUNTO useRouter!
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';


export default function CommunityScreen() {
  const router = useRouter(); // <-- Ci serve per cliccare sulle card!
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [friends, setFriends] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]); // <-- STATO DEL FEED
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

 const loadInitialData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      await fetchFriends(user.id);
      await fetchFeed(); // <-- CARICA IL FEED!
    }
    setLoading(false);
  }; // <-- Chiudiamo la funzione qui!

  // ORA È LIBERO E VISIBILE A TUTTI!
  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData(); 
    setRefreshing(false);
  };

  // --- SCARICA IL FEED DEGLI AMICI TRAMITE IL POSTINO SQL ---
  const fetchFeed = async () => {
    const { data, error } = await supabase.rpc('get_friends_feed');
    if (data) setFeed(data);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${text}%`)
      .neq('id', currentUserId)
      .limit(10);
    if (data) setSearchResults(data);
    setIsSearching(false);
  };

  const fetchFriends = async (userId: string) => {
    const { data: friendships } = await supabase.from('friendships').select('friend_id').eq('user_id', userId);
    if (!friendships || friendships.length === 0) {
      setFriends([]);
      return;
    }
    const friendIds = friendships.map(f => f.friend_id);
    const { data: profilesData } = await supabase.from('profiles').select('*').in('id', friendIds);

    if (profilesData) {
      const friendsWithStats = await Promise.all(
        profilesData.map(async (friend) => {
          const { count } = await supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('user_id', friend.id);
          return { ...friend, workoutsDone: count || 0 };
        })
      );
      friendsWithStats.sort((a, b) => b.workoutsDone - a.workoutsDone);
      setFriends(friendsWithStats);
    }
  };

  const handleAddFriend = async (friendId: string, friendName: string) => {
    if (!currentUserId) return;
    const isAlreadyFriend = friends.some(f => f.id === friendId);
    if (isAlreadyFriend) return Alert.alert("Ehi!", `Segui già ${friendName}!`);

    const { error } = await supabase.from('friendships').insert({ user_id: currentUserId, friend_id: friendId });
    if (!error) {
      Alert.alert('Aggiunto! 🎉', `Ora segui i progressi di ${friendName}!`);
      setSearchQuery(''); setSearchResults([]);
      await loadInitialData(); 
    }
  };

  const handleRemoveFriend = (friendId: string, friendName: string) => {
    Alert.alert("Rimuovi", `Vuoi smettere di seguire ${friendName}?`, [
      { text: "Annulla", style: "cancel" },
      { text: "Rimuovi", style: "destructive", onPress: async () => {
          await supabase.from('friendships').delete().eq('user_id', currentUserId).eq('friend_id', friendId);
          await loadInitialData();
        }
      }
    ]);
  };

  const getAvatar = (url: string | null, name: string) => {
    return url ? { uri: url } : { uri: `https://ui-avatars.com/api/?name=${name}&background=fff&color=000` };
  };

  const timeAgo = (dateString: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return `Yesterday`;
    return `${days}d ago`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Community</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search athletes..."
          placeholderTextColor={Colors.secondary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {isSearching && <ActivityIndicator color={Colors.primary} style={{marginRight: 10}} />}
      </View>

      {searchQuery.length > 1 && (
        <View style={styles.searchResultsBox}>
          {searchResults.length === 0 && !isSearching ? (
            <Text style={styles.noResultsText}>No athletes found.</Text>
          ) : (
            searchResults.map(user => (
              <View key={user.id} style={styles.resultItem}>
                <View style={styles.userInfo}>
                  <Image source={getAvatar(user.avatar_url, user.username)} style={styles.avatarSmall} />
                  <Text style={styles.resultName}>{user.username}</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => handleAddFriend(user.id, user.username)}>
                  <Text style={styles.addButtonText}>Follow</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* STRUTTURA A LISTA CON HEADER (SQUAD) E CORPO (FEED) */}
      <FlatList
        data={feed}
        keyExtractor={(item, index) => `${item.friend_id}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        
        // --- LA MAGIA È QUI: ROTELLINA DI AGGIORNAMENTO ---
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}  
            tintColor={Colors.primary} // Colore rotellina su iOS
            colors={[Colors.primary]} // Colore rotellina su Android
          />
        }
        // LA ZONA AMICI
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionTitle}>Your Squad</Text>
            {loading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{marginTop: 20, marginBottom: 40}} />
            ) : friends.length === 0 ? (
              <Text style={styles.emptyText}>Find friends to see their stats here!</Text>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={friends}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 20, marginBottom: 30 }}
                renderItem={({ item }) => (
                  <View style={styles.squadCard}>
                    <TouchableOpacity onPress={() => handleRemoveFriend(item.id, item.username)} style={styles.removeBadge}>
                      <Ionicons name="close" size={14} color={Colors.background} />
                    </TouchableOpacity>
                    <Image source={getAvatar(item.avatar_url, item.username)} style={styles.avatarSquad} />
                    <Text style={styles.squadName} numberOfLines={1}>{item.username}</Text>
                    <View style={styles.rankBadge}>
                      <Ionicons name="trophy" size={10} color={Colors.background} />
                      <Text style={styles.rankText}>{item.workoutsDone}</Text>
                    </View>
                  </View>
                )}
              />
            )}
            
            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Recent Activity</Text>
          </View>
        }
        
        // SEZIONE FEED
        ListEmptyComponent={
          !loading ? (
             <View style={styles.emptyFeedBox}>
               <Ionicons name="barbell-outline" size={50} color={Colors.secondary} />
               <Text style={styles.emptyFeedText}>No recent activity.</Text>
               <Text style={styles.emptyFeedSubtext}>When your friends finish a workout, it will appear here!</Text>
             </View>
          ) : null
        }
        renderItem={({ item }) => (
          // IL FEED CLICCABILE!
          <TouchableOpacity 
            style={styles.feedCard}
            onPress={() => router.push({
              pathname: '/friend-workout',
              params: { workoutId: item.workout_id, friendName: item.username, avatarUrl: item.avatar_url || '' }
            })}
          >
            <Image source={getAvatar(item.avatar_url, item.username)} style={styles.avatarFeed} />
            <View style={styles.feedContent}>
              <Text style={styles.feedText}>
                <Text style={styles.feedUsername}>{item.username} </Text> 
                completed 
                <Text style={styles.feedWorkout}> {item.workout_title}</Text>
              </Text>
              <Text style={styles.feedTime}>{timeAgo(item.created_at)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.secondary} />
          </TouchableOpacity>
        )}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20, paddingTop: 10 },
  pageTitle: { color: Colors.text, fontSize: 32, fontWeight: 'bold' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, marginHorizontal: 20, borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: Colors.text, paddingVertical: 15, fontSize: 16 },
  
  searchResultsBox: { backgroundColor: Colors.cardBackground, marginHorizontal: 20, borderRadius: 15, padding: 10, borderWidth: 1, borderColor: '#4A4A4A', zIndex: 10, position: 'absolute', top: 130, left: 0, right: 0 },
  noResultsText: { color: Colors.secondary, textAlign: 'center', padding: 10 },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  resultName: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  addButton: { backgroundColor: Colors.primary, paddingVertical: 6, paddingHorizontal: 15, borderRadius: 15 },
  addButtonText: { color: Colors.background, fontWeight: 'bold', fontSize: 14 },

  sectionTitle: { color: Colors.text, fontSize: 22, fontWeight: 'bold', marginLeft: 20, marginBottom: 15 },
  emptyText: { color: Colors.secondary, marginLeft: 20, marginBottom: 30 },
  
  squadCard: { alignItems: 'center', marginRight: 20, position: 'relative', width: 70 },
  avatarSquad: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: Colors.primary, marginBottom: 5 },
  squadName: { color: Colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  rankBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
  rankText: { color: Colors.background, fontSize: 10, fontWeight: 'bold', marginLeft: 3 },
  removeBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF3B30', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', zIndex: 5 },

  feedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, marginHorizontal: 20, padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  avatarFeed: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  feedContent: { flex: 1 },
  feedText: { color: Colors.text, fontSize: 16, lineHeight: 22 },
  feedUsername: { fontWeight: 'bold', color: Colors.primary },
  feedWorkout: { fontWeight: 'bold', color: '#FFF' },
  feedTime: { color: Colors.secondary, fontSize: 12, marginTop: 4 },
  
  emptyFeedBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyFeedText: { color: Colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 15 },
  emptyFeedSubtext: { color: Colors.secondary, fontSize: 14, marginTop: 5, textAlign: 'center' },
});