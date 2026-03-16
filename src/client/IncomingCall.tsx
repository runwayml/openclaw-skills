interface Props {
  onAnswer: () => void;
  onDecline: () => void;
  avatarImageUrl?: string | null;
  avatarName?: string | null;
}

const PhoneIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const HangUpIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none" style={{ transform: "rotate(135deg)" }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export function IncomingCall({ onAnswer, onDecline, avatarImageUrl, avatarName }: Props) {
  return (
    <div className="incoming-call">
      <div className="ring-animation">
        {avatarImageUrl ? (
          <img src={avatarImageUrl} alt="avatar" className="avatar-preview" />
        ) : (
          <PhoneIcon />
        )}
      </div>

      <div className="caller-info">
        <div className="caller-name">{avatarName || "Your Agent"} is calling...</div>
        <div className="caller-reason">
          Incoming video call from your OpenClaw agent
        </div>
      </div>

      <div className="call-actions">
        <div>
          <button className="btn-decline" onClick={onDecline} aria-label="Decline">
            <HangUpIcon />
          </button>
          <div className="btn-action-label">Decline</div>
        </div>
        <div>
          <button className="btn-answer" onClick={onAnswer} aria-label="Answer">
            <PhoneIcon />
          </button>
          <div className="btn-action-label">Answer</div>
        </div>
      </div>
    </div>
  );
}
