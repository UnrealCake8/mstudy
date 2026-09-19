"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Ban, Info, MessageCircle, Search, Send, Trash2, UserPlus, Users, X } from "lucide-react";
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
  timestampMs,
  unblockUser,
} from "@/lib/chat";

function Avatar({ profile, size = "normal" }: { profile?: ChatProfile; size?: "normal" | "large" }) {
  const initial = (profile?.name || "S")[0].toUpperCase();
  return <span className={size === "large" ? "chat-avatar large" : "chat-avatar"}>
    {profile?.photoURL ? <img src={profile.photoURL} alt=""/> : initial}
  </span>;
}

function timeLabel(value: unknown) {
  const ms = timestampMs(value);
  if (!ms) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

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
    const email = user.email;
    void (async () => {
      try {
        const ok = await isChatDomainAllowed(email);
        setAllowed(ok);
        if (!ok) return;
        await ensureChatProfile(user.uid, email, user.displayName, user.photoURL);
        const all = await listChatProfiles();
        setProfiles(all);
        setProfile(all.find(item => item.uid === user.uid) || {
          uid: user.uid,
          name: user.displayName || email.split("@")[0],
          email,
          domain: email.split("@")[1],
          nameLower: (user.displayName || email).toLowerCase(),
          photoURL: user.photoURL || "",
        });
      } catch (error) {
        setAllowed(false);
        setStatus(error instanceof Error ? error.message : "Could not open Messages.");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !allowed) return;
    return subscribeConversations(user.uid, setConversations);
  }, [user, allowed]);

  const active = conversations.find(item => item.id === activeId) || (pendingActive?.id === activeId ? pendingActive : null);
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    return subscribeMessages(activeId, setMessages);
  }, [activeId]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const profileMap = useMemo(() => new Map(profiles.map(item => [item.uid, item])), [profiles]);
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return profiles.filter(item => item.uid !== user?.uid && (item.nameLower.includes(term) || item.email.toLowerCase().includes(term))).slice(0, 20);
  }, [profiles, search, user?.uid]);

  useEffect(() => {
    if (!user || !active || active.type !== "direct") { setBlocked(false); return; }
    const other = active.members.find(uid => uid !== user.uid);
    if (other) void isUserBlocked(user.uid, other).then(setBlocked);
  }, [active, user]);

  function conversationDetails(conversation: ChatConversation) {
    if (conversation.type === "group") return { label: conversation.title, person: undefined };
    const other = conversation.members.find(uid => uid !== user?.uid);
    const person = profileMap.get(other || "");
    return { label: person?.name || "Student", person };
  }

  async function openDm(other: ChatProfile) {
    if (!profile) return;
    setOpeningUid(other.uid);
    setStatus("");
    try {
      const id = await createDirectConversation(profile, other);
      setPendingActive({ id, type: "direct", title: "", members: [profile.uid, other.uid], ownerUid: profile.uid, createdBy: profile.uid });
      setActiveId(id);
      setSearch("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open chat.");
    } finally {
      setOpeningUid("");
    }
  }

  async function makeGroup() {
    if (!user || groupMembers.length < 2) {
      setStatus("Choose at least two students for a group.");
      return;
    }
    const title = window.prompt("Name this group", "Study group") || "";
    if (!title.trim()) return;
    try {
      const id = await createGroupConversation(user.uid, title, groupMembers);
      setPendingActive({ id, type: "group", title, members: [user.uid, ...groupMembers], ownerUid: user.uid, createdBy: user.uid });
      setActiveId(id);
      setGroupMode(false);
      setGroupMembers([]);
      setSearch("");
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
    if (blocked) await unblockUser(user.uid, other);
    else await blockUser(user.uid, other);
    setBlocked(!blocked);
  }

  if (allowed === null) return <section className="page"><p>Opening Messages…</p></section>;
  if (!allowed) return <section className="page"><div className="admin-lock"><MessageCircle size={32}/><h1>Messages is for approved schools</h1><p>Your school email domain has not been enabled for internal messaging.</p>{status ? <p>{status}</p> : null}</div></section>;

  const activeDetails = active ? conversationDetails(active) : null;

  return <section className="page chat-page">
    <div className="page-head chat-page-head">
      <div><p className="eyebrow">Your school community</p><h1>Messages</h1><p>Direct messages and study groups, all inside MPlace Study.</p></div>
      <button className="primary-button" onClick={() => { setGroupMode(value => !value); setSearch(""); }}><Users size={17}/>{groupMode ? "Cancel group" : "New group"}</button>
    </div>

    {status ? <div className="notice">{status}</div> : null}

    <div className="chat-layout">
      <aside className={active ? "chat-sidebar chat-sidebar-mobile-hidden" : "chat-sidebar"}>
        <div className="chat-me">
          <Avatar profile={profile || undefined}/>
          <div><strong>{profile?.name}</strong><small>{profile?.status || "Available"}</small></div>
        </div>
        <div className="chat-search"><Search size={17}/><input placeholder={groupMode ? "Find students to add" : "Find a student"} value={search} onChange={event => setSearch(event.target.value)}/>{search ? <button className="chat-clear" onClick={() => setSearch("")} aria-label="Clear"><X size={15}/></button> : null}</div>

        {search ? <div className="chat-search-results">
          {results.length ? results.map(item => <button key={item.uid} disabled={openingUid === item.uid} onClick={() => groupMode ? setGroupMembers(current => current.includes(item.uid) ? current.filter(uid => uid !== item.uid) : [...current, item.uid]) : void openDm(item)}>
            <Avatar profile={item}/><span><strong>{item.name}</strong><small>{item.status || item.email}</small></span>
            <em>{groupMode ? (groupMembers.includes(item.uid) ? "Added" : "Add") : "Chat"}</em>
          </button>) : <div className="chat-no-results">No matching students. They need to sign in once before appearing here.</div>}
        </div> : null}

        {groupMode && groupMembers.length ? <button className="primary-button chat-create-group" onClick={() => void makeGroup()}><UserPlus size={16}/>Create group ({groupMembers.length + 1})</button> : null}

        <p className="chat-list-label">Conversations</p>
        <div className="chat-conversations">
          {conversations.length ? conversations.map(conversation => {
            const details = conversationDetails(conversation);
            return <button className={activeId === conversation.id ? "active" : ""} key={conversation.id} onClick={() => { setPendingActive(null); setActiveId(conversation.id); }}>
              {conversation.type === "group" ? <span className="chat-avatar group"><Users size={17}/></span> : <Avatar profile={details.person}/>}
              <span><strong>{details.label}</strong><small>{conversation.lastMessage || "Start chatting"}</small></span>
            </button>;
          }) : !search ? <div className="chat-no-results">No conversations yet. Search above to start one.</div> : null}
        </div>
      </aside>

      <main className={active ? "chat-thread chat-thread-open" : "chat-thread"}>
        {!active ? <div className="chat-empty"><MessageCircle size={38}/><h2>Your conversations</h2><p>Choose a chat or search for someone new.</p></div> : <>
          <header className="chat-thread-head">
            <div className="chat-thread-title">
              <button className="chat-back" onClick={() => setActiveId("")} aria-label="Back">‹</button>
              {active.type === "group" ? <span className="chat-avatar large group"><Users size={20}/></span> : <Avatar profile={activeDetails?.person} size="large"/>}
              <div><strong>{activeDetails?.label}</strong><small>{active.type === "group" ? `${active.members.length} members` : activeDetails?.person?.status || "Direct message"}</small></div>
            </div>
            {active.type === "direct" ? <button className="chat-info-button" onClick={() => void toggleBlock()} title={blocked ? "Unblock student" : "Block student"}><Ban size={17}/></button> : <button className="chat-info-button" title="Group information"><Info size={18}/></button>}
          </header>

          <div className="chat-messages">
            {!messages.length ? <div className="chat-thread-empty"><MessageCircle size={27}/><strong>No messages yet</strong><span>Say hello below.</span></div> : null}
            {messages.map(message => {
              const mine = message.senderUid === user?.uid;
              const sender = profileMap.get(message.senderUid);
              return <div className={mine ? "chat-message-line mine" : "chat-message-line"} key={message.id}>
                {!mine ? <Avatar profile={sender}/> : null}
                <div className={mine ? "chat-bubble mine" : "chat-bubble"}>
                  {!mine && active.type === "group" ? <small className="chat-sender-name">{sender?.name || "Student"}</small> : null}
                  <p>{message.text}</p>
                  <div className="chat-message-meta"><span>{timeLabel(message.createdAt)}</span>{mine ? <button onClick={() => void deleteOwnMessage(active.id, message.id)} title="Delete"><Trash2 size={12}/></button> : <button onClick={() => { const reason = window.prompt("Why are you reporting this message?") || ""; if (reason && user) void reportMessage(active.id, message, user.uid, reason); }}>Report</button>}</div>
                </div>
              </div>;
            })}
            <div ref={bottomRef}/>
          </div>

          <form className="chat-compose" onSubmit={submit}>
            <input value={draft} onChange={event => setDraft(event.target.value)} disabled={blocked || sending} maxLength={2000} placeholder={blocked ? "Messaging is blocked" : `Message ${activeDetails?.label || ""}`}/>
            <button disabled={blocked || sending || !draft.trim()} aria-label="Send"><Send size={18}/></button>
          </form>
        </>}
      </main>
    </div>
  </section>;
}
