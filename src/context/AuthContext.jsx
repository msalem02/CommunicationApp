// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { setUserPresence } from "../firebase/chatApi";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const tickRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setLoading(false);

      // cleanup old timer
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }

      if (!u) return;

      // mark online immediately
      setUserPresence(u.uid, true).catch(() => {});

      // refresh lastSeen every 25s while active
      tickRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          setUserPresence(u.uid, true).catch(() => {});
        }
      }, 25000);

      // visibility change => online/offline
      const onVis = () => {
        const visible = document.visibilityState === "visible";
        setUserPresence(u.uid, visible).catch(() => {});
      };
      document.addEventListener("visibilitychange", onVis);

      // best-effort when closing tab / reload
      const onBeforeUnload = () => {
        setUserPresence(u.uid, false).catch(() => {});
      };
      window.addEventListener("beforeunload", onBeforeUnload);

      // cleanup for this user session
      return () => {
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("beforeunload", onBeforeUnload);
      };
    });

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      unsub();
    };
  }, []);

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}
