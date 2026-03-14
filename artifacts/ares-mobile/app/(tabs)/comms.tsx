import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, TextInput,
  Pressable, ActivityIndicator, Platform, KeyboardAvoidingView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiGet, apiPost } from "@/constants/api";
import { useAuth } from "@/contexts/auth";

const C = Colors.dark;

interface Message {
  id: number;
  content: string;
  senderId: number;
  senderUsername: string;
  recipientId: number | null;
  createdAt: string;
}

function MessageBubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <View style={[styles.bubbleWrap, isMine && { alignItems: "flex-end" }]}>
      {!isMine && <Text style={styles.sender}>{msg.senderUsername.toUpperCase()}</Text>}
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && { color: C.background }]}>{msg.content}</Text>
      </View>
      <Text style={styles.bubbleTime}>{time}</Text>
    </View>
  );
}

export default function CommsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "web" ? 84 : useBottomTabBarHeight();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);
  const [lastId, setLastId] = useState(0);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["global-messages"],
    queryFn: async () => {
      const data = await apiGet<Message[]>("/api/messages/global?since=0");
      if (data.length > 0) setLastId(data[data.length - 1].id);
      return data;
    },
    staleTime: 5_000,
    refetchInterval: 8_000,
  });

  const send = useMutation({
    mutationFn: (content: string) => apiPost("/api/messages", { content, recipientId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-messages"] });
      setText("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    send.mutate(trimmed);
  }, [text, send]);

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={tabBarHeight}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View>
          <Text style={styles.title}>COMMS TERMINAL</Text>
          <Text style={styles.subtitle}>GLOBAL CHANNEL</Text>
        </View>
        <View style={styles.onlineDot}>
          <View style={styles.dot} />
          <Text style={styles.onlineText}>LIVE</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={reversed}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <MessageBubble msg={item} isMine={item.senderId === user?.id} />}
          inverted
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!reversed.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="radio" size={36} color={C.textMuted} />
              <Text style={styles.emptyText}>No transmissions yet</Text>
              <Text style={styles.emptyHint}>Be the first to broadcast</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: bottomPad + 12 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Broadcast message..."
          placeholderTextColor={C.textMuted}
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <Pressable
          style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.75 }, (!text.trim() || send.isPending) && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!text.trim() || send.isPending}
        >
          {send.isPending ? (
            <ActivityIndicator color={C.background} size="small" />
          ) : (
            <Feather name="send" size={18} color={C.background} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, letterSpacing: 2 },
  subtitle: { fontFamily: "Inter_500Medium", fontSize: 9, letterSpacing: 3, color: C.primary, marginTop: 2 },
  onlineDot: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.success + "18", borderWidth: 1, borderColor: C.success + "40", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  onlineText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 2, color: C.success },
  bubbleWrap: { alignItems: "flex-start", maxWidth: "80%" },
  sender: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 2, color: C.primary, marginBottom: 3 },
  bubble: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: C.primary, borderBottomRightRadius: 3 },
  bubbleTheirs: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 3 },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTime: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textMuted, marginTop: 3 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.textMuted },
  emptyHint: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.background },
  input: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
});
