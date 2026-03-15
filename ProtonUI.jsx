import React, { useState, useEffect } from "react";

export default function ProtonUI() {
  const [screen, setScreen] = useState("loading");

  useEffect(() => {
    const timer = setTimeout(() => setScreen("login"), 600);
    return () => clearTimeout(timer);
  }, []);

  if (screen === "loading") return <Loader />;
  if (screen === "login") return <Login setScreen={setScreen} />;
  return <Dashboard />;
}

function Loader() {
  return (
    <div style={styles.loaderContainer}>
      <div style={styles.logo}>Proton UI</div>
      <div style={styles.spinner} />
    </div>
  );
}

function Login({ setScreen }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Hash password using SHA-256
  async function hashPassword(pw) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pw);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleLogin() {
    setLoading(true);
    setError("");
    try {
      const passwordHash = await hashPassword(password);
      const res = await fetch("https://asddsa-rog6.onrender.com/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          passwordHash,
          licenseKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setScreen("dashboard");
      } else {
        setError(data.message || "Authentication failed.");
      }
    } catch (err) {
      setError("Network error.");
    }
    setLoading(false);
  }

  return (
    <div style={styles.center}>
      <div style={styles.loginCard}>
        <h2 style={styles.title}>Welcome to Proton</h2>
        <p style={styles.subtitle}>Please enter your credentials to continue.</p>
        <input style={styles.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={styles.input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input style={styles.input} placeholder="License Key" value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} />
        <button style={styles.button} onClick={handleLogin} disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
        {error && <p style={{ color: "#ef4444", marginTop: "10px" }}>{error}</p>}
        <p style={styles.signup}>Don't have an account? <span style={{ color: "#3b82f6" }}>Sign Up</span></p>
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div style={styles.dashboard}>
      <Sidebar />
      <div style={styles.main}>
        <h1 style={styles.libraryTitle}>Proton Panel</h1>
        <p style={styles.subtitle}>Manage your license and access the Temp HWID Spoofer.</p>
        <Product name="Temp HWID Spoofer" date="Active" />
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <div style={styles.sidebar}>
      <div style={styles.sideLogo}>Proton</div>
      <div style={styles.version}>4.0</div>
      <div style={styles.sideButtons}><div>🔑</div><div>⚙️</div><div>🚪</div></div>
    </div>
  );
}

function Product({ name, date }) {
  return (
    <div style={styles.productCard}>
      <div>
        <div style={{ color: "white" }}>{name}</div>
        <div style={styles.productDate}>{date}</div>
      </div>
      <button style={styles.productButton}>Open</button>
    </div>
  );
}

const styles = {
  loaderContainer: { background: "#050b18", height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "white" },
  logo: { fontSize: "32px", marginBottom: "30px" },
  spinner: { width: "40px", height: "40px", border: "4px solid #1e3a8a", borderTop: "4px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" },
  center: { background: "#050b18", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" },
  loginCard: { width: "380px", background: "#0a1224", padding: "40px", borderRadius: "12px", textAlign: "center" },
  title: { color: "white", marginBottom: "8px" },
  subtitle: { color: "#94a3b8", marginBottom: "20px" },
  input: { width: "100%", padding: "12px", marginBottom: "12px", background: "#111b35", border: "none", borderRadius: "6px", color: "white" },
  button: { width: "100%", padding: "12px", background: "#2563eb", border: "none", borderRadius: "6px", color: "white", cursor: "pointer" },
  signup: { marginTop: "16px", color: "#94a3b8" },
  dashboard: { display: "flex", background: "#050b18", minHeight: "100vh", color: "white" },
  sidebar: { width: "80px", background: "#070f1f", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "20px" },
  sideLogo: { color: "#3b82f6", fontSize: "24px", marginBottom: "20px" },
  version: { background: "#2563eb", padding: "4px 8px", borderRadius: "6px", color: "white", marginBottom: "20px" },
  sideButtons: { display: "flex", flexDirection: "column", gap: "20px", color: "#94a3b8" },
  main: { flex: 1, padding: "40px" },
  libraryTitle: { color: "white", fontSize: "28px", marginBottom: "6px" },
  productCard: { background: "#0a1224", padding: "20px", borderRadius: "10px", marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  productDate: { color: "#94a3b8", fontSize: "12px" },
  productButton: { background: "#2563eb", border: "none", padding: "8px 16px", borderRadius: "6px", color: "white", cursor: "pointer" }
};
