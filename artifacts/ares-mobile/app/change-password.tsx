import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/auth";
import { apiPost } from "@/constants/api";

const C = Colors.dark;

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!currentPassword || !newPassword || !confirmPassword) { setError("All fields required."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await apiPost("/api/auth/change-password", { currentPassword, newPassword });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Failed to update password.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40, paddingHorizontal: 28 }} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Feather name="key" size={28} color={C.primary} />
        </View>
        <Text style={styles.title}>CHANGE PASSWORD</Text>
        <Text style={styles.subtitle}>You must set a new password before continuing.</Text>
        <View style={styles.form}>
          {[
            { label: "CURRENT PASSWORD", val: currentPassword, set: setCurrentPassword },
            { label: "NEW PASSWORD", val: newPassword, set: setNewPassword },
            { label: "CONFIRM NEW PASSWORD", val: confirmPassword, set: setConfirmPassword },
          ].map(({ label, val, set }) => (
            <View key={label} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={val} onChangeText={set} secureTextEntry placeholder="••••••••" placeholderTextColor={C.textMuted} />
            </View>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={C.background} size="small" /> : <Text style={styles.btnText}>SET NEW PASSWORD</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.primaryFaint, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20 },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: 4, color: C.primary, textAlign: "center", marginBottom: 8 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", marginBottom: 32 },
  form: { gap: 14 },
  field: { gap: 5 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 3, color: C.textSecondary },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 14, height: 50, fontFamily: "Inter_400Regular", fontSize: 15, color: C.text },
  error: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.danger },
  btn: { backgroundColor: C.primary, borderRadius: 6, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 3, color: C.background },
});
