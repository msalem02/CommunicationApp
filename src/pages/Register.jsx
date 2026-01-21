import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { createUserDoc } from "../firebase/chatApi";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await createUserDoc({
        uid: cred.user.uid,
        email,
        displayName: displayName || email.split("@")[0],
      });
      nav("/app");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div style={page}>
      <form onSubmit={onSubmit} style={card}>
        <h1 style={{ marginTop: 0 }}>Register</h1>

        <input style={input} placeholder="Display name" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} />
        <input style={input} placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input style={input} placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />

        {err && <div style={{ color: "crimson", fontSize: 12 }}>{err}</div>}

        <button style={btn}>Create account</button>

        <div style={{ marginTop: 10, fontSize: 13 }}>
          Have an account? <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}

const page = { minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"#f5f5f5" };
const card = { width:"100%", maxWidth:360, background:"#fff", padding:24, borderRadius:18, boxShadow:"0 10px 30px rgba(0,0,0,0.08)" };
const input = { width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid #ddd", margin:"8px 0" };
const btn = { width:"100%", padding:"10px 12px", borderRadius:12, border:"none", background:"#011627", color:"#fff", marginTop:8 };
