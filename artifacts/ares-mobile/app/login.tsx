import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/auth";

const C = Colors.dark;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Enter email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.requiresMfa) {
        router.replace({ pathname: "/mfa", params: { mfaToken: result.mfaToken! } });
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand */}
        <View style={styles.brand}>
          <View style={styles.shieldRing}>
            <Feather name="shield" size={36} color={C.primary} />
          </View>
          <Text style={styles.siteTitle}>A.R.E.S.</Text>
          <Text style={styles.siteSubtitle}>ADVANCED ROSTER EXECUTION SYSTEM</Text>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>SECURE ACCESS</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={16} color={C.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="operator@unit.mil"
                placeholderTextColor={C.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={16} color={C.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={C.textMuted} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-triangle" size={13} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.background} size="small" />
            ) : (
              <>
                <Feather name="log-in" size={16} color={C.background} />
                <Text style={styles.loginBtnText}>AUTHENTICATE</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>CLASSIFIED SYSTEM — AUTHORIZED PERSONNEL ONLY</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
    marginBottom: 36,
    gap: 8,
  },
  shieldRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: Colors.dark.primary,
    backgroundColor: "rgba(218,165,32,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  siteTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: 8,
    color: Colors.dark.primary,
  },
  siteSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.dark.textMuted,
  },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 3,
    color: Colors.dark.textSecondary,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  inputIcon: { width: 16 },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.dark.text,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(231,76,60,0.1)",
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.3)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.danger,
    flex: 1,
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.dark.primary,
    borderRadius: 6,
    height: 52,
    marginTop: 8,
  },
  loginBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 3,
    color: Colors.dark.background,
  },
  footer: {
    fontFamily: "Inter_500Medium",
    fontSize: 8,
    letterSpacing: 2,
    color: Colors.dark.textMuted,
    textAlign: "center",
    marginTop: 48,
  },
});
