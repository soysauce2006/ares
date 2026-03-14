import React from "react";
import {
  View, Text, ScrollView, StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { apiGet } from "@/constants/api";

const C = Colors.dark;

interface RosterMember {
  id: number;
  name: string;
  status: string;
  notes?: string;
  rankName?: string;
  rankAbbr?: string;
  squadName?: string;
  unitName?: string;
  divisionName?: string;
  email?: string;
  phone?: string;
  joinedAt?: string;
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Feather name={icon as any} size={14} color={C.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function RosterMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError } = useQuery<RosterMember>({
    queryKey: ["roster-member", id],
    queryFn: () => apiGet(`/api/roster/${id}`),
    enabled: !!id,
  });

  const statusColor = data?.status === "active" ? C.success : data?.status === "inactive" ? C.textMuted : C.warning;

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ flex: 1 }} />
      ) : isError || !data ? (
        <View style={styles.errorWrap}>
          <Feather name="alert-circle" size={32} color={C.danger} />
          <Text style={styles.errorText}>Could not load member</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar header */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{data.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            {data.rankAbbr && (
              <Text style={styles.rankBadge}>{data.rankAbbr}</Text>
            )}
            <Text style={styles.name}>{data.name}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "22", borderColor: statusColor + "55" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{data.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Assignment */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ASSIGNMENT</Text>
            <DetailRow icon="layers" label="DIVISION" value={data.divisionName} />
            <DetailRow icon="grid" label="UNIT" value={data.unitName} />
            <DetailRow icon="target" label="SQUAD" value={data.squadName} />
            <DetailRow icon="award" label="RANK" value={data.rankName} />
          </View>

          {/* Contact */}
          {(data.email || data.phone) && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>CONTACT</Text>
              <DetailRow icon="mail" label="EMAIL" value={data.email} />
              <DetailRow icon="phone" label="PHONE" value={data.phone} />
            </View>
          )}

          {/* Notes */}
          {data.notes && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>NOTES</Text>
              <Text style={styles.notes}>{data.notes}</Text>
            </View>
          )}

          {/* Joined */}
          {data.joinedAt && (
            <Text style={styles.joined}>
              ENLISTED: {new Date(data.joinedAt).toLocaleDateString()}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textMuted },
  avatarSection: { alignItems: "center", marginBottom: 28, gap: 6 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.primaryFaint, borderWidth: 2, borderColor: C.primary + "60", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 26, color: C.primary },
  rankBadge: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 2, color: C.primary, backgroundColor: C.primaryFaint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  name: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 2 },
  card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: "hidden" },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 3, color: C.textMuted, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint },
  rowIcon: { width: 30, height: 30, borderRadius: 7, backgroundColor: C.primaryFaint, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontFamily: "Inter_500Medium", fontSize: 9, letterSpacing: 2, color: C.textMuted, marginBottom: 1 },
  rowValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  notes: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, lineHeight: 22, padding: 16 },
  joined: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 2, color: C.textMuted, textAlign: "center", marginBottom: 8 },
});
