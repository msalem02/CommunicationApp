import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { createUserDoc } from "../firebase/chatApi";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const [toast, setToast] = useState(""); 
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setToast("");
    setLoading(true);

    try {
      const cleanEmail = email.trim();
      const name = (displayName.trim() || cleanEmail.split("@")[0] || "User").trim();

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      await updateProfile(cred.user, { displayName: name });

      await createUserDoc({
        uid: cred.user.uid,
        email: cleanEmail,
        displayName: name,
      });
      await signOut(auth);

      setToast("Sign up successful. Please log in.");

      setTimeout(() => {
        nav("/login", { replace: true, state: { toast: "Sign up successful. Please log in." } });
      }, 1100);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={page}>
      {toast && (
        <div className="tgToast" role="status" aria-live="polite">
          <span className="tgToastIcon">✓</span>
          <span className="tgToastText">{toast}</span>
        </div>
      )}

      <form onSubmit={onSubmit} style={card}>
        <h1 style={{ marginTop: 0 }}>Register</h1>

        <input
          style={input}
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          style={input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={input}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && <div style={{ color: "crimson", fontSize: 12 }}>{err}</div>}

        <button style={btn} disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>

        <div style={{ marginTop: 10, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          <span>Have an account?</span>
          <Link to="/login" style={{ fontWeight: 700 }}>Login</Link>
        </div>
      </form>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#f5f5f5",
};

const card = {
  width: "100%",
  maxWidth: 360,
  background: "#fff",
  padding: 24,
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  position: "relative",
};

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  margin: "8px 0",
};

const btn = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "#011627",
  color: "#fff",
  marginTop: 8,
  cursor: "pointer",
  opacity: 1,
};
