import { useEffect, useState, useCallback, useRef } from "react";
import { IncomingCall } from "./IncomingCall";
import { ActiveCall } from "./ActiveCall";

type Screen = "waiting" | "ringing" | "connecting" | "active" | "ended";

interface SessionInfo {
  sessionId: string;
  sessionKey: string;
  avatarId: string;
}

export function App() {
  const [screen, setScreen] = useState<Screen>("waiting");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState<string | null>(null);
  const ringtoneRef = useRef<{ close: () => void } | null>(null);

  const callIdFromUrl = window.location.pathname.match(
    /\/call\/([a-f0-9-]+)/
  )?.[1];

  // Poll until the call exists and is ringing
  const pollForCall = useCallback(async (id: string) => {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`/api/call-status/${id}`);
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 1_500));
          continue;
        }
        const data = await res.json();

        if (data.status === "ringing") {
          setCallId(id);
          if (data.avatarImageUrl) setAvatarImageUrl(data.avatarImageUrl);
          if (data.avatarName) setAvatarName(data.avatarName);
          setScreen("ringing");
          playRingtone(ringtoneRef);
          return;
        }
        if (data.status === "ended") {
          setScreen("ended");
          return;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }
    setScreen("ended");
  }, []);

  useEffect(() => {
    if (callIdFromUrl) {
      pollForCall(callIdFromUrl);
    }
  }, [callIdFromUrl, pollForCall]);

  // User clicks "Answer" → server creates Runway session → returns credentials
  const handleAnswer = useCallback(async () => {
    if (!callId) return;
    stopRingtone(ringtoneRef);
    playAcceptSound();
    setScreen("connecting");

    try {
      const res = await fetch(`/api/answer/${callId}`, { method: "POST" });
      const data = await res.json();

      if (data.sessionId && data.sessionKey) {
        setSessionInfo({ sessionId: data.sessionId, sessionKey: data.sessionKey, avatarId: data.avatarId });
        setScreen("active");
      } else {
        const msg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        console.error("Answer failed:", msg);
        setErrorMsg(msg);
        setScreen("ended");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setScreen("ended");
    }
  }, [callId]);

  const handleDecline = useCallback(async () => {
    stopRingtone(ringtoneRef);
    playDeclineSound();
    if (callId) {
      await fetch(`/api/hangup/${callId}`, { method: "POST" }).catch(() => {});
    }
    setScreen("ended");
  }, [callId]);

  const handleEnd = useCallback(async (error?: string) => {
    if (error) setErrorMsg(error);
    if (callId) {
      await fetch(`/api/hangup/${callId}`, { method: "POST" }).catch(() => {});
    }
    setScreen("ended");
  }, [callId]);

  if (screen === "waiting") {
    return (
      <div className="waiting">
        <div className="logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <h2>OpenClaw Video Call</h2>
        <p>Waiting for your agent to call...</p>
      </div>
    );
  }

  if (screen === "ringing") {
    return (
      <IncomingCall
        onAnswer={handleAnswer}
        onDecline={handleDecline}
        avatarImageUrl={avatarImageUrl}
        avatarName={avatarName}
      />
    );
  }

  if (screen === "connecting") {
    return (
      <div className="connecting">
        <div className="spinner" />
        <p>Connecting to your agent...</p>
      </div>
    );
  }

  if (screen === "active" && sessionInfo) {
    return (
      <ActiveCall
        avatarId={sessionInfo.avatarId}
        sessionId={sessionInfo.sessionId}
        sessionKey={sessionInfo.sessionKey}
        onEnd={handleEnd}
      />
    );
  }

  return (
    <div className="call-ended">
      <div className="icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <h2>Call ended</h2>
      {errorMsg ? (
        <p style={{ color: "#ef4444", maxWidth: "500px", wordBreak: "break-word" }}>
          Error: {errorMsg}
        </p>
      ) : (
        <p>Your agent has the transcript and will follow up.</p>
      )}
    </div>
  );
}

function playRingtone(ref: React.MutableRefObject<{ close: () => void } | null>) {
  stopRingtone(ref);
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);

    let stopped = false;
    const activeOscillators: OscillatorNode[] = [];

    function ringBurst() {
      if (stopped) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const burstGain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.value = 440;
      osc2.type = "sine";
      osc2.frequency.value = 480;

      osc1.connect(burstGain);
      osc2.connect(burstGain);
      burstGain.connect(master);

      const now = ctx.currentTime;
      burstGain.gain.setValueAtTime(0, now);
      burstGain.gain.linearRampToValueAtTime(1, now + 0.02);
      burstGain.gain.setValueAtTime(1, now + 0.8);
      burstGain.gain.linearRampToValueAtTime(0, now + 0.82);
      burstGain.gain.setValueAtTime(0, now + 1.2);
      burstGain.gain.linearRampToValueAtTime(1, now + 1.22);
      burstGain.gain.setValueAtTime(1, now + 2.0);
      burstGain.gain.linearRampToValueAtTime(0, now + 2.02);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.1);
      osc2.stop(now + 2.1);

      activeOscillators.push(osc1, osc2);
      const cleanup = () => {
        const i1 = activeOscillators.indexOf(osc1);
        if (i1 >= 0) activeOscillators.splice(i1, 1);
        const i2 = activeOscillators.indexOf(osc2);
        if (i2 >= 0) activeOscillators.splice(i2, 1);
      };
      osc1.onended = cleanup;
    }

    ringBurst();
    const interval = setInterval(() => ringBurst(), 4000);

    ref.current = {
      close: () => {
        stopped = true;
        clearInterval(interval);
        for (const osc of activeOscillators) {
          try { osc.stop(); } catch { /* already stopped */ }
        }
        activeOscillators.length = 0;
        master.disconnect();
        ctx.close();
      },
    };
  } catch {
    // audio not available
  }
}

function stopRingtone(ref: React.MutableRefObject<{ close: () => void } | null>) {
  if (ref.current) {
    ref.current.close();
    ref.current = null;
  }
}

function playAcceptSound() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    gain.connect(ctx.destination);

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const noteGain = ctx.createGain();
      osc.connect(noteGain);
      noteGain.connect(gain);

      const start = ctx.currentTime + i * 0.1;
      noteGain.gain.setValueAtTime(0, start);
      noteGain.gain.linearRampToValueAtTime(1, start + 0.02);
      noteGain.gain.linearRampToValueAtTime(0, start + 0.15);

      osc.start(start);
      osc.stop(start + 0.2);
    });

    setTimeout(() => ctx.close(), 600);
  } catch {
    // audio not available
  }
}

function playDeclineSound() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(ctx.destination);

    const notes = [440, 349.23];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const noteGain = ctx.createGain();
      osc.connect(noteGain);
      noteGain.connect(gain);

      const start = ctx.currentTime + i * 0.15;
      noteGain.gain.setValueAtTime(0, start);
      noteGain.gain.linearRampToValueAtTime(1, start + 0.02);
      noteGain.gain.linearRampToValueAtTime(0, start + 0.2);

      osc.start(start);
      osc.stop(start + 0.25);
    });

    setTimeout(() => ctx.close(), 600);
  } catch {
    // audio not available
  }
}
