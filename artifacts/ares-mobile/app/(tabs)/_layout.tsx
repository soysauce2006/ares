import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Command</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="roster">
        <Icon sf={{ default: "person.3", selected: "person.3.fill" }} />
        <Label>Roster</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="comms">
        <Icon sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }} />
        <Label>Comms</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : C.card,
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.card }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Command",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.grid.2x2.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="grid" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: "Roster",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.3.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="users" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="comms"
        options={{
          title: "Comms",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bubble.left.and.bubble.right.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="radio" size={20} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="user" size={20} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
