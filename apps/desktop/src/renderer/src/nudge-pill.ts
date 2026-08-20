/**
 * The nudge pill (Granola-style floating popup). Two states:
 *  idle      — "«Meeting» detected · [Record] [✕]"
 *  recording — "● Recording · 00:42 · [Stop] [✕]"
 * Clicking Record actually records; ✕ just hides the pill (a recording keeps
 * going — the tray still shows it).
 */
const params = new URLSearchParams(window.location.search);
const heading = params.get("heading") ?? "Meeting detected";
const recordTitle = params.get("title") ?? "Call";

const titleEl = document.getElementById("title")!;
const subEl = document.getElementById("sub")!;
const recordBtn = document.getElementById("record") as HTMLButtonElement;
const dismissBtn = document.getElementById("dismiss") as HTMLButtonElement;

titleEl.textContent = heading;
subEl.textContent = recordTitle;

let timer: ReturnType<typeof setInterval> | null = null;

function showRecording(startedAt: number | null): void {
  titleEl.innerHTML = `<span class="rec-dot"></span>Recording`;
  recordBtn.outerHTML = `<button class="stop" id="stop">Stop</button>`;
  document.getElementById("stop")!.addEventListener("click", () => {
    void window.wes.recordingStop();
  });
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (startedAt) {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      subEl.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")} — ${recordTitle}`;
    }
  }, 1000);
}

recordBtn.addEventListener("click", () => {
  recordBtn.disabled = true;
  void window.wes.recordingStart(recordTitle);
});

dismissBtn.addEventListener("click", () => {
  void window.wes.nudgeDismiss();
});

let everRecorded = false;

window.wes.onRecordingStatus((s) => {
  if (s.state === "recording") {
    everRecorded = true;
    showRecording(s.startedAt);
  } else if (s.state === "starting") {
    subEl.textContent = "Starting…";
  } else if (s.state === "idle") {
    if (s.error && !everRecorded) {
      // Start failed — say so in the pill instead of silently doing nothing.
      subEl.textContent = `⚠️ ${s.error}`;
      const btn = document.getElementById("record") as HTMLButtonElement | null;
      if (btn) btn.disabled = false;
      return;
    }
    // Recording finished — the pill's job is done.
    if (timer) clearInterval(timer);
    void window.wes.nudgeDismiss();
  }
});
