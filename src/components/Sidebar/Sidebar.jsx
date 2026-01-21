import { Menu, Search, Plus, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import "./Sidebar.css";
import ChatRow from "./ChatRow";
import NewChatModal from "./NewChatModal";
import { useAuth } from "../../context/AuthContext";
import { listenMyChats } from "../../firebase/chatApi";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/firebase";

export default function Sidebar({ activeChatId, onSelectChat }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [openNew, setOpenNew] = useState(false);
  const [search, setSearch] = useState("");


  useEffect(() => {
    if (!user) return;
    const unsub = listenMyChats(user.uid, setChats);
    return () => unsub?.();
  }, [user]);

  const logout = async () => {
    await signOut(auth);
  };

  const filteredChats = chats.filter((c) => {
  const s = search.trim().toLowerCase();
  if (!s) return true;

  const idx = c.members?.[0] === user.uid ? 1 : 0;
  const title = (c.memberNames?.[idx] || "").toLowerCase();
  const last = (c.lastMessage || "").toLowerCase();

  return title.includes(s) || last.includes(s);
});


  return (
    <div className="sidebar">
      <div className="sidebarTop">
        <button className="iconBtn" title="Menu">
          <Menu size={18} />
        </button>

        <div className="searchPill">
          <Search size={16} className="searchIcon" />
          <input className="searchInput" placeholder="Search" value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

        </div>

        <button className="iconBtn" title="New chat" onClick={() => setOpenNew(true)}>
          <Plus size={18} />
        </button>

        <button className="iconBtn" title="Logout" onClick={logout}>
          <LogOut size={18} />
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

      {openNew && <NewChatModal onClose={() => setOpenNew(false)} onPickChat={onSelectChat} />}
    </div>
  );
}
