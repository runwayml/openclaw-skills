import { useState, useEffect } from "react";
import {
  AvatarCall,
  AvatarVideo,
  ControlBar,
  UserVideo,
  useAvatarSession,
} from "@runwayml/avatars-react";

interface Props {
  avatarId: string;
  sessionId: string;
  sessionKey: string;
  onEnd: (error?: string) => void;
}

function CallUI() {
  const { state } = useAvatarSession();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    console.log("[CallUI] session state:", state);
  }, [state]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="active-call">
      <div className="call-timer">
        <span className="status-dot" />
        {timeStr}
      </div>

      <div className="avatar-wrapper">
        <AvatarVideo
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <UserVideo
        style={{
          position: "fixed",
          bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
          right: "1rem",
          width: "120px",
          height: "90px",
          borderRadius: "12px",
          objectFit: "cover",
          border: "2px solid rgba(255,255,255,0.2)",
          zIndex: 10,
        }}
      />

      <div className="call-controls">
        <ControlBar showScreenShare={false} />
      </div>
    </div>
  );
}

export function ActiveCall({ avatarId, sessionId, sessionKey, onEnd }: Props) {
  console.log("[ActiveCall] mounting with sessionId:", sessionId);

  return (
    <AvatarCall
      avatarId={avatarId}
      sessionId={sessionId}
      sessionKey={sessionKey}
      audio
      video
      onEnd={() => {
        console.log("[ActiveCall] onEnd fired");
        onEnd();
      }}
      onError={(err) => {
        console.error("[ActiveCall] onError:", err);
        onEnd(`Connection error: ${err.message || String(err)}`);
      }}
    >
      <CallUI />
    </AvatarCall>
  );
}
