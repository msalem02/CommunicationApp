import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { Link, useNavigate } from "react-router-dom";
import "./Auth/AuthPage.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      nav("/app");
    } catch (e2) {
      setErr(e2.message);
    }
  };

  return (
    <div className="authPage">
      <form className="authCard" onSubmit={onSubmit}>
        <h1 className="authTitle">Login</h1>
        <p className="authSub">Welcome back. Sign in to continue.</p>

        <input
          className="authInput"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="authInput"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err ? <p style={{ color: "crimson", fontSize: 12 }}>{err}</p> : null}

        <button className="authBtn" type="submit">Sign in</button>

        <div className="authLinkRow">
          Don’t have an account? <Link to="/Register">Create one</Link>
        </div>
      </form>
    </div>
  );
}
