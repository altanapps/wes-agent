import { useEffect, useRef, useState } from "react";
import type { PublicSettings, WhisperModelState } from "../../shared/ipc.js";
import { CaptureTest } from "./CaptureTest.js";
import { CallsPane } from "./CallsPane.js";
import { TrendsPane } from "./TrendsPane.js";
import { Logo } from "./Logo.js";

type View = "chat" | "calls" | "trends" | "settings";

const NAV: { view: View; icon: string; label: string }[] = [
  { view: "chat", icon: "✎", label: "Coach" },
  { view: "calls", icon: "◉", label: "Calls" },
  { view: "trends", icon: "↗", label: "Trends" },
  { view: "settings", icon: "⚙", label: "Settings" },
];

export function App() {
  const [view, setView] = useState<View>("chat");
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    void window.wes.getSettings().then(setSettings);
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="traffic-space" />
        <div className="brand">
          <span className="mark">
            <Logo size={17} />
          </span>
          <span className="name">Wes</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${view === item.view ? "active" : ""}`}
              onClick={() => setView(item.view)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="foot">Local-first · transcripts never leave your Mac unreviewed</div>
      </aside>

      <main className="content">
        {view === "chat" ? (
          <ChatPane hasApiKey={settings?.hasApiKey ?? false} />
        ) : view === "calls" ? (
          <CallsPane />
        ) : view === "trends" ? (
          <TrendsPane />
        ) : (
          <SettingsPane settings={settings} onSaved={setSettings} />
        )}
      </main>
    </div>
  );
}

interface ChatMessage {
  role: "you" | "wes";
  text: string;
}

function ChatPane({ hasApiKey }: { hasApiKey: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "you", text }]);
    setBusy(true);
    try {
      const reply = await window.wes.chat("desktop", text);
      setMessages((m) => [...m, { role: "wes", text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "wes", text: `⚠️ ${(err as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="glyph">✎</div>
            <h2>{hasApiKey ? "Paste a draft, or prep a conversation" : "Add your API key to start"}</h2>
            <p>
              {hasApiKey
                ? "Wes diagnoses it against her frameworks and rewrites it in your voice — or coaches you through what you're about to say."
                : "Settings → Anthropic API key. It's stored in your Mac's keychain and never leaves the main process."}
            </p>
          </div>
        ) : (
          <div className="chat-thread">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <span className="who">{m.role === "you" ? "You" : "Wes"}</span>
                <p>{m.text}</p>
              </div>
            ))}
            {busy && <p className="thinking">Wes is thinking…</p>}
          </div>
        )}
      </div>
      <div className="composer-wrap">
        <div className="composer">
          <textarea
            rows={1}
            value={input}
            placeholder="Message Wes…  (Enter to send · /reset to clear)"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn" onClick={() => void send()} disabled={busy || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function TranscriptionSection() {
  const [models, setModels] = useState<WhisperModelState[]>([]);
  const [error, setError] = useState("");

  const refresh = () => void window.wes.modelsState().then(setModels);
  useEffect(() => {
    refresh();
    const off = window.wes.onModelProgress(({ id, pct }) => {
      setModels((ms) => ms.map((m) => (m.id === id ? { ...m, downloadingPct: pct } : m)));
    });
    return off;
  }, []);

  return (
    <div className="card">
      <div className="field">
        <label>Whisper model</label>
        <small>
          Transcription runs entirely on this Mac. Bigger models are more accurate and slower;
          Small is the sweet spot on Apple Silicon.
        </small>
      </div>
      {models.map((m) => (
        <div className="row" key={m.id}>
          <span style={{ minWidth: 200, fontSize: 13.5 }}>
            {m.label} <span className="status">({m.sizeMb} MB)</span>
          </span>
          {m.installed ? (
            <span className="status">Installed ✓</span>
          ) : m.downloadingPct != null ? (
            <span className="status">Downloading… {m.downloadingPct}%</span>
          ) : (
            <button
              className="btn secondary"
              onClick={() => {
                setError("");
                window.wes
                  .modelsDownload(m.id)
                  .then(refresh)
                  .catch((err) => {
                    setError((err as Error).message);
                    refresh();
                  });
              }}
            >
              Download
            </button>
          )}
        </div>
      ))}
      {error && <p className="status">⚠️ {error}</p>}
    </div>
  );
}

