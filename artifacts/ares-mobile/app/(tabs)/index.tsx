import React, { useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  ActivityIndicator, Platform, Pressable,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiGet } from "@/constants/api";
import { useAuth } from "@/contexts/auth";

const C = Colors.dark;

interface DashboardData {
  totalMembers: number;
  totalDivisions?: number;
  totalSquads?: number;
  totalUnits?: number;
  recentActivity?: { id: number; action: string; description: string; createdAt: string }[];
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: (color ?? C.primary) + "18" }]}>
        <Feather name={icon as any} size={18} color={color ?? C.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityRow({ item }: { item: { action: string; description: string; createdAt: string } }) {
  const actionColor = item.action.includes("delete") ? C.danger
    : item.action.includes("login") ? C.success
    : C.primary;
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityDot, { backgroundColor: actionColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.activityDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.activityTime}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
    </View>
  );
}

export default function CommandScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "web" ? 84 : useBottomTabBarHeight();
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiGet("/api/dashboard"),
    staleTime: 30_000,
  });

  const { data: activity, refetch: refetchActivity } = useQuery<any[]>({
    queryKey: ["activity"],
    queryFn: () => apiGet("/api/activity?limit=10"),
    staleTime: 30_000,
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["settings"],
    queryFn: () => apiGet("/api/settings"),
    staleTime: 60_000,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchActivity()]);
  }, [refetch, refetchActivity]);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const siteName = settings?.siteName ?? "A.R.E.S.";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: tabBarHeight + 24, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={C.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>COMMAND CENTER</Text>
          <Text style={styles.site}>{siteName}</Text>
        </View>
        <View style={styles.roleTag}>
          <Feather name="shield" size={11} color={C.primary} />
          <Text style={styles.roleText}>{(user?.role ?? "").toUpperCase()}</Text>
        </View>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>SYSTEM ONLINE // SECURE</Text>
        <Text style={styles.statusDate}>{new Date().toISOString().slice(0, 10)}</Text>
      </View>

      {/* Stats */}
      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard icon="users" label="PERSONNEL" value={data?.totalMembers ?? 0} />
          <StatCard icon="layers" label={(settings?.tier1LabelPlural ?? "DIVISIONS").toUpperCase()} value={data?.totalDivisions ?? 0} color={C.textSecondary} />
          <StatCard icon="target" label={(settings?.tier3LabelPlural ?? "SQUADS").toUpperCase()} value={data?.totalSquads ?? 0} color="#5DADE2" />
          <StatCard icon="grid" label={(settings?.tier2LabelPlural ?? "UNITS").toUpperCase()} value={data?.totalUnits ?? 0} color="#A29BFE" />
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
      <View style={styles.quickRow}>
        {[
          { icon: "users", label: "Roster", onPress: () => router.push("/(tabs)/roster") },
          { icon: "radio", label: "Comms", onPress: () => router.push("/(tabs)/comms") },
        ].map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.7 }]}
            onPress={item.onPress}
          >
            <Feather name={item.icon as any} size={22} color={C.primary} />
            <Text style={styles.quickLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Activity Feed */}
      <Text style={styles.sectionTitle}>ACTIVITY LOG</Text>
      <View style={styles.activityCard}>
        {!activity || activity.length === 0 ? (
          <Text style={styles.empty}>No recent activity</Text>
        ) : (
          activity.slice(0, 8).map((item: any) => (
            <ActivityRow key={item.id} item={item} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  greeting: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 3, color: C.primary, marginBottom: 2 },
  site: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text },
  roleTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.primaryFaint, borderWidth: 1, borderColor: C.primaryDim + "40", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  roleText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 2, color: C.primary },
  statusBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  statusText: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 2, color: C.textSecondary, flex: 1 },
  statusDate: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textMuted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  statCard: { flex: 1, minWidth: "44%", backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 16, gap: 8 },
  statIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text },
  statLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 2, color: C.textMuted },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 3, color: C.textMuted, marginBottom: 12, marginTop: 4 },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  quickCard: { flex: 1, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 18, alignItems: "center", gap: 8 },
  quickLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.text },
  activityCard: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.text },
  activityTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, marginTop: 2 },
  empty: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textMuted, textAlign: "center", paddingVertical: 24 },
});
