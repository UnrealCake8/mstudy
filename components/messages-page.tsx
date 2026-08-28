"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Ban, MessageCircle, Search, Send, Trash2, Users, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  blockUser,
  ChatConversation,
  ChatMessage,
  ChatProfile,
  createDirectConversation,
  createGroupConversation,
  deleteOwnMessage,
  ensureChatProfile,
  isChatDomainAllowed,
  isUserBlocked,
  listChatProfiles,
  reportMessage,
  sendMessage,
  subscribeConversations,
  subscribeMessages,
  unblockUser,
} from "@/lib/chat";

export function MessagesPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [pendingActive, setPendingActive] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [openingUid, setOpeningUid] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    void (async () => {
      try {
        const ok = await isChatDomainAllowed(user.email);
        setAllowed(ok);
        if (!ok) return;
        await ensureChatProfile(user.uid, user.email, user.displayName);
        const all = await listChatProfiles();
        setProfiles(all);
        setProfile(
          all.find(item => item.uid === user.uid) || {
            uid: user.uid,
            name: user.displayName || user.email.split("@")[0],
            email: user.email,
            domain: user.email.split("@")[1],
            nameLower: (user.displayName || user.email.split("@")[0]).toLowerCase(),
          }
        );
      } catch (error) {
        setAllowed(false);
        setStatus(error instanceof Error ? error.message : "Could not initialise Messages.");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !allowed) return;
    return subscribeConversations(user.uid, items => {
      setConversations(items);
      setPendingActive(current => current && items.some(item => item.id === current.id) ? null : current);
    });
  }, [user, allowed]);

  useEffect(() => {
    setMessages([]);
    if (!activeId) return;
    return subscribeMessages(activeId, setMessages);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  const active = conversations.find(item => item.id === activeId) || (pendingActive?.id === activeId ? pendingActive : null);
  const names = useMemo(() => new Map(profiles.map(item => [item.uid, item.name])), [profiles]);
  const results = profiles
    .filter(item => item.uid !== user?.uid && (`${item.name} ${item.email}`).toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 20);

  useEffect(() => {
    if (!active || !user || active.type !== "direct") {
      setBlocked(false);
      return;
    }
    const other = active.members.find(uid => uid !== user.uid);
    if (!other) return;
    void Promise.all([isUserBlocked(user.uid, other), isUserBlocked(other, user.uid)])
      .then(([a, b]) => setBlocked(a || b))
      .catch(() => setBlocked(false));
  }, [active, user]);

  async function openDm(other: ChatProfile) {
    if (!profile || openingUid) return;
    setOpeningUid(other.uid);
    setStatus("");
    try {
      const id = await createDirectConversation(profile, other);
      const optimistic: ChatConversation = {
        id,
        type: "direct",
        title: "",
        members: [profile.uid, other.uid].sort(),
        ownerUid: profile.uid,
        createdBy: profile.uid,
        lastMessage: "",
      };
      setPendingActive(optimistic);
      setActiveId(id);
      setSearch("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open this chat.");
    } finally {
      setOpeningUid("");
    }
  }

  async function makeGroup() {
    if (!user) return;
    const title = window.prompt("Group name") || "";
    if (!title.trim()) return;
    setStatus("");
    try {
      const id = await createGroupConversation(user.uid, title, groupMembers);
      const optimistic: ChatConversation = {
        id,
        type: "group",
        title: title.trim(),
        members: Array.from(new Set([user.uid, ...groupMembers])),
        ownerUid: user.uid,
        createdBy: user.uid,
        lastMessage: "",
      };
      setPendingActive(optimistic);
      setGroupMode(false);
      setGroupMembers([]);
      setSearch("");
      setActiveId(id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create group.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !activeId || !draft.trim() || sending || blocked) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    setStatus("");
    try {
      await sendMessage(activeId, user.uid, text);
    } catch (error) {
      setDraft(text);
      setStatus(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function toggleBlock() {
    if (!user || !active || active.type !== "direct") return;
    const other = active.members.find(uid => uid !== user.uid);
    if (!other) return;
    try {
      if (blocked) {
        await unblockUser(user.uid, other);
        setBlocked(false);
      } else {
        await blockUser(user.uid, other);
        setBlocked(true);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update block setting.");
    }
  }

  if (allowed === null) return <section className="page"><p>Checking school messaging access…</p></section>;
  if (!allowed) return <section className="page"><div className="admin-lock"><MessageCircle size={32}/><h1>Messages is for approved schools</h1><p>Your school email domain has not been enabled for MStudy internal messaging.</p>{status ? <p>{status}</p> : null}</div></section>;

  const activeLabel = active
    ? active.type === "group"
      ? active.title
      : names.get(active.members.find(uid => uid !== user?.uid) || "") || "Student"
    : "";

  return <section className="page chat-page">
    <div className="page-head">
      <div><p className="eyebrow">Internal school messaging</p><h1>Messages</h1><p>Search for a student, open a conversation and text in real time.</p></div>
      <button className="secondary-button" onClick={() => { setGroupMode(value => !value); setSearch(""); }}><Users size={16}/> {groupMode ? "Cancel group" : "New group"}</button>
    </div>

    {status ? <div className="notice">{status}</div> : null}

    <div className="chat-layout">
      <aside className={active ? "chat-sidebar chat-sidebar-mobile-hidden" : "chat-sidebar"}>
        <div className="chat-search"><Search size={16}/><input placeholder={groupMode ? "Search students to add" : "Search students by name"} value={search} onChange={event => setSearch(event.target.value)}/>{search ? <button className="chat-clear" onClick={() => setSearch("")} aria-label="Clear search"><X size={14}/></button> : null}</div>

        {search ? <div className="chat-search-results">
          {results.length ? results.map(item => <button key={item.uid} disabled={openingUid === item.uid} onClick={() => groupMode ? setGroupMembers(current => current.includes(item.uid) ? current.filter(uid => uid !== item.uid) : [...current, item.uid]) : void openDm(item)}>
            <span><strong>{item.name}</strong><small>{item.email}</small></span>
            <span>{groupMode ? (groupMembers.includes(item.uid) ? "Selected" : "Add") : (openingUid === item.uid ? "Opening…" : "Message")}</span>
          </button>) : <div className="chat-no-results">No matching students yet. They need to sign in to MStudy once before appearing here.</div>}
        </div> : null}

        {groupMode && groupMembers.length ? <button className="primary-button" onClick={() => void makeGroup()}>Create group ({groupMembers.length + 1})</button> : null}

        <div className="chat-conversations">
          {conversations.length ? conversations.map(conversation => {
            const other = conversation.type === "direct" ? conversation.members.find(uid => uid !== user?.uid) : null;
            const label = conversation.type === "group" ? conversation.title : names.get(other || "") || "Student";
            return <button className={activeId === conversation.id ? "active" : ""} key={conversation.id} onClick={() => { setPendingActive(null); setActiveId(conversation.id); }}><strong>{label}</strong><small>{conversation.lastMessage || "Open chat"}</small></button>;
          }) : !search ? <div className="chat-no-results">No conversations yet. Search for a student above to start one.</div> : null}
        </div>
      </aside>

      <main className={active ? "chat-thread chat-thread-open" : "chat-thread"}>
        {!active ? <div className="chat-empty"><MessageCircle size={36}/><h2>Start a conversation</h2><p>Search for a student and press Message.</p></div> : <>
          <header className="chat-thread-head">
            <div className="chat-thread-title"><button className="chat-back" onClick={() => setActiveId("")} aria-label="Back to conversations">‹</button><div><strong>{activeLabel}</strong><small>{active.type === "group" ? `${active.members.length} members` : "Direct message"}</small></div></div>
            {active.type === "direct" ? <button className="text-button" onClick={() => void toggleBlock()}><Ban size={15}/>{blocked ? "Unblock" : "Block"}</button> : null}
          </header>

          <div className="chat-messages">
            {!messages.length ? <div className="chat-thread-empty"><MessageCircle size={26}/><strong>No messages yet</strong><span>Send the first message below.</span></div> : null}
            {messages.map(message => {
              const mine = message.senderUid === user?.uid;
              return <div className={mine ? "chat-bubble mine" : "chat-bubble"} key={message.id}>
                <small>{mine ? "You" : names.get(message.senderUid) || "Student"}</small>
                <p>{message.text}</p>
                <div className="chat-message-actions">
                  {mine ? <button onClick={() => void deleteOwnMessage(active.id, message.id)} title="Delete message"><Trash2 size={13}/></button> : <button onClick={() => { const reason = window.prompt("Why are you reporting this message?") || ""; if (reason && user) void reportMessage(active.id, message, user.uid, reason); }} title="Report message">Report</button>}
                </div>
              </div>;
            })}
            <div ref={bottomRef}/>
          </div>

          <form className="chat-compose" onSubmit={submit}>
            <input autoFocus value={draft} onChange={event => setDraft(event.target.value)} disabled={blocked || sending} maxLength={2000} placeholder={blocked ? "Messaging blocked" : "Type a message…"}/>
            <button className="primary-button" disabled={blocked || sending || !draft.trim()} aria-label="Send message"><Send size={16}/></button>
          </form>
        </>}
      </main>
    </div>
  </section>;
}