function SettingsPane({
  settings,
  onSaved,
}: {
  settings: PublicSettings | null;
  onSaved: (s: PublicSettings) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [granolaKey, setGranolaKey] = useState("");
  const [model, setModel] = useState(settings?.model ?? "");
  const [effort, setEffort] = useState(settings?.effort ?? "high");
  const [status, setStatus] = useState("");
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    if (settings) {
      setModel(settings.model);
      setEffort(settings.effort);
    }
  }, [settings]);

  async function save() {
    setStatus("Saving…");
    try {
      const next = await window.wes.setSettings({
        model,
        effort,
        ...(apiKey.trim() ? { apiKey } : {}),
        ...(granolaKey.trim() ? { granolaApiKey: granolaKey } : {}),
      });
      onSaved(next);
      setApiKey("");
      setGranolaKey("");
      setStatus("Saved ✓");
    } catch (err) {
      setStatus(`⚠️ ${(err as Error).message}`);
    }
  }

  return (
    <div className="panel">
      <div className="panel-scroll">
        <div className="panel-inner">
          <h1>Settings</h1>
          <p className="sub">Keys are encrypted with your Mac's keychain and never shown again.</p>

          <div className="section-label">Coach</div>
          <div className="card">
            <div className="field">
              <label>Anthropic API key</label>
              <input
                type="password"
                value={apiKey}
                placeholder={settings?.hasApiKey ? "•••••••• (saved — enter to replace)" : "sk-ant-…"}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="field">
              <label>Effort</label>
              <select value={effort} onChange={(e) => setEffort(e.target.value as typeof effort)}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="max">max</option>
              </select>
            </div>
            <div className="row">
              <button className="btn" onClick={() => void save()}>
                Save
              </button>
              <span className="status">{status}</span>
            </div>
          </div>

          <div className="section-label">Sources</div>
          <div className="card">
            <div className="field">
              <label>Granola API key</label>
              <input
                type="password"
                value={granolaKey}
                placeholder={settings?.hasGranolaKey ? "•••••••• (saved — enter to replace)" : "grn_…"}
                onChange={(e) => setGranolaKey(e.target.value)}
              />
              <small>
                If Granola records your meetings, Wes learns from how you speak in them — no
                extra recording. Granola → Settings → Connectors → API keys (Business plan).
                Save the key first, then import.
              </small>
            </div>
            <div className="row">
              <button
                className="btn secondary"
                disabled={!settings?.hasGranolaKey || importStatus === "Importing…"}
                onClick={() => {
                  setImportStatus("Importing…");
                  window.wes
                    .granolaImport()
                    .then((r) =>
                      setImportStatus(
                        r.added > 0
                          ? `Imported ${r.added} spoken turns ✓ — coaching profile refreshed`
                          : "Nothing new to import",
                      ),
                    )
                    .catch((err) => setImportStatus(`⚠️ ${(err as Error).message}`));
                }}
              >
                Import calls from Granola
              </button>
              <span className="status">{importStatus}</span>
            </div>
          </div>

          <div className="section-label">Meeting nudge</div>
          <div className="card">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings?.meetingNudge ?? true}
                onChange={(e) => {
                  void window.wes
                    .setSettings({ meetingNudge: e.target.checked })
                    .then(onSaved);
                }}
              />
              <span>
                Nudge me when a meeting with a video link is starting
                <small>
                  Watches your Mac's calendar (Google/anything it syncs), detects active Zoom
                  meetings, and notices sustained mic use (browser calls like Google Meet).
                  Always asks — never records on its own. macOS will request Calendar access
                  on first use.
                </small>
              </span>
            </label>
            <div className="row">
              <button className="btn secondary" onClick={() => void window.wes.nudgeTest()}>
                Send test nudge
              </button>
              <span className="status">
                You should see a notification and the menubar flash "◎ Wes — meeting?". If
                neither appears, allow Wes in System Settings → Notifications.
              </span>
            </div>
          </div>

          <div className="section-label">Transcription</div>
          <TranscriptionSection />

          <div className="section-label">Capture</div>
          <div className="card">
            <CaptureTest />
          </div>
        </div>
      </div>
    </div>
  );
}
