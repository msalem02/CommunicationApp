// src/components/Chat/ChatPanel.jsx
import { MoreVertical, Phone, Search, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./ChatPanel.css";
import {
  listenMessages,
  sendMessage,
  listenChat,
  setTyping,
  bumpUnread,
  markRead,
  listenUser,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  updateChatPreview,
} from "../../firebase/chatApi";
import { useAuth } from "../../context/AuthContext";
import EmojiPicker from "emoji-picker-react";

function formatTime(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function TickIcon({ status }) {
  const cls = status === "read" ? "waTicks waRead" : "waTicks waGray";
  const two = status === "delivered" || status === "read";

  const TickPath = ({ dx = 0 }) => (
    <path
      d={`M${1.2 + dx} 6.3 L${4.4 + dx} 9.6 L${10.8 + dx} 2.2`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <span className={cls} aria-label={status} title={status}>
      {two ? (
        <svg viewBox="0 0 22 12" width="20" height="12">
          <TickPath dx={0} />
          <TickPath dx={6} />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12" width="14" height="12">
          <path
            d="M1.2 6.3 L4.4 9.6 L10.8 2.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

// Safe timestamp to ms
function toMs(ts) {
  if (!ts) return 0;
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : 0;
  } catch {
    return 0;
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }) {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;

  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = String(text).split(re);

  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="msgHighlight">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function timeAgoFrom(ts) {
  if (!ts) return "last seen recently";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "last seen just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `last seen ${min} min ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `last seen ${hr}h ago`;

  const day = Math.floor(hr / 24);
  return `last seen ${day}d ago`;
}

function isReallyOnline(other) {
  if (!other?.isOnline || !other?.lastSeen) return false;
  const d = other.lastSeen?.toDate ? other.lastSeen.toDate() : new Date(other.lastSeen);
  return Date.now() - d.getTime() < 60000;
}

export default function ChatPanel({ chatId, onBack }) {
  const { user } = useAuth();
  const myUid = user?.uid;

  // Core data
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);

  // Composer
  const [text, setText] = useState("");

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIds, setMatchIds] = useState([]);
  const [matchIndex, setMatchIndex] = useState(0);

  // Emoji picker
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Message menu + edit
  const [menuFor, setMenuFor] = useState(null); // messageId
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  // Refs
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);
  const msgRefs = useRef({});
  const [showToBottom, setShowToBottom] = useState(false);
  const chatBodyRef = useRef(null);
  const didInitialScrollRef = useRef(false);

  // Close message menu on outside click
  useEffect(() => {
    const onDoc = (e) => {
      // If clicking inside menu OR on the menu button, don't close
      const inMenu = e.target.closest?.(".msgMenu");
      const inBtn = e.target.closest?.(".msgMenuBtn");
      if (inMenu || inBtn) return;

      setMenuFor(null);
    };

    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Listen chat doc
  useEffect(() => {
    if (!chatId) return;
    const unsub = listenChat(chatId, setChat);
    return () => unsub?.();
  }, [chatId]);

  // Listen messages
  useEffect(() => {
    if (!chatId) return;
    const unsub = listenMessages(chatId, setMessages);
    return () => unsub?.();
  }, [chatId]);

  // Subscribe to other user's profile
  useEffect(() => {
    if (!chat || !user) return;
    const other = chat.members?.find((id) => id !== user.uid);
    if (!other) return;
    const unsub = listenUser(other, setOtherUser);
    return () => unsub?.();
  }, [chat?.id, chat?.members, user?.uid]);

  const otherUid = useMemo(() => {
    if (!chat || !user) return null;
    return chat.members?.find((id) => id !== user.uid) || null;
  }, [chat, user]);

  const otherName = useMemo(() => {
    if (!chat || !user) return "Chat";
    const idx = chat.members?.[0] === user.uid ? 1 : 0;
    return chat.memberNames?.[idx] || "Chat";
  }, [chat, user]);

  const otherTyping = useMemo(() => {
    if (!chat || !user) return false;
    const ouid = chat.members?.find((id) => id !== user.uid);
    const ts = ouid ? chat.typing?.[ouid] : null;
    if (!ts) return false;
    return Date.now() - toMs(ts) < 2500;
  }, [chat, user]);

  // Filter messages that are deleted for me
  const visibleMessages = useMemo(() => {
    if (!myUid) return messages;
    return messages.filter((m) => !m?.deletedFor?.[myUid]);
  }, [messages, myUid]);

  // Auto scroll (only if near bottom)
  useEffect(() => {
    const el = chatBodyRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;

    if (nearBottom) scrollToBottom("smooth");
  }, [visibleMessages.length]);

  // Keep unread 0 while inside chat
  useEffect(() => {
    if (!chatId || !user || !myUid) return;
    markRead(chatId, myUid).catch(() => {});
  }, [chatId, user?.uid, myUid, visibleMessages.length]);

  // Search matches
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setMatchIds([]);
      setMatchIndex(0);
      return;
    }

    const ids = visibleMessages
      .filter((m) => (m?.text || "").toLowerCase().includes(q))
      .map((m) => m.id);

    setMatchIds(ids);
    setMatchIndex(ids.length ? 0 : 0);
  }, [searchQuery, visibleMessages]);

  useEffect(() => {
    if (!matchIds.length) return;
    const id = matchIds[matchIndex];
    const el = msgRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [matchIds, matchIndex]);

  // Emoji click outside close
  useEffect(() => {
    function onDocClick(e) {
      if (!emojiOpen) return;

      const pickerEl = emojiRef.current;
      const btnEl = e.target.closest?.(".emojiBtn");

      if (pickerEl && pickerEl.contains(e.target)) return;
      if (btnEl) return;

      setEmojiOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [emojiOpen]);

  // Reset initial scroll per chat
  useEffect(() => {
    if (!chatId) return;
    didInitialScrollRef.current = false;
  }, [chatId]);

  useEffect(() => {
    if (!visibleMessages.length) return;
    if (didInitialScrollRef.current) return;

    didInitialScrollRef.current = true;
    scrollToBottom("auto");
  }, [visibleMessages.length]);

  function goNext() {
    if (!matchIds.length) return;
    setMatchIndex((i) => (i + 1) % matchIds.length);
  }

  function goPrev() {
    if (!matchIds.length) return;
    setMatchIndex((i) => (i - 1 + matchIds.length) % matchIds.length);
  }

  function scrollToBottom(behavior = "auto") {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }

  function handleChatScroll() {
    const el = chatBodyRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowToBottom(distanceFromBottom > 120);
  }

  const handleTyping = (val) => {
    setText(val);
    if (!chatId || !user) return;

    setTyping(chatId, myUid, true).catch(() => {});

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setTyping(chatId, user.uid, false).catch(() => {});
    }, 1200);
  };

  const onSend = async () => {
    const t = text.trim();
    if (!t || !chatId || !user) return;

    setText("");
    setTyping(chatId, user.uid, false).catch(() => {});

    await sendMessage({ chatId, senderId: user.uid, text: t });

    const other = chat?.members?.find((id) => id !== user.uid);
    if (other) bumpUnread(chatId, other).catch(() => {});
  };

  const onEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;

    const el = inputRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }

    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;

    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // Tick status (read receipts) using lastReadAt
  function getTickStatus(m) {
    if (!m?.createdAt) return "sent";

    const msgMs = toMs(m.createdAt);
    if (!msgMs) return "sent";

    const readAt = otherUid ? chat?.lastReadAt?.[otherUid] : null;
    const readMs = toMs(readAt);

    if (readMs && msgMs <= readMs) return "read";
    return "delivered";
  }

  // Handlers: edit + delete
  async function doDeleteForMe(m) {
    try {
      await deleteMessageForMe(chatId, m.id, myUid);
      setMenuFor(null);
    } catch (e) {
      console.error("Delete for me failed:", e);
      alert(e?.message || String(e));
    }
  }

  async function doDeleteForEveryone(m) {
    try {
      await deleteMessageForEveryone(chatId, m.id);

      const isLast = visibleMessages[visibleMessages.length - 1]?.id === m.id;
      if (isLast) {
        await updateChatPreview(chatId, "Message deleted", user.uid);
      }

      setMenuFor(null);
    } catch (e) {
      console.error("Delete for everyone failed:", e);
      alert(e?.message || String(e));
    }
  }

  async function doEditSave(m) {
    try {
      const t = editDraft.trim();
      if (!t) return;

      await editMessage(chatId, m.id, t);

      const isLast = visibleMessages[visibleMessages.length - 1]?.id === m.id;
      if (isLast) {
        await updateChatPreview(chatId, t, user.uid);
      }

      setEditingId(null);
      setEditDraft("");
      setMenuFor(null);
    } catch (e) {
      console.error("Edit failed:", e);
      alert(e?.message || String(e));
    }
  }


  if (!chatId) {
    return (
      <div className="chatPanel emptyWallpaper">
        <div className="emptyText">Select a chat</div>
      </div>
    );
  }

  return (
    <div className="chatPanel">
      <div className="chatHeader">
        <button className="iconBtn backBtn" onClick={onBack} title="Back">
          <ArrowLeft size={18} />
        </button>

        <div className="avatarSmall">
          <span className="avatarSmallText">{otherName?.[0]?.toUpperCase() || "?"}</span>
        </div>

        <div className="headerText">
          <div className="headerName">{otherName}</div>
          <div className="headerStatus">
            {otherTyping
              ? "typing..."
              : isReallyOnline(otherUser)
              ? "online"
              : timeAgoFrom(otherUser?.lastSeen)}
          </div>
        </div>

        <div className="headerActions">
          <button
            className="iconBtn"
            title="Search"
            onClick={() => {
              setSearchOpen((v) => !v);
              setSearchQuery("");
              setMatchIds([]);
              setMatchIndex(0);
            }}
          >
            <Search size={18} />
          </button>

          <button className="iconBtn" title="Call">
            <Phone size={18} />
          </button>

          <button className="iconBtn" title="More">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="chatSearchWrap">
          <div className="chatSearchPill">
            <span className="chatSearchIcon">⌕</span>

            <input
              className="chatSearchInput"
              placeholder="Search in conversation"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            <div className="chatSearchCount">
              {matchIds.length ? `${matchIndex + 1}/${matchIds.length}` : "0/0"}
            </div>

            <button
              className="chatSearchBtn"
              onClick={goPrev}
              disabled={!matchIds.length}
              title="Previous"
              type="button"
            >
              ↑
            </button>

            <button
              className="chatSearchBtn"
              onClick={goNext}
              disabled={!matchIds.length}
              title="Next"
              type="button"
            >
              ↓
            </button>

            <button
              className="chatSearchBtn chatSearchClose"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
                setMatchIds([]);
                setMatchIndex(0);
              }}
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="chatBody" ref={chatBodyRef} onScroll={handleChatScroll}>
        {visibleMessages.map((m) => {
          const mine = m.senderId === user.uid;
          const status = mine ? getTickStatus(m) : null;

          const isEditing = editingId === m.id;
          const isDeleted = !!m.isDeleted;

          return (
            <div
              key={m.id}
              ref={(el) => (msgRefs.current[m.id] = el)}
              className={`msgRow ${mine ? "right" : ""}`}
            >
              <div className={`bubble ${mine ? "out" : "in"}`}>
                {/* Menu button */}
                <button
                  className="msgMenuBtn"
                  type="button"
                  title="Message options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor((cur) => (cur === m.id ? null : m.id));
                  }}
                >
                  ⋮
                </button>

                {/* Dropdown */}
                {menuFor === m.id && (
                  <div className="msgMenu" onClick={(e) => e.stopPropagation()}>
                    {mine && !isDeleted && (
                      <button
                        className="msgMenuItem"
                        type="button"
                        onClick={() => {
                          setMenuFor(null);
                          setEditingId(m.id);
                          setEditDraft(m.text || "");
                        }}
                      >
                        Edit
                      </button>
                    )}

                    <button
                      className="msgMenuItem"
                      type="button"
                      onClick={() => doDeleteForMe(m)}
                    >
                      Delete for me
                    </button>

                    {mine && (
                      <button
                        className="msgMenuItem danger"
                        type="button"
                        onClick={() => doDeleteForEveryone(m)}
                      >
                        Delete for everyone
                      </button>
                    )}
                  </div>
                )}

                {/* Content */}
                {isDeleted ? (
                  <div className="bubbleDeleted">This message was deleted</div>
                ) : isEditing ? (
                  <div className="editWrap">
                    <input
                      className="editInput"
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") doEditSave(m);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditDraft("");
                        }
                      }}
                      autoFocus
                    />
                    <div className="editActions">
                      <button
                        className="editBtn ghost"
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                      >
                        Cancel
                      </button>
                      <button className="editBtn" type="button" onClick={() => doEditSave(m)}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bubbleText">
                    <HighlightedText text={m.text} query={searchQuery} />
                  </div>
                )}

                {/* Meta */}
                <div className="meta">
                  {formatTime(m.createdAt)}
                  {!!m.editedAt && !isDeleted && <span className="editedTag">edited</span>}
                  {mine && <TickIcon status={status} />}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {showToBottom && (
        <button
          className="toBottomBtn"
          type="button"
          title="Back to latest"
          onClick={() => scrollToBottom("smooth")}
        >
          ↓
        </button>
      )}

      <div className="chatInputWrap">
        <div className="chatInputPill">
          <button
            className="emojiBtn"
            title="Emoji"
            onClick={() => setEmojiOpen((v) => !v)}
            type="button"
          >
            🙂
          </button>

          <input
            ref={inputRef}
            className="chatInput"
            placeholder="Message"
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />

          <button className="sendBtn" onClick={onSend} title="Send" type="button">
            ➤
          </button>
        </div>

        {emojiOpen && (
          <div className="emojiPop" ref={emojiRef}>
            <EmojiPicker onEmojiClick={onEmojiClick} height={360} width={320} lazyLoadEmojis />
          </div>
        )}
      </div>
    </div>
  );
}
