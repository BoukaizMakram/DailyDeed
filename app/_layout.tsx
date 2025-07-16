import { Stack } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';


export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="favorites" />
      </Stack>
    </GestureHandlerRootView>
  );
}
