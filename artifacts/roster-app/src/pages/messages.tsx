import React, { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Radio, Send, Globe, MessageSquare, User as UserIcon, Plus, X, Users, Trash2,
  ChevronDown, ChevronRight, Settings2, UserPlus,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
type ChannelMessage = {
  id: number;
  channelId: number;
  senderId: number;
  senderUsername: string;
  content: string;
  createdAt: string;
};
type Channel = {
  id: number;
  name: string;
  description?: string | null;
  memberCount: number;
  createdAt: string;
};
type ChannelMember = {
  id: number;
  username: string;
  email: string;
  role: string;
  addedAt: string;
};
type ClearanceLevel = { id: number; name: string; level: number };
type Rank = { id: number; name: string; abbreviation: string };

type ActiveThread =
  | { type: "global" }
  | { type: "direct"; user: MsgUser }
  | { type: "channel"; channel: Channel };

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "MMM d HH:mm");
}

function groupByDate<T extends { createdAt: string }>(messages: T[]) {
  const groups: { date: string; msgs: T[] }[] = [];
  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const label =
      isToday(d) ? "TODAY" :
      isYesterday(d) ? "YESTERDAY" :
      format(d, "MMM d, yyyy").toUpperCase();
    const last = groups[groups.length - 1];
    if (last?.date === label) last.msgs.push(msg);
    else groups.push({ date: label, msgs: [msg] });
  }
  return groups;
}

