import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiPost } from "@/constants/api";

const C = Colors.dark;

export default function ComposeMessageScreen() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) { setError("Message cannot be empty."); return; }
    setError(""); setLoading(true);
    try {
      await apiPost("/api/messages", { content: trimmed, recipientId: null });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Failed to send.");
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 32, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>BROADCAST TO GLOBAL CHANNEL</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Enter your transmission..."
          placeholderTextColor={C.textMuted}
          multiline
          maxLength={500}
          autoFocus
        />
        <Text style={styles.count}>{message.length}/500</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color={C.background} size="small" /> : (
            <>
              <Feather name="send" size={15} color={C.background} />
              <Text style={styles.btnText}>TRANSMIT</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 3, color: C.textMuted, marginBottom: 10 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 16, fontFamily: "Inter_400Regular", fontSize: 15, color: C.text, minHeight: 160, textAlignVertical: "top" },
  count: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right", marginTop: 6 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.dark.danger, marginTop: 8 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.dark.primary, borderRadius: 6, height: 52, marginTop: 20 },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 3, color: Colors.dark.background },
});
