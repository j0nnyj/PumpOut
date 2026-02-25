import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Nascondiamo la barra in alto
        tabBarShowLabel: false, // Nascondiamo il testo sotto le icone (come nel tuo design)
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopWidth: 0, // Togliamo la riga grigia in alto
          elevation: 0,
          height: 90, // La facciamo un po' più alta per far respirare i tasti
          paddingTop: 10,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.secondary,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconActive]}>
              <Ionicons name={focused ? "home" : "home-outline"} size={28} color={color} />
            </View>
          ),
        }}
      />

      {/* --- AGGIUNGI QUESTA NUOVA SEZIONE QUI IN MEZZO! --- */}
      <Tabs.Screen
        name="community"
        options={{
          title: 'Squad',
          tabBarIcon: ({ color }) => <Ionicons name="people" size={24} color={color} />,
        }}
      />
      {/* ------------------------------------------------ */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconActive]}>
              <Ionicons name={focused ? "person" : "person-outline"} size={28} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 50,          // Diametro fisso
    height: 50,         // Diametro fisso
    borderRadius: 25,   // Esattamente la metà per fare un cerchio perfetto
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center', // Centra l'icona verticalmente
    alignItems: 'center',     // Centra l'icona orizzontalmente
  },
  iconActive: {
    borderColor: Colors.primary, // Il cerchio bianco quando sei su quella pagina!
  }
});