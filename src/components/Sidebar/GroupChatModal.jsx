import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { fetchAllUsers, createGroupChat } from "../../firebase/chatApi";
import { useAuth } from "../../context/AuthContext";
import { createPortal } from "react-dom";


export default function GroupChatModal({ onClose, onPickChat }) {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState({}); // uid -> user
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

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
  }, [q, users, user?.uid]);

  const toggle = (u) => {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[u.uid]) delete next[u.uid];
      else next[u.uid] = u;
      return next;
    });
  };

  const selectedList = Object.values(selected);

  const create = async () => {
    setErr("");
    try {
      setCreating(true);

      const me = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Me",
      };

      const chatId = await createGroupChat({
        title,
        creator: me,
        members: selectedList,
      });

      onPickChat?.(chatId);
      onClose?.();
    } catch (e) {
      console.error("createGroupChat error:", e);
      setErr(String(e?.message || e));
    } finally {
      setCreating(false);
    }
  };

  return createPortal(
    <div style={overlay} onClick={onClose}>
        <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={top}>
            <div style={{ fontWeight: 800 }}>New group</div>
            <button onClick={onClose} style={xBtn} type="button">
            <X size={18} />
            </button>
        </div>

        <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
            <input
            placeholder="Group name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={input}
            />

            <input
            placeholder="Search by email/name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ ...input, marginTop: 10 }}
            />

            {!!selectedList.length && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                Selected: {selectedList.map((u) => u.displayName || u.email).join(", ")}
            </div>
            )}

            {err && (
            <div style={{ marginTop: 8, color: "crimson", fontSize: 12 }}>{err}</div>
            )}
        </div>

        <div style={{ maxHeight: 320, overflow: "auto" }}>
            {!q.trim() ? (
            <div style={hint}>Type a name or email to search.</div>
            ) : filtered.length === 0 ? (
            <div style={hint}>No users found.</div>
            ) : (
            filtered.map((u) => {
                const active = !!selected[u.uid];
                return (
                <button
                    key={u.uid}
                    type="button"
                    onClick={() => toggle(u)}
                    style={{
                    ...userRow,
                    background: active ? "rgba(0,0,0,0.04)" : "transparent",
                    }}
                >
                    <div style={avatar} />
                    <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{u.displayName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                    </div>
                    <div style={{ fontSize: 12, opacity: active ? 1 : 0.3 }}>
                    {active ? "✓" : "○"}
                    </div>
                </button>
                );
            })
            )}
        </div>

        <div style={actions}>
            <button style={btnGhost} type="button" onClick={onClose}>
            Cancel
            </button>
            <button style={btn} type="button" onClick={create} disabled={creating}>
            {creating ? "Creating..." : "Create"}
            </button>
        </div>
        </div>
    </div>,
    document.body
    );

}

const overlay = {
  position: "fixed",
  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.45)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 999999,
};


const modal = {
  width: "100%",
  maxWidth: 460,
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

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
};

const hint = { padding: 14, fontSize: 13, color: "var(--muted)" };

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

const actions = {
  padding: 12,
  borderTop: "1px solid #eee",
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "transparent",
  cursor: "pointer",
};

const btn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "#011627",
  color: "#fff",
  cursor: "pointer",
};
