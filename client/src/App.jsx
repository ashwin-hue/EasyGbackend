import { useState } from "react"
import Login from "./pages/Login.jsx"
import Diagnosis from "./pages/Diagnosis.jsx"
import "./index.css"

function App() {
  const [user, setUser] = useState(null)

  return (
    <div className="app-shell">
      <header className="app-header glass-card">
        <div className="brand">
          <span className="brand-dot" />
          <span>CardioSense</span>
        </div>
        <nav className="nav-tabs" aria-label="Primary">
          <button className="tab active" type="button">Dashboard</button>
          <button className="tab" type="button">Devices</button>
          <button className="tab" type="button">Reports</button>
        </nav>
        {user ? (
          <div className="session-chip">
            <span>{user.username}</span>
            <button className="ghost" onClick={() => setUser(null)}>
              Log out
            </button>
          </div>
        ) : null}
      </header>

      <main>{user ? <Diagnosis user={user} /> : <Login onAuth={setUser} />}</main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="brand">
            <span className="brand-dot" />
            <span>CardioSense</span>
          </div>
          <div>
            <p className="tiny">Continuous ECG insights powered by EASYG.</p>
            <p className="tiny">Secure, simulated stream for demo purposes.</p>
          </div>
          <div className="footer-badges">
            <span className="pill pill-green">Live demo</span>
            <span className="pill pill-amber">Beta</span>
            <span className="pill pill-blue">HIPAA-lite</span>
          </div>
        </div>
        <div className="footer-links">
          <div>
            <p className="tiny">Need help? support@cardiosense.ai</p>
            <p className="tiny">Status: All systems nominal</p>
          </div>
          <div className="palette-row" aria-label="Theme palette">
            <span className="swatch swatch-amber" title="Sunset amber" />
            <span className="swatch swatch-ink" title="Deep ink" />
            <span className="swatch swatch-green" title="Pulse green" />
            <span className="swatch swatch-cream" title="Sandstone" />
          </div>
          <div className="footer-meta">
            <p className="tiny">© {new Date().getFullYear()} CardioSense Labs</p>
            <p className="tiny">Designed for calm, clinical clarity.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
