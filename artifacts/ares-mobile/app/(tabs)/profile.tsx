import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Alert, ActivityIndicator, Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/auth";
import { apiPost } from "@/constants/api";

const C = Colors.dark;

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon as any} size={15} color={C.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "web" ? 84 : useBottomTabBarHeight();
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");

  const handleLogout = () => {
    Alert.alert("Logout", "Terminate secure session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError("All fields are required."); return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match."); return;
    }
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters."); return;
    }
    setPwLoading(true);
    try {
      await apiPost("/api/auth/change-password", { currentPassword, newPassword });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowChangePassword(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      Alert.alert("Success", "Password updated successfully.");
    } catch (e: any) {
      setPwError(e.message ?? "Failed to update password.");
    } finally {
      setPwLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const roleColor = user?.role === "admin" ? C.danger : user?.role === "manager" ? C.warning : C.success;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.background }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: tabBarHeight + 24, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar header */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{user?.username?.slice(0, 2).toUpperCase() ?? "??"}</Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor + "18", borderColor: roleColor + "55" }]}>
          <Feather name="shield" size={11} color={roleColor} />
          <Text style={[styles.roleText, { color: roleColor }]}>{(user?.role ?? "").toUpperCase()}</Text>
        </View>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>OPERATOR PROFILE</Text>
        <InfoRow icon="user" label="USERNAME" value={user?.username ?? ""} />
        <InfoRow icon="mail" label="EMAIL" value={user?.email ?? ""} />
        <InfoRow icon="shield" label="CLEARANCE LEVEL" value={(user?.role ?? "").toUpperCase()} />
        <InfoRow icon="lock" label="MFA STATUS" value={user?.mfaEnabled ? "ENABLED" : "DISABLED"} />
      </View>

      {/* Actions */}
      <View style={styles.actionsCard}>
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
          onPress={() => setShowChangePassword((v) => !v)}
        >
          <Feather name="key" size={16} color={C.text} />
          <Text style={styles.actionLabel}>Change Password</Text>
          <Feather name={showChangePassword ? "chevron-up" : "chevron-down"} size={14} color={C.textMuted} />
        </Pressable>

        {showChangePassword && (
          <View style={styles.changePasswordForm}>
            {["Current Password", "New Password", "Confirm New Password"].map((label, i) => {
              const values = [currentPassword, newPassword, confirmPassword];
              const setters = [setCurrentPassword, setNewPassword, setConfirmPassword];
              return (
                <View key={label} style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={values[i]}
                    onChangeText={setters[i]}
                    placeholder="••••••••"
                    placeholderTextColor={C.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              );
            })}
            {pwError ? <Text style={styles.pwError}>{pwError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }, pwLoading && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              {pwLoading ? <ActivityIndicator color={C.background} size="small" /> : <Text style={styles.saveBtnText}>UPDATE PASSWORD</Text>}
            </Pressable>
          </View>
        )}

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.7 }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={16} color={C.danger} />
          <Text style={[styles.actionLabel, { color: C.danger }]}>Logout</Text>
          <Feather name="chevron-right" size={14} color={C.danger + "80"} />
        </Pressable>
      </View>

      {/* Version */}
      <Text style={styles.version}>A.R.E.S. Mobile // v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: "center", marginBottom: 28, gap: 8 },
  avatarLarge: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primaryFaint, borderWidth: 2, borderColor: C.primary + "60", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.primary },
  username: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  email: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 2 },
  card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: "hidden" },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 3, color: C.textMuted, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderFaint },
  infoIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.primaryFaint, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontFamily: "Inter_500Medium", fontSize: 9, letterSpacing: 2, color: C.textMuted, marginBottom: 1 },
  infoValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  actionsCard: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 28, overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  actionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, flex: 1 },
  divider: { height: 1, backgroundColor: C.border },
  changePasswordForm: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  fieldGroup: { gap: 5 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 2, color: C.textMuted },
  fieldInput: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, height: 44 },
  pwError: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.danger },
  saveBtn: { backgroundColor: C.primary, borderRadius: 6, height: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 2, color: C.background },
  version: { fontFamily: "Inter_400Regular", fontSize: 10, letterSpacing: 2, color: C.textMuted, textAlign: "center" },
});
