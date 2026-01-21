// src/app/AppShell.jsx
import { useEffect, useState } from "react";
import "./AppShell.css";
import Sidebar from "../components/Sidebar/Sidebar";
import ChatPanel from "../components/Chat/ChatPanel";

export default function AppShell() {
  const [activeChatId, setActiveChatId] = useState(null);

  return (
    <div className="page">
      <div className="appGrid">
        <div className={`leftPane ${activeChatId ? "hideMobile" : ""}`}>
          <Sidebar
            activeChatId={activeChatId}
            onSelectChat={(id) => setActiveChatId(id)}
          />
        </div>

        <div className="rightPane">
          <ChatPanel chatId={activeChatId} onBack={() => setActiveChatId(null)} />
        </div>
      </div>
    </div>
  );
}
