// src/components/Chat/ChatPanel.jsx
import {
  MoreVertical,
  Phone,
  Search,
  ArrowLeft,
} from "lucide-react";
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

  // ✅ one tick shape (used twice)
  const TickPath = ({ dx = 0 }) => (
    <path
      d={`M${1.2 + dx} 6.3 L${4.4 + dx} 9.6 L${10.8 + dx} 2.2`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"            // ✅ bolder (increase/decrease)
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <span className={cls} aria-label={status} title={status}>
      {two ? (
        <svg viewBox="0 0 22 12" width="20" height="12">
          {/* first tick */}
          <TickPath dx={0} />
          {/* second tick: same exact path, shifted */}
          <TickPath dx={6} />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12" width="14" height="12">
          <path
            d="M1.2 6.3 L4.4 9.6 L10.8 2.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"        // ✅ bolder
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}



// ✅ Safe timestamp to ms (prevents crashes / white page)
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
      <mark key={i} className="msgHighlight">{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function ChatPanel({ chatId, onBack }) {
  const { user } = useAuth();
  const myUid = user?.uid;
/*
  // ✅ prevents white page on reload (user can be null for a moment)
  if (!myUid) {
    return (
      <div className="chatPanel emptyWallpaper">
        <div className="emptyText">Loading...</div>
      </div>
    );
  }
*/

  // ---------- Core data ----------
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);

  // ---------- Composer ----------
  const [text, setText] = useState("");

  // ---------- Search ----------
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIds, setMatchIds] = useState([]);
  const [matchIndex, setMatchIndex] = useState(0);

  // ---------- Emoji picker ----------
  const [emojiOpen, setEmojiOpen] = useState(false);

  // ---------- Refs ----------
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  const inputRef = useRef(null);
  const emojiRef = useRef(null);
  const msgRefs = useRef({});


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

  // Subscribe to other user's profile (presence)
  useEffect(() => {
    if (!chat || !user) return;

    const other = chat.members?.find((id) => id !== user.uid);
    if (!other) return;

    const unsub = listenUser(other, setOtherUser);
    return () => unsub?.();
  }, [chat?.id, chat?.members, user?.uid]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Keep unread at 0 while inside chat
  useEffect(() => {
    if (!chatId || !user) return;
    markRead(chatId, myUid).catch(() => {});
  }, [chatId, user?.uid, messages.length]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setMatchIds([]);
      setMatchIndex(0);
      return;
    }

    const ids = messages
      .filter((m) => (m?.text || "").toLowerCase().includes(q))
      .map((m) => m.id);

    setMatchIds(ids);
    setMatchIndex(ids.length ? 0 : 0);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (!matchIds.length) return;
    const id = matchIds[matchIndex];
    const el = msgRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [matchIds, matchIndex]);

  useEffect(() => {
    function onDocClick(e) {
      if (!emojiOpen) return;

      const pickerEl = emojiRef.current;
      const btnEl = e.target.closest?.(".emojiBtn");

      // if clicked inside picker or on the emoji button, ignore
      if (pickerEl && pickerEl.contains(e.target)) return;
      if (btnEl) return;

      setEmojiOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [emojiOpen]);


  function goNext() {
    if (!matchIds.length) return;
    setMatchIndex((i) => (i + 1) % matchIds.length);
  }

  function goPrev() {
    if (!matchIds.length) return;
    setMatchIndex((i) => (i - 1 + matchIds.length) % matchIds.length);
  }

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

      // move cursor after emoji
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    };

  if (!chatId) {
    return (
      <div className="chatPanel emptyWallpaper">
        <div className="emptyText">Select a chat</div>
      </div>
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

  // ✅ Tick status using lastReadAt (NO message updates)
  function getTickStatus(message) {
    // 1 tick until createdAt resolves
    if (!message?.createdAt) return "sent";

    // 2 gray ticks once createdAt exists
    const msgMs = toMs(message.createdAt);
    if (!msgMs) return "sent";

    // read if other user's lastReadAt is after this message
    const readAt = otherUid ? chat?.lastReadAt?.[otherUid] : null;
    const readMs = toMs(readAt);

    if (readMs && msgMs <= readMs) return "read";
    return "delivered";
  }

  function getTickStatus(m) {
  // 1 tick until createdAt exists
  if (!m?.createdAt) return "sent";

  const msgMs = toMs(m.createdAt);
  if (!msgMs) return "sent";

  const readAt = otherUid ? chat?.lastReadAt?.[otherUid] : null;
  const readMs = toMs(readAt);

  if (readMs && msgMs <= readMs) return "read";
  return "delivered";
}


return (
  <div className="chatPanel">
    <div className="chatHeader">
      <button className="iconBtn backBtn" onClick={onBack} title="Back">
        <ArrowLeft size={18} />
      </button>

      <div className="avatarSmall">
        <span className="avatarSmallText">
          {otherName?.[0]?.toUpperCase() || "?"}
        </span>
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

    <div className="chatBody">
      <div className="dayPill">Today</div>

      {messages.map((m) => {
        const mine = m.senderId === user.uid;
        const status = mine ? getTickStatus(m) : null;

        return (
          <div
            key={m.id}
            ref={(el) => (msgRefs.current[m.id] = el)} // ✅ needed for arrows jump
            className={`msgRow ${mine ? "right" : ""}`}
          >
            <div className={`bubble ${mine ? "out" : "in"}`}>
              <div className="bubbleText">
                <HighlightedText text={m.text} query={searchQuery} /> {/* ✅ highlight */}
              </div>

              <div className="meta">
                {formatTime(m.createdAt)}
                {mine && <TickIcon status={status} />}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>

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
          <EmojiPicker
            onEmojiClick={(emojiData) => onEmojiClick(emojiData)}
            height={360}
            width={320}
            lazyLoadEmojis
          />
        </div>
      )}
    </div>
  </div>
);

}