export default function Messages() {
  const { data: currentUser } = useGetCurrentUser();
  const myId = (currentUser as any)?.id as number | undefined;
  const isAdmin = (currentUser as any)?.role === "admin";

  // DM state
  const [conversations, setConversations] = useState<MsgUser[]>([]);
  const [allUsers, setAllUsers] = useState<MsgUser[]>([]);
  const [newDmOpen, setNewDmOpen] = useState(false);

  // Channel state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [manageChannelOpen, setManageChannelOpen] = useState(false);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [deleteChannelOpen, setDeleteChannelOpen] = useState(false);
  const [clearanceLevels, setClearanceLevels] = useState<ClearanceLevel[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);

  // Create channel form
  const [channelName, setChannelName] = useState("");
  const [channelDesc, setChannelDesc] = useState("");
  const [membershipType, setMembershipType] = useState<"manual" | "clearance" | "rank">("manual");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [selectedClearanceId, setSelectedClearanceId] = useState<string>("");
  const [selectedRankId, setSelectedRankId] = useState<string>("");
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Add member to channel
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberType, setAddMemberType] = useState<"manual" | "clearance" | "rank">("manual");
  const [addMemberIds, setAddMemberIds] = useState<number[]>([]);
  const [addMemberClearanceId, setAddMemberClearanceId] = useState<string>("");
  const [addMemberRankId, setAddMemberRankId] = useState<string>("");

  // Shared thread state
  const [activeThread, setActiveThread] = useState<ActiveThread>({ type: "global" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

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

  const loadChannels = useCallback(async () => {
    try {
      const list = await apiFetch("/channels");
      setChannels(list);
    } catch {}
  }, []);

  const loadThread = useCallback(async (thread: ActiveThread) => {
    setLoadingThread(true);
    setMessages([]);
    setChannelMessages([]);
    lastMsgIdRef.current = 0;
    try {
      if (thread.type === "global") {
        const msgs: Message[] = await apiFetch("/messages/global?limit=60");
        setMessages(msgs);
        lastMsgIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
      } else if (thread.type === "direct") {
        const msgs: Message[] = await apiFetch(`/messages/direct/${thread.user.id}?limit=60`);
        setMessages(msgs);
        lastMsgIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
        setConversations(prev => prev.map(c => c.id === thread.user.id ? { ...c, unread: 0 } : c));
      } else if (thread.type === "channel") {
        const msgs: ChannelMessage[] = await apiFetch(`/channels/${thread.channel.id}/messages?limit=60`);
        setChannelMessages(msgs);
        lastMsgIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
      }
    } catch (err: any) {
      toast({ title: "Load Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const pollNewMessages = useCallback(async () => {
    try {
      if (activeThread.type === "channel") {
        if (lastMsgIdRef.current === 0) return;
        const newMsgs: ChannelMessage[] = await apiFetch(
          `/channels/${activeThread.channel.id}/messages/since/${lastMsgIdRef.current}`
        );
        if (newMsgs.length > 0) {
          setChannelMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const toAdd = newMsgs.filter(m => !existingIds.has(m.id));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });
          lastMsgIdRef.current = newMsgs[newMsgs.length - 1].id;
          setTimeout(() => scrollToBottom(true), 50);
        }
        return;
      }

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

      const dmNotInThread = newMsgs.filter(m => m.recipientId === myId && (
        activeThread.type === "global" || m.senderId !== activeThread.user.id
      ));
      if (dmNotInThread.length > 0) loadConversations();
    } catch {}
  }, [activeThread, myId, scrollToBottom, loadConversations]);

  // Initial data load
  useEffect(() => {
    loadConversations();
    loadChannels();
    apiFetch("/messages/users").then(setAllUsers).catch(() => {});
    apiFetch("/clearances").then(setClearanceLevels).catch(() => {});
    apiFetch("/ranks").then(setRanks).catch(() => {});
  }, [loadConversations, loadChannels]);

  // Load thread on switch
  useEffect(() => {
    loadThread(activeThread);
  }, [activeThread, loadThread]);

  // Scroll to bottom after load
  useEffect(() => {
    if (!loadingThread && (messages.length > 0 || channelMessages.length > 0)) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [loadingThread, scrollToBottom]);

  // Polling every 3s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollNewMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollNewMessages]);

  const sendMessage = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      if (activeThread.type === "channel") {
        const msg: ChannelMessage = await apiFetch(`/channels/${activeThread.channel.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: draft.trim() }),
        });
        setChannelMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          return existingIds.has(msg.id) ? prev : [...prev, msg];
        });
        if (msg.id > lastMsgIdRef.current) lastMsgIdRef.current = msg.id;
      } else {
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
        if (activeThread.type === "direct") loadConversations();
      }
      setDraft("");
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err: any) {
      toast({ title: "Send Failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const startDm = (user: MsgUser) => {
    setNewDmOpen(false);
    const existing = conversations.find(c => c.id === user.id);
    if (!existing) setConversations(prev => [...prev, { id: user.id, username: user.username, unread: 0 }]);
    setActiveThread({ type: "direct", user });
  };

  const createChannel = async () => {
    if (!channelName.trim() || channelName.trim().length < 2) {
      toast({ title: "Error", description: "Channel name must be at least 2 characters", variant: "destructive" });
      return;
    }
    setCreatingChannel(true);
    try {
      const body: Record<string, unknown> = {
        name: channelName.trim(),
        description: channelDesc.trim() || undefined,
      };
      if (membershipType === "manual") body.memberUserIds = selectedMemberIds;
      if (membershipType === "clearance" && selectedClearanceId) body.clearanceLevelId = parseInt(selectedClearanceId);
      if (membershipType === "rank" && selectedRankId) body.rankId = parseInt(selectedRankId);

      const channel: Channel = await apiFetch("/channels", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setChannels(prev => [...prev, channel]);
      setNewChannelOpen(false);
      setChannelName("");
      setChannelDesc("");
      setMembershipType("manual");
      setSelectedMemberIds([]);
      setSelectedClearanceId("");
      setSelectedRankId("");
      toast({ title: "Channel Created", description: `#${channel.name} is ready` });
      setActiveThread({ type: "channel", channel });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingChannel(false);
    }
  };

  const openManageChannel = async (channel: Channel) => {
    setManageChannelOpen(true);
    try {
      const members = await apiFetch(`/channels/${channel.id}/members`);
      setChannelMembers(members);
    } catch {}
  };

  const removeMember = async (channel: Channel, userId: number) => {
    try {
      await apiFetch(`/channels/${channel.id}/members/${userId}`, { method: "DELETE" });
      setChannelMembers(prev => prev.filter(m => m.id !== userId));
      setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, memberCount: c.memberCount - 1 } : c));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const addMembers = async (channel: Channel) => {
    try {
      const body: Record<string, unknown> = {};
      if (addMemberType === "manual") body.userIds = addMemberIds;
      if (addMemberType === "clearance" && addMemberClearanceId) body.clearanceLevelId = parseInt(addMemberClearanceId);
      if (addMemberType === "rank" && addMemberRankId) body.rankId = parseInt(addMemberRankId);

      const result = await apiFetch(`/channels/${channel.id}/members`, { method: "POST", body: JSON.stringify(body) });
      toast({ title: "Members Added", description: `${result.added} new member(s) added` });

      const members = await apiFetch(`/channels/${channel.id}/members`);
      setChannelMembers(members);
      setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, memberCount: members.length } : c));
      setAddMemberOpen(false);
      setAddMemberIds([]);
      setAddMemberClearanceId("");
      setAddMemberRankId("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const deleteChannel = async (channel: Channel) => {
    try {
      await apiFetch(`/channels/${channel.id}`, { method: "DELETE" });
      setChannels(prev => prev.filter(c => c.id !== channel.id));
      setDeleteChannelOpen(false);
      setManageChannelOpen(false);
      if (activeThread.type === "channel" && activeThread.channel.id === channel.id) {
        setActiveThread({ type: "global" });
      }
      toast({ title: "Channel Deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const totalUnread = conversations.reduce((s, c) => s + (c.unread ?? 0), 0);

  const activeLabel =
    activeThread.type === "global" ? "Command Channel — Global" :
    activeThread.type === "direct" ? `Direct / ${activeThread.user.username}` :
    `# ${activeThread.channel.name}`;

  const activeChannel = activeThread.type === "channel" ? activeThread.channel : null;

  const displayMessages = activeThread.type === "channel" ? channelMessages : messages;
  const groups = groupByDate(displayMessages);

  const inputPlaceholder =
    activeThread.type === "global" ? "Broadcast to all personnel..." :
    activeThread.type === "direct" ? `Message ${activeThread.user.username}...` :
    `Message #${activeThread.channel.name}...`;

  function toggleManualMember(uid: number, list: number[], setter: (fn: (prev: number[]) => number[]) => void) {
    setter(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  }

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
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 flex flex-col border-r border-border/40 bg-black/20">
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

            {/* Group Channels section */}
            <div className="border-b border-border/30">
              <div className="flex items-center justify-between px-4 py-2">
                <button
                  className="flex items-center gap-1 text-left"
                  onClick={() => setChannelsOpen(o => !o)}
                >
                  {channelsOpen
                    ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  }
                  <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Group Channels</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setNewChannelOpen(true)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Create Group Channel"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {channelsOpen && (
                <div className="pb-1">
                  {channels.length === 0 && (
                    <p className="px-6 py-2 font-mono text-[10px] uppercase text-muted-foreground/40">
                      No channels
                    </p>
                  )}
                  {channels.map(ch => {
                    const isActive = activeThread.type === "channel" && activeThread.channel.id === ch.id;
                    return (
                      <div key={ch.id} className="group relative">
                        <button
                          onClick={() => setActiveThread({ type: "channel", channel: ch })}
                          className={cn(
                            "flex items-center gap-2 w-full px-4 py-2 transition-colors text-left",
                            isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/20"
                          )}
                        >
                          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs text-foreground/80 flex-1 truncate">#{ch.name}</span>
                          <span className="font-mono text-[9px] text-muted-foreground/50 shrink-0">{ch.memberCount}</span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => openManageChannel(ch)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all p-1 rounded"
                            title="Manage channel"
                          >
                            <Settings2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DM section */}
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
              {activeThread.type === "channel"
                ? <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                : <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
              }
              <span className="font-display uppercase tracking-widest text-xs text-foreground">{activeLabel}</span>
              {activeThread.type === "channel" && (
                <span className="font-mono text-[9px] text-muted-foreground/50">
                  · {activeThread.channel.memberCount} members
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-primary/60 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                Live
              </span>
              {isAdmin && activeThread.type === "channel" && (
                <button
                  onClick={() => openManageChannel(activeThread.channel)}
                  className="ml-2 text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                  title="Manage channel"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              )}
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
                ) : displayMessages.length === 0 ? (
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
                  placeholder={inputPlaceholder}
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
                  {activeThread.type === "global" ? "Global Broadcast Channel" :
                   activeThread.type === "direct" ? `Encrypted direct channel with ${activeThread.user.username}` :
                   `Group channel: #${activeThread.channel.name}`}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground/30">{draft.length}/2000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── New DM Dialog ── */}
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

      {/* ── Create Channel Dialog ── */}
      <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
        <DialogContent className="bg-card border-primary/30 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
              <Users className="w-4 h-4" /> Create Group Channel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Channel Name</Label>
              <Input
                value={channelName}
                onChange={e => setChannelName(e.target.value)}
                placeholder="e.g. alpha-squad, intel-team..."
                className="bg-secondary/30 border-border/40 font-mono"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Description (optional)</Label>
              <Textarea
                value={channelDesc}
                onChange={e => setChannelDesc(e.target.value)}
                placeholder="Channel purpose..."
                className="bg-secondary/30 border-border/40 font-mono text-sm resize-none"
                rows={2}
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase text-muted-foreground">Add Members By</Label>
              <Select value={membershipType} onValueChange={(v: any) => setMembershipType(v)}>
                <SelectTrigger className="bg-secondary/30 border-border/40 font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Select Users Manually</SelectItem>
                  <SelectItem value="clearance">Clearance Level</SelectItem>
                  <SelectItem value="rank">Rank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {membershipType === "manual" && (
              <div className="space-y-1.5">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Select Personnel</Label>
                <ScrollArea className="h-40 border border-border/40 rounded-md bg-secondary/20">
                  <div className="p-2 space-y-1">
                    {allUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-secondary/40 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(u.id)}
                          onChange={() => toggleManualMember(u.id, selectedMemberIds, setSelectedMemberIds)}
                          className="accent-primary"
                        />
                        <span className="font-mono text-sm">{u.username}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                <p className="font-mono text-[10px] text-muted-foreground">{selectedMemberIds.length} selected (you are added automatically)</p>
              </div>
            )}

            {membershipType === "clearance" && (
              <div className="space-y-1.5">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Clearance Level</Label>
                <Select value={selectedClearanceId} onValueChange={setSelectedClearanceId}>
                  <SelectTrigger className="bg-secondary/30 border-border/40 font-mono text-sm">
                    <SelectValue placeholder="Select clearance level..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clearanceLevels.map(cl => (
                      <SelectItem key={cl.id} value={String(cl.id)}>L{cl.level} — {cl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="font-mono text-[10px] text-muted-foreground">All users with this clearance will be added</p>
              </div>
            )}

            {membershipType === "rank" && (
              <div className="space-y-1.5">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Rank</Label>
                <Select value={selectedRankId} onValueChange={setSelectedRankId}>
                  <SelectTrigger className="bg-secondary/30 border-border/40 font-mono text-sm">
                    <SelectValue placeholder="Select rank..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ranks.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.abbreviation} — {r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="font-mono text-[10px] text-muted-foreground">All roster members with this rank will be added</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setNewChannelOpen(false)} className="font-mono text-xs uppercase">
              Cancel
            </Button>
            <Button onClick={createChannel} disabled={creatingChannel || !channelName.trim()} className="font-mono text-xs uppercase">
              {creatingChannel ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Channel Dialog ── */}
      {activeChannel && (
        <Dialog open={manageChannelOpen} onOpenChange={setManageChannelOpen}>
          <DialogContent className="bg-card border-primary/30 sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Manage #{activeChannel.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase text-muted-foreground">Members ({channelMembers.length})</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs uppercase border-primary/30 text-primary h-7"
                  onClick={() => setAddMemberOpen(true)}
                >
                  <UserPlus className="w-3 h-3 mr-1" /> Add Members
                </Button>
              </div>
              <ScrollArea className="h-52 border border-border/40 rounded-md bg-secondary/10">
                <div className="p-2 space-y-1">
                  {channelMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-secondary/30 group">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center border border-border/40 shrink-0">
                        <UserIcon className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="font-mono text-sm flex-1">{m.username}</span>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground/50">{m.role}</span>
                      <button
                        onClick={() => removeMember(activeChannel, m.id)}
                        className="opacity-0 group-hover:opacity-100 text-destructive/70 hover:text-destructive transition-all p-1 rounded"
                        title="Remove member"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {channelMembers.length === 0 && (
                    <p className="text-center font-mono text-xs text-muted-foreground/40 py-4">No members</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="font-mono text-xs uppercase mr-auto"
                onClick={() => setDeleteChannelOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Channel
              </Button>
              <Button variant="ghost" onClick={() => setManageChannelOpen(false)} className="font-mono text-xs uppercase">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Add Members Dialog ── */}
      {activeChannel && (
        <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
          <DialogContent className="bg-card border-primary/30 sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="font-display uppercase tracking-widest text-primary flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Add Members to #{activeChannel.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs uppercase text-muted-foreground">Add By</Label>
                <Select value={addMemberType} onValueChange={(v: any) => setAddMemberType(v)}>
                  <SelectTrigger className="bg-secondary/30 border-border/40 font-mono text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Select Users Manually</SelectItem>
                    <SelectItem value="clearance">Clearance Level</SelectItem>
                    <SelectItem value="rank">Rank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {addMemberType === "manual" && (
                <ScrollArea className="h-40 border border-border/40 rounded-md bg-secondary/20">
                  <div className="p-2 space-y-1">
                    {allUsers
                      .filter(u => !channelMembers.find(m => m.id === u.id))
                      .map(u => (
                        <label key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-secondary/40 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addMemberIds.includes(u.id)}
                            onChange={() => toggleManualMember(u.id, addMemberIds, setAddMemberIds)}
                            className="accent-primary"
                          />
                          <span className="font-mono text-sm">{u.username}</span>
                        </label>
                      ))}
                  </div>
                </ScrollArea>
              )}

              {addMemberType === "clearance" && (
                <Select value={addMemberClearanceId} onValueChange={setAddMemberClearanceId}>
                  <SelectTrigger className="bg-secondary/30 border-border/40 font-mono text-sm">
                    <SelectValue placeholder="Select clearance level..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clearanceLevels.map(cl => (
                      <SelectItem key={cl.id} value={String(cl.id)}>L{cl.level} — {cl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {addMemberType === "rank" && (
                <Select value={addMemberRankId} onValueChange={setAddMemberRankId}>
                  <SelectTrigger className="bg-secondary/30 border-border/40 font-mono text-sm">
                    <SelectValue placeholder="Select rank..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ranks.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.abbreviation} — {r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setAddMemberOpen(false)} className="font-mono text-xs uppercase">Cancel</Button>
              <Button
                onClick={() => addMembers(activeChannel)}
                className="font-mono text-xs uppercase"
                disabled={
                  (addMemberType === "manual" && addMemberIds.length === 0) ||
                  (addMemberType === "clearance" && !addMemberClearanceId) ||
                  (addMemberType === "rank" && !addMemberRankId)
                }
              >
                Add Members
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Channel Confirm ── */}
      {activeChannel && (
        <AlertDialog open={deleteChannelOpen} onOpenChange={setDeleteChannelOpen}>
          <AlertDialogContent className="bg-card border-destructive/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display uppercase tracking-widest text-destructive flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete Channel
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-sm text-muted-foreground">
                Permanently delete <span className="text-foreground font-bold">#{activeChannel.name}</span> and all its messages? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono text-xs uppercase">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/80 font-mono text-xs uppercase"
                onClick={() => deleteChannel(activeChannel)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AppLayout>
  );
}
