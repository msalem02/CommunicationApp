import "./ChatRow.css";
import { useAuth } from "../../context/AuthContext";


function RowTickIcon({ read }) {
  return (
    <span className={`rowTicks ${read ? "rowTicksRead" : "rowTicksGray"}`} aria-label={read ? "read" : "delivered"}>
      <svg viewBox="0 0 22 12" width="18" height="12">
        <path
          d="M1.2 6.3 L4.4 9.6 L10.8 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.2 6.3 L10.4 9.6 L16.8 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}


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

function formatTime(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name) {
  const n = (name || "").trim();
  if (!n) return "?";
  return n[0].toUpperCase();
}

export default function ChatRow({ chat, active, onClick }) {
  const { user } = useAuth();

  const idx = chat.members?.[0] === user.uid ? 1 : 0;
  const title = chat.memberNames?.[idx] || "Chat";

  const unread = chat.unread?.[user.uid] || 0;
  const isMine = chat.lastMessageSenderId === user.uid;
  const otherUid = chat.members?.find((id) => id !== user.uid);
  const lastMsgMs = toMs(chat.lastMessageAt);
  const otherReadMs = toMs(chat.lastReadAt?.[otherUid]);
  const isRead = isMine && lastMsgMs > 0 && otherReadMs >= lastMsgMs;

  const otherTyping = (() => {
    const ts = otherUid ? chat.typing?.[otherUid] : null;
    if (!ts) return false;
    const ms = ts?.toDate ? ts.toDate().getTime() : Date.now();
    return Date.now() - ms < 2500;
  })();

  return (
    <button className={`chatRow ${active ? "active" : ""}`} onClick={onClick}>
      <div className="avatar">
        <span className="avatarText">{initials(title)}</span>
      </div>

      <div className="chatMain">
        <div className="chatTopLine">
          <div className="chatName">{title}</div>
          <div className="chatTime">{formatTime(chat.updatedAt)}</div>
        </div>

        <div className="chatBottomLine">
          <div className={`chatMsg ${otherTyping ? "typingText" : ""}`}>
            {otherTyping ? (
              "typing..."
            ) : chat.lastMessage ? (
              <>
                {isMine && <RowTickIcon read={isRead} />}
                {isMine ? (
                  <>
                    <span className="youPrefix">You:</span> {chat.lastMessage}
                  </>
                ) : (
                  chat.lastMessage
                )}
              </>
            ) : (
              "—"
            )}
          </div>



          {/* hide unread while active */}
          {!active && unread > 0 ? <div className="unreadBadge">{unread}</div> : null}
        </div>
      </div>
    </button>
  );
}
