import { Menu, Search, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./Sidebar.css";
import ChatRow from "./ChatRow";
import NewChatModal from "./NewChatModal";
import { useAuth } from "../../context/AuthContext";
import { listenMyChats } from "../../firebase/chatApi";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import SettingsModal from "./SettingsModal";
import GroupChatModal from "./GroupChatModal";

export default function Sidebar({ activeChatId, onSelectChat }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [openNew, setOpenNew] = useState(false);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(false);

  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!user) return;
    const unsub = listenMyChats(user.uid, setChats);
    return () => unsub?.();
  }, [user]);

  const logout = async () => {
    await signOut(auth);
  };

  const filteredChats = chats.filter((c) => {
    // hide chats deleted for me
    if (c?.hiddenFor?.[user?.uid]) return false;

    const s = search.trim().toLowerCase();
    if (!s) return true;

    // ✅ support groups + DMs in sidebar search
    const title = (c.type === "group"
      ? (c.title || "Group")
      : (() => {
          const idx = c.members?.[0] === user?.uid ? 1 : 0;
          return c.memberNames?.[idx] || "Chat";
        })()
    ).toLowerCase();

    const last = (c.lastMessage || "").toLowerCase();

    return title.includes(s) || last.includes(s);
  });

  return (
    <div className="sidebar">
      <div className="sidebarTop">
        <div className="sidebarMenuWrap" ref={menuRef}>
          <button
            className="iconBtn"
            title="Menu"
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu size={18} />
          </button>

          {menuOpen && (
            <div className="sidebarMenuDropdown">
              <button
                className="sidebarMenuItem"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setSettingsOpen(true);
                }}
              >
                Settings
              </button>

              <button
                className="sidebarMenuItem"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  alert("Profile (optional)");
                }}
              >
                Profile
              </button>

              <button
                className="sidebarMenuItem"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setOpenGroup(true);
                }}
              >
                New group
              </button>

              <div className="sidebarMenuDivider" />

              <button
                className="sidebarMenuItem danger"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout?.();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="searchPill">
          <Search size={16} className="searchIcon" />
          <input
            className="searchInput"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="iconBtn"
          title="New chat"
          onClick={() => setOpenNew(true)}
          type="button"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="chatList">
        {filteredChats.map((c) => (
          <ChatRow
            key={c.id}
            chat={c}
            active={c.id === activeChatId}
            onClick={() => onSelectChat(c.id === activeChatId ? null : c.id)}
          />
        ))}

        {chats.length === 0 && (
          <div className="emptyHint">
            No chats yet. Click <b>+</b> to start.
          </div>
        )}
      </div>

      {openNew && (
        <NewChatModal
          onClose={() => setOpenNew(false)}
          onPickChat={onSelectChat}
        />
      )}

      {/* ✅ IMPORTANT: render group modal OUTSIDE the menu dropdown */}
      {openGroup && (
        <GroupChatModal
          onClose={() => setOpenGroup(false)}
          onPickChat={onSelectChat}
        />
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
