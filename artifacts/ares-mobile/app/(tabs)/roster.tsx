import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TextInput,
  Pressable, RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiGet } from "@/constants/api";

const C = Colors.dark;

interface Member {
  id: number;
  name: string;
  rankName?: string;
  rankAbbr?: string;
  squadName?: string;
  status: string;
}

function MemberCard({ item }: { item: Member }) {
  const statusColor = item.status === "active" ? C.success : item.status === "inactive" ? C.textMuted : C.warning;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
      onPress={() => router.push({ pathname: "/roster-member", params: { id: item.id } })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {item.rankAbbr ? <Text style={styles.rank}>{item.rankAbbr}</Text> : null}
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        </View>
        {item.squadName ? <Text style={styles.squad} numberOfLines={1}>{item.squadName}</Text> : null}
      </View>
      <View style={[styles.statusPill, { backgroundColor: statusColor + "22", borderColor: statusColor + "55" }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
      </View>
      <Feather name="chevron-right" size={14} color={C.textMuted} />
    </Pressable>
  );
}

export default function RosterScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "web" ? 84 : useBottomTabBarHeight();
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isRefetching } = useQuery<Member[]>({
    queryKey: ["roster"],
    queryFn: () => apiGet("/api/roster"),
    staleTime: 30_000,
  });

  const filtered = (data ?? []).filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.rankName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (m.squadName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.title}>ROSTER</Text>
        <Text style={styles.count}>{filtered.length} PERSONNEL</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={15} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search personnel..."
          placeholderTextColor={C.textMuted}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={C.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <MemberCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarHeight + 16, paddingTop: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>{search ? "No results found" : "No roster members yet"}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, letterSpacing: 2 },
  count: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 2, color: C.textMuted, marginTop: 2 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primaryFaint, borderWidth: 1, borderColor: C.primary + "40", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.primary },
  rank: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.primary, backgroundColor: C.primaryFaint, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, flex: 1 },
  squad: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statusPill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textMuted },
});
