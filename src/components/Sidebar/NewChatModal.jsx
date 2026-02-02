import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { fetchAllUsers, ensureChat } from "../../firebase/chatApi";
import { useAuth } from "../../context/AuthContext";

export default function NewChatModal({ onClose, onPickChat }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchAllUsers()
      .then(setUsers)
      .catch((e) => {
        console.error("fetchAllUsers error:", e);
        setErr(String(e?.message || e));
      });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    if (!s) return [];

    return users
      .filter((u) => u.uid !== user?.uid)
      .filter(
        (u) =>
          (u.email || "").toLowerCase().includes(s) ||
          (u.displayName || "").toLowerCase().includes(s)
      );
  }, [q, users, user]);


  const pick = async (other) => {
    setErr("");
    try {
      console.log("CLICK USER:", other);

      const me = {
        uid: user.uid,
        email: user.email,
        displayName: user.email?.split("@")[0] || "Me",
      };

      console.log("ENSURE CHAT…", { me, other });

      const chatId = await ensureChat(me, other);

      console.log("CHAT CREATED/FOUND:", chatId);

      if (typeof onPickChat === "function") {
        onPickChat(chatId);
      } else {
        console.warn("onPickChat is not a function:", onPickChat);
      }

      onClose();
    } catch (e) {
      console.error("pick/ensureChat error:", e);
      setErr(String(e?.message || e));
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={top}>
          <div style={{ fontWeight: 700 }}>Start chat</div>
          <button onClick={onClose} style={xBtn}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 12 }}>
          <input
            placeholder="Search by email/name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={search}
          />
          {err && (
            <div style={{ marginTop: 8, color: "crimson", fontSize: 12 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ maxHeight: 360, overflow: "auto" }}>
          {!q.trim() ? (
            <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>
              Type a name or email to search.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>
              No users found.
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.uid}
                onClick={() => pick(u)}
                style={userRow}
                type="button"
              >
                <div style={avatar} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.displayName}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                </div>
              </button>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 9999,
};

const modal = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

const top = {
  padding: 12,
  borderBottom: "1px solid #eee",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const xBtn = {
  border: "none",
  background: "transparent",
  width: 36,
  height: 36,
  borderRadius: 12,
  cursor: "pointer",
};

const search = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
};

const userRow = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: 12,
  display: "flex",
  alignItems: "center",
  gap: 12,
  textAlign: "left",
  cursor: "pointer",
};

const avatar = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "#e8e8e8",
};
