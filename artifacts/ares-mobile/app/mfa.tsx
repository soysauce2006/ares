import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/auth";

const C = Colors.dark;

export default function MfaScreen() {
  const insets = useSafeAreaInsets();
  const { mfaToken } = useLocalSearchParams<{ mfaToken: string }>();
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (code.length !== 6) { setError("Enter the 6-digit code."); return; }
    setError(""); setLoading(true);
    try {
      await verifyMfa(mfaToken!, code);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? "Invalid code.");
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.iconWrap}>
          <Feather name="shield" size={32} color={C.primary} />
        </View>
        <Text style={styles.title}>MFA VERIFICATION</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code from your authenticator app</Text>
        <TextInput
          ref={inputRef}
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => { setCode(t.replace(/\D/g, "").slice(0, 6)); }}
          placeholder="000000"
          placeholderTextColor={C.textMuted}
          keyboardType="numeric"
          maxLength={6}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={handleVerify} disabled={loading}>
          {loading ? <ActivityIndicator color={C.background} size="small" /> : <Text style={styles.btnText}>VERIFY</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace("/login")} style={{ marginTop: 20 }}>
          <Text style={styles.back}>← Back to Login</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", paddingHorizontal: 28 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: Colors.dark.primary, backgroundColor: "rgba(218,165,32,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: 4, color: Colors.dark.primary, marginBottom: 8 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.dark.textSecondary, textAlign: "center", marginBottom: 32 },
  codeInput: { fontFamily: "Inter_700Bold", fontSize: 32, letterSpacing: 12, textAlign: "center", color: Colors.dark.text, backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.primary, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 16, width: "100%", marginBottom: 16 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.dark.danger, marginBottom: 12 },
  btn: { backgroundColor: Colors.dark.primary, borderRadius: 6, height: 52, width: "100%", alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 3, color: Colors.dark.background },
  back: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.dark.textSecondary },
});
