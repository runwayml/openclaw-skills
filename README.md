# video-call-ai-character

An [OpenClaw](https://openclaw.com) skill that lets your AI agent **call you** with a real-time video avatar powered by [Runway](https://dev.runwayml.com).

Your agent initiates the call, the avatar speaks first with context, and after the call ends the full transcript is fed back to the agent so it can take action.

## What it looks like

1. Your agent decides something needs a call (CI broke, morning standup, needs a decision)
2. It creates a call and sends you a link via WhatsApp, Slack, or any chat
3. You open the link and see an incoming call screen with the avatar's face
4. You answer — the avatar greets you with context and you have a real conversation
5. Call ends, the agent gets the transcript and follows up

## Use cases

- **Urgent alerts** — CI failures, server down, security incidents
- **Daily standups** — Morning check-in with overnight summary
- **Decision points** — When the agent needs your input before proceeding
- **Complex explanations** — Walking through an error or architecture decision
- **Status updates** — End-of-day recap, weekly summary

## Install as an OpenClaw skill

```bash
openclaw skill install github:runwayml/openclaw-skills/video-call-ai-character
```

## Requirements

- Node.js 18+
- A [Runway API key](https://dev.runwayml.com)
- (Optional) [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for remote access from phone

## Quick start (standalone)

```bash
# Set your Runway API key
export RUNWAYML_API_SECRET=your_key

# Run the server
npx openclaw-video-call
```

The server starts on `http://localhost:7891` and auto-creates a Cloudflare tunnel for remote access.

## Development

```bash
git clone https://github.com/runwayml/openclaw-skills.git
cd openclaw-skills/video-call-ai-character
npm install
export RUNWAYML_API_SECRET=your_key
npm run dev
```

## How it works

```
Agent                    Server (this skill)              User
  │                            │                            │
  ├─ POST /create-avatar ─────►│                            │
  │◄── { id: uuid } ──────────┤                            │
  │                            │                            │
  ├─ POST /create-call ───────►│                            │
  │◄── { urls: { tunnel } } ──┤                            │
  │                            │                            │
  ├─ "Hey, join this call" ────┼───────────────────────────►│
  │                            │                            │
  │                            │◄── User clicks Answer ────┤
  │                            │── Runway WebRTC session ──►│
  │                            │        (live video call)   │
  │                            │◄── Call ends ─────────────┤
  │                            │                            │
  ├─ GET /transcript ─────────►│                            │
  │◄── { transcript: [...] } ─┤                            │
  │                            │                            │
  ├─ (takes action based on transcript)                     │
```

## Tech stack

- **Server**: Node.js, Express, [Runway API](https://docs.dev.runwayml.com/api/)
- **Client**: React, [Runway Avatars React SDK](https://github.com/runwayml/avatars-sdk-react)
- **Video**: WebRTC via LiveKit (handled by Runway)
- **Tunneling**: Cloudflare Quick Tunnels (for phone access)

## License

MIT
