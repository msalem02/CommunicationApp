import { useEffect, useRef, useState } from "react";
import "./SettingsModal.css";
import { useAuth } from "../../context/AuthContext";
import {
  getUserDoc,
  updateMyNameEverywhere,
  updateMyPassword,
  updateMyPhone,
} from "../../firebase/chatApi";

export default function SettingsModal({ open, onClose }) {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(""); // always empty on open
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // prevents state update if modal closes while fetching
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Load ONCE when opening (no listener; no overwriting drafts)
  useEffect(() => {
    if (!open || !user?.uid) return;

    let cancelled = false;

    (async () => {
      setMsg("");
      setSaving(false);
      setLoading(true);

      //Only clear password on open (not name/phone)
      setPassword("");

      // Immediately show something (fallback) while loading:
      setName(user.displayName || "");
      setPhone(""); // phone is only from Firestore

      try {
        const data = await getUserDoc(user.uid);

        if (cancelled || !aliveRef.current) return;

        setProfile(data || null);

        // name: Firestore -> fallback Auth
        setName((data?.displayName ?? user.displayName ?? "").toString());

        // phone: ONLY Firestore phone
        setPhone(data?.phone ? String(data.phone) : "");
      } catch (e) {
        if (cancelled || !aliveRef.current) return;
        setMsg(e?.message || "Failed to load profile data.");
      } finally {
        if (!cancelled && aliveRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user?.uid, user?.displayName]);

  if (!open) return null;

  const handleClose = () => {
    setMsg("");
    setPassword("");
    onClose?.();
  };

  async function onSave() {
    setMsg("");

    const newName = name.trim();
    const newPhone = phone.trim();
    const newPass = password.trim();

    if (!newName) {
      setMsg("Name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const currentName = profile?.displayName || user?.displayName || "";
      if (newName !== currentName) {
        await updateMyNameEverywhere(newName);
      }

      await updateMyPhone(newPhone); // empty => null inside chatApi

      if (newPass) {
        if (newPass.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await updateMyPassword(newPass);
      }

      setMsg("Saved successfully.");
      setPassword("");

      // re-fetch once so profile state matches database
      const fresh = await getUserDoc(user.uid);
      setProfile(fresh || null);
      setName((fresh?.displayName ?? newName).toString());
      setPhone(fresh?.phone ? String(fresh.phone) : "");
    } catch (e) {
      const friendly =
        e?.code === "auth/requires-recent-login"
          ? "For security, log out and log in again, then change password."
          : e?.message || "Something went wrong.";
      setMsg(friendly);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="setOverlay" onClick={handleClose}>
      <div className="setCard" onClick={(e) => e.stopPropagation()}>
        <div className="setTop">
          <div className="setTitle">Settings</div>
          <button className="setClose" onClick={handleClose} type="button">
            ✕
          </button>
        </div>

        {/* Email */}
        <div className="setSection">
          <div className="setLabel">Email</div>
          <div className="setValue">{user?.email || "—"}</div>
        </div>

        {/* Name */}
        <div className="setSection">
          <label className="setLabel">Display name</label>
          <input
            className="setInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        {/* Phone */}
        <div className="setSection">
          <label className="setLabel">Phone number</label>
          <input
            className="setInput"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+970 59..."
            autoComplete="tel"
          />
          <div className="setHint">Leave empty if you don’t want to add it yet.</div>
        </div>

        {/* Anti-autofill */}
        <input
          type="text"
          name="fakeusernameremembered"
          style={{ display: "none" }}
          autoComplete="username"
        />
        <input
          type="password"
          name="fakepasswordremembered"
          style={{ display: "none" }}
          autoComplete="current-password"
        />

        {/* Password */}
        <div className="setSection">
          <label className="setLabel">New password</label>
          <input
            className="setInput"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty to keep current password"
            type="password"
            autoComplete="new-password"
            name="new-password"
          />
        </div>

        {(loading || msg) && (
          <div className="setMsg">
            {loading ? "Loading..." : msg}
          </div>
        )}

        <div className="setActions">
          <button className="setBtn ghost" onClick={handleClose} type="button">
            Cancel
          </button>
          <button className="setBtn" onClick={onSave} disabled={saving} type="button">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
