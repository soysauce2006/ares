import React, { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Radio, Send, Globe, MessageSquare, User as UserIcon, Plus, X } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type MsgUser = { id: number; username: string; unread?: number };
type Message = {
  id: number;
  senderId: number;
  recipientId: number | null;
  senderUsername: string;
  content: string;
  createdAt: string;
};

type ActiveThread = { type: "global" } | { type: "direct"; user: MsgUser };

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "MMM d HH:mm");
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const label = isToday(d) ? "TODAY" : isYesterday(d) ? "YESTERDAY" : format(d, "MMM d, yyyy").toUpperCase();
    const last = groups[groups.length - 1];
    if (last?.date === label) last.msgs.push(msg);
    else groups.push({ date: label, msgs: [msg] });
  }
  return groups;
}

export default function Messages() {
  const { data: currentUser } = useGetCurrentUser();
  const myId = (currentUser as any)?.id as number | undefined;

  const [conversations, setConversations] = useState<MsgUser[]>([]);
  const [allUsers, setAllUsers] = useState<MsgUser[]>([]);
  const [activeThread, setActiveThread] = useState<ActiveThread>({ type: "global" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [unreadGlobal] = useState(0);

  const lastMsgIdRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const convs = await apiFetch("/messages/conversations");
      setConversations(convs);
    } catch {}
  }, []);

  const loadThread = useCallback(async (thread: ActiveThread) => {
    setLoadingThread(true);
    setMessages([]);
    try {
      if (thread.type === "global") {
        const msgs: Message[] = await apiFetch("/messages/global?limit=60");
        setMessages(msgs);
        lastMsgIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
      } else {
        const msgs: Message[] = await apiFetch(`/messages/direct/${thread.user.id}?limit=60`);
        setMessages(msgs);
        lastMsgIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
        // Mark unread cleared in conversations
        setConversations(prev => prev.map(c => c.id === thread.user.id ? { ...c, unread: 0 } : c));
      }
    } catch (err: any) {
      toast({ title: "Load Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const pollNewMessages = useCallback(async () => {
    try {
      const newMsgs: Message[] = await apiFetch(`/messages/since/${lastMsgIdRef.current}`);
      if (newMsgs.length === 0) return;

      const relevantToThread = newMsgs.filter(m => {
        if (activeThread.type === "global") return m.recipientId === null;
        return (
          (m.senderId === activeThread.user.id && m.recipientId === myId) ||
          (m.senderId === myId && m.recipientId === activeThread.user.id)
        );
      });

      if (relevantToThread.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const toAdd = relevantToThread.filter(m => !existingIds.has(m.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
        lastMsgIdRef.current = newMsgs[newMsgs.length - 1].id;
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        lastMsgIdRef.current = newMsgs[newMsgs.length - 1].id;
      }

      // Update conversation unread counts for DMs not in the current thread
      const dmNotInThread = newMsgs.filter(m => m.recipientId === myId && (
        activeThread.type === "global" || m.senderId !== activeThread.user.id
      ));
      if (dmNotInThread.length > 0) {
        loadConversations();
      }
    } catch {}
  }, [activeThread, myId, scrollToBottom, loadConversations]);

  // Initial load
  useEffect(() => {
    loadConversations();
    apiFetch("/messages/users").then(setAllUsers).catch(() => {});
  }, [loadConversations]);

  // Load thread on switch
  useEffect(() => {
    loadThread(activeThread);
  }, [activeThread, loadThread]);

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loadingThread && messages.length > 0) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [loadingThread, scrollToBottom]);

  // Polling every 3 seconds
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollNewMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollNewMessages]);

  const sendMessage = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const recipientId = activeThread.type === "direct" ? activeThread.user.id : null;
      const msg: Message = await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId, content: draft.trim() }),
      });
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        return existingIds.has(msg.id) ? prev : [...prev, msg];
      });
      if (msg.id > lastMsgIdRef.current) lastMsgIdRef.current = msg.id;
      setDraft("");
      setTimeout(() => scrollToBottom(true), 50);
      if (activeThread.type === "direct") loadConversations();
    } catch (err: any) {
      toast({ title: "Send Failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startDm = (user: MsgUser) => {
    setNewDmOpen(false);
    const existing = conversations.find(c => c.id === user.id);
    if (!existing) setConversations(prev => [...prev, { id: user.id, username: user.username, unread: 0 }]);
    setActiveThread({ type: "direct", user });
  };

  const totalUnread = conversations.reduce((s, c) => s + (c.unread ?? 0), 0);

  const activeLabel = activeThread.type === "global"
    ? "Command Channel — Global"
    : `Direct / ${activeThread.user.username}`;

  const groups = groupByDate(messages);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30 shadow-[0_0_15px_rgba(218,165,32,0.1)]">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold uppercase tracking-widest text-foreground">
              Comms Terminal
            </h1>
            <p className="font-mono text-xs uppercase text-muted-foreground tracking-widest">
              Encrypted Command Communications
            </p>
          </div>
          {totalUnread > 0 && (
            <Badge className="ml-2 bg-destructive/80 text-destructive-foreground font-mono text-xs">
              {totalUnread} UNREAD
            </Badge>
          )}
        </div>

        <div className="flex flex-1 gap-0 border border-border/40 rounded-lg overflow-hidden bg-black/30 min-h-0">
          {/* Sidebar — conversations */}
          <div className="w-60 flex-shrink-0 flex flex-col border-r border-border/40 bg-black/20">
            {/* Global channel */}
            <button
              onClick={() => setActiveThread({ type: "global" })}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b border-border/30 transition-colors text-left",
                activeThread.type === "global"
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : "hover:bg-secondary/20"
              )}
            >
              <Globe className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-display uppercase tracking-wider text-xs text-foreground truncate">Command Channel</p>
                <p className="font-mono text-[9px] text-muted-foreground uppercase">Global Broadcast</p>
              </div>
            </button>

            {/* DM header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
              <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Direct Comms</span>
              <button
                onClick={() => setNewDmOpen(true)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="New Direct Message"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* DM list */}
            <ScrollArea className="flex-1">
              {conversations.length === 0 && (
                <p className="px-4 py-6 text-center font-mono text-[10px] uppercase text-muted-foreground/50">
                  No direct channels
                </p>
              )}
              {conversations.map(conv => {
                const isActive = activeThread.type === "direct" && activeThread.user.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveThread({ type: "direct", user: conv })}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left border-b border-border/20",
                      isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/20"
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center border border-border/40 shrink-0">
                      <UserIcon className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <span className="font-mono text-xs uppercase text-foreground/80 flex-1 truncate">{conv.username}</span>
                    {conv.unread ? (
                      <span className="bg-destructive text-destructive-foreground font-mono text-[9px] rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                        {conv.unread > 9 ? "9+" : conv.unread}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </ScrollArea>
          </div>

          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Thread header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-black/20 shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-display uppercase tracking-widest text-xs text-foreground">{activeLabel}</span>
              <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-primary/60 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                Live
              </span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-4 space-y-1 flex flex-col">
                {loadingThread ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={cn("flex gap-3 mb-3", i % 2 === 0 ? "" : "justify-end")}>
                      {i % 2 === 0 && <Skeleton className="w-7 h-7 rounded-full bg-secondary/40 shrink-0" />}
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-20 bg-secondary/30" />
                        <Skeleton className="h-8 w-48 bg-secondary/30 rounded" />
                      </div>
                    </div>
                  ))
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Radio className="w-8 h-8 text-muted-foreground/30 mb-3" />
                    <p className="font-mono text-xs uppercase text-muted-foreground/40">No transmissions on this channel</p>
                    <p className="font-mono text-[10px] uppercase text-muted-foreground/30 mt-1">Send a message to begin</p>
                  </div>
                ) : (
                  groups.map(group => (
                    <div key={group.date}>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border/30" />
                        <span className="font-mono text-[9px] uppercase text-muted-foreground/50 tracking-widest">{group.date}</span>
                        <div className="flex-1 h-px bg-border/30" />
                      </div>
                      {group.msgs.map((msg, i) => {
                        const isMe = msg.senderId === myId;
                        const prevMsg = group.msgs[i - 1];
                        const isSameAuthor = prevMsg?.senderId === msg.senderId;
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2",
                              isMe ? "justify-end" : "justify-start",
                              isSameAuthor ? "mt-0.5" : "mt-3"
                            )}
                          >
                            {!isMe && !isSameAuthor && (
                              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center border border-border/40 shrink-0 mt-1">
                                <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            {!isMe && isSameAuthor && <div className="w-7 shrink-0" />}
                            <div className={cn("max-w-[70%]", isMe ? "items-end" : "items-start", "flex flex-col")}>
                              {!isSameAuthor && (
                                <div className={cn("flex items-baseline gap-2 mb-1", isMe ? "flex-row-reverse" : "flex-row")}>
                                  <span className="font-display text-[10px] uppercase tracking-widest text-primary/80">
                                    {isMe ? "You" : msg.senderUsername}
                                  </span>
                                  <span className="font-mono text-[9px] text-muted-foreground/50">{formatMsgTime(msg.createdAt)}</span>
                                </div>
                              )}
                              <div className={cn(
                                "px-3 py-2 rounded-lg font-mono text-sm leading-relaxed break-words",
                                isMe
                                  ? "bg-primary/20 border border-primary/30 text-foreground rounded-tr-none"
                                  : "bg-secondary/40 border border-border/30 text-foreground/90 rounded-tl-none"
                              )}>
                                {msg.content}
                              </div>
                              {isSameAuthor && (
                                <span className={cn("font-mono text-[9px] text-muted-foreground/40 mt-0.5", isMe ? "text-right" : "text-left")}>
                                  {formatMsgTime(msg.createdAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="shrink-0 border-t border-border/40 p-3 bg-black/20">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeThread.type === "global" ? "Broadcast to all personnel..." : `Message ${activeThread.user.username}...`}
                  className="flex-1 bg-secondary/30 border-border/40 font-mono text-sm placeholder:text-muted-foreground/40"
                  maxLength={2000}
                  disabled={sending}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!draft.trim() || sending}
                  size="icon"
                  className="shrink-0 shadow-[0_0_10px_rgba(218,165,32,0.2)]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="font-mono text-[9px] text-muted-foreground/40 uppercase">
                  {activeThread.type === "global" ? "Global Broadcast Channel" : `Encrypted direct channel with ${activeThread.user.username}`}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground/30">{draft.length}/2000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New DM dialog */}
      <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
        <DialogContent className="bg-card border-primary/30 sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Open Direct Channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {allUsers.length === 0 && (
              <p className="font-mono text-xs uppercase text-muted-foreground py-4 text-center">No other personnel found</p>
            )}
            {allUsers.map(u => (
              <button
                key={u.id}
                onClick={() => startDm(u)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded hover:bg-secondary/30 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center border border-border/40 shrink-0">
                  <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="font-display uppercase tracking-wider text-sm">{u.username}</span>
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setNewDmOpen(false)} className="w-full font-mono text-xs uppercase">
            <X className="w-3.5 h-3.5 mr-2" /> Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
