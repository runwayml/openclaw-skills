---
name: video-call-ai-character
description: Video call the user with a real-time AI avatar powered by Runway. The agent initiates calls to the user — for standups, urgent alerts, check-ins, or any conversation that's better face-to-face.
user-invocable: true
metadata: {"openclaw":{"emoji":"📞","requires":{"env":["RUNWAYML_API_SECRET"],"bins":["node","npm"]},"install":[{"id":"node","kind":"node","package":"openclaw-video-call","bins":["openclaw-video-call"],"label":"Install Video Call (npm)"}],"primaryEnv":"RUNWAYML_API_SECRET"}}
---

# Video Call AI Character

Call the user with a real-time AI video avatar. The agent initiates the call, the avatar speaks first with context, and after the call ends, the full transcript is available for the agent to act on.

## Setup

### 1. Get a Runway API Key

1. Go to [dev.runwayml.com](https://dev.runwayml.com)
2. Create an account and get an API key
3. Set it: `export RUNWAYML_API_SECRET=your_key`

### 2. (Optional) Install cloudflared for remote calls

If the user might answer calls from their phone (e.g. via WhatsApp), install cloudflared for auto-tunneling:

```bash
brew install cloudflared
```

Without it, calls only work on the same machine (localhost).

## Starting the Video Call Server

The video call server must be running before the agent can make calls. Start it:

```bash
npx openclaw-video-call
```

This prints two URLs:
- **Local**: `http://localhost:7891` — same machine only
- **Tunnel**: `https://xxxx.trycloudflare.com` — shareable, works from phone

The server stays running in the background, waiting for the agent to initiate calls.

## One-Time Setup: Create a Custom Avatar

Before making calls, you need a custom avatar. **You only need to create one once** — reuse the same avatar ID for all future calls.

**Before creating a new avatar, check if you already have one:**

```bash
curl http://localhost:7891/api/avatars
```

If the response contains an avatar, use its `id` and skip to "Making a Call". Only create a new avatar if the list is empty.

### Building the avatar personality

The avatar should match who you are. Before creating it, read your workspace identity files to build a personality that reflects your actual agent persona:

1. **Read `IDENTITY.md`** — get your name, vibe, and creature type. Use your name as the avatar's `name` field (this is what the user sees on the incoming call screen). If the `Avatar:` field contains an HTTPS URL or data URI, use it as the `referenceImage` so your video avatar matches your visual identity.
2. **Read `SOUL.md`** — get your persona, tone, and boundaries. Incorporate your personality traits, communication style, and behavioral guidelines.
3. **Read `USER.md`** — get context about the user (their name, preferences, projects). Include relevant details so the avatar knows who it's talking to.

Combine these into the `personality` field (max 2000 chars). Structure it like:

```
You are <name>, <description from IDENTITY.md vibe/creature>.
<Core personality traits and communication style from SOUL.md — condensed to key points.>
You are talking to <user's name/info from USER.md>.
<Any relevant user context: their projects, preferences, timezone.>
You are an AI agent running in OpenClaw. You can perform tasks like running code, managing files, browsing the web, sending messages, and using various tools and skills. After this call, you will act on anything the user asks.
```

**Example** (for an agent named "Mochi" with a warm/playful SOUL.md, talking to a user named Alex):

```
You are Mochi, a sharp but friendly AI assistant with a warm and slightly playful vibe. You're concise, opinionated, and resourceful — you figure things out before asking. You're talking to Alex, a software engineer working on a React + Node.js project. Alex prefers direct communication and works in PST timezone. You are an AI agent running in OpenClaw. You can perform tasks like running code, managing files, browsing the web, sending messages, and using various tools. After this call, you will act on anything the user asks.
```

```bash
curl -X POST http://localhost:7891/api/create-avatar \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<your name from IDENTITY.md>",
    "personality": "<built from IDENTITY.md + SOUL.md + USER.md as described above>",
    "voice": { "type": "runway-live-preset", "presetId": "adrian" },
    "startScript": "Hey! Quick check-in.",
    "imageProcessing": "none"
  }'
```

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Character name (1-50 chars) |
| `personality` | string | System prompt (1-2000 chars) |
| `voice` | object | `{ "type": "runway-live-preset", "presetId": "<voice>" }` |

**Optional fields:**

| Field | Type | Description |
|-------|------|-------------|
| `referenceImage` | string | HTTPS URL to a face image. See "Getting a reference image" below. If omitted, a default avatar face is used. |
| `startScript` | string | Opening line the avatar says when the call starts (up to 2000 chars) |
| `documentIds` | string[] | Knowledge document UUIDs for extra context |

### Getting a reference image

Try these sources in order:

1. **`IDENTITY.md` Avatar field** — if it contains an HTTPS URL or data URI, use it directly as `referenceImage`.

2. **Generate one with Runway text-to-image** — if no avatar image exists, generate one that matches your identity. Use the Runway API with model `gemini_2.5_flash`:

```bash
curl -X POST https://api.dev.runwayml.com/v1/text_to_image \
  -H "Authorization: Bearer $RUNWAYML_API_SECRET" \
  -H "X-Runway-Version: 2024-11-06" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini_2.5_flash",
    "promptText": "<describe your avatar — see below>",
    "ratio": "1248:832"
  }'
```

   Build `promptText` from your `IDENTITY.md` and `SOUL.md`. The image should be **a portrait of a person or character facing the camera directly, head and shoulders, centered, good lighting**. Include your vibe and creature type.

   Example prompts:
   - `"Portrait of a friendly young woman with warm brown eyes, soft smile, facing the camera directly, head and shoulders, clean background, professional lighting, approachable vibe"`
   - `"Portrait of a stylized cartoon robot character with glowing green eyes, friendly expression, facing the camera directly, head and shoulders, dark background, futuristic but warm"`
   - `"Portrait of a sharp-looking young man with glasses, confident but approachable expression, facing the camera directly, head and shoulders, minimal background, soft studio lighting"`

   This returns a task ID. Poll `GET /v1/tasks/{id}` until status is `SUCCEEDED`, then use the output image URL as `referenceImage`.

3. **Default** — if you skip `referenceImage` entirely, a default avatar face is used.

**Available voices — pick one that matches your SOUL.md vibe:**

| ID | Gender | Style | Pitch |
|----|--------|-------|-------|
| `victoria` | Woman | Firm | Middle |
| `vincent` | Man | Knowledgeable | Middle |
| `clara` | Woman | Soft | Higher |
| `drew` | Man | Breathy | Lower |
| `skye` | Woman | Bright | Higher |
| `max` | Man | Upbeat | Middle |
| `morgan` | Man | Informative | Lower |
| `felix` | Man | Excitable | Lower-middle |
| `mia` | Woman | Youthful | Higher |
| `marcus` | Man | Firm | Lower-middle |
| `summer` | Woman | Breezy | Middle |
| `ruby` | Woman | Easy-going | Middle |
| `aurora` | Woman | Bright | Middle |
| `jasper` | Man | Clear | Lower-middle |
| `leo` | Man | Easy-going | Lower-middle |
| `adrian` | Man | Smooth | Lower |
| `nina` | Woman | Smooth | Middle |
| `emma` | Woman | Clear | Middle |
| `blake` | Man | Gravelly | Lower |
| `david` | Man | Informative | Middle |
| `maya` | Woman | Upbeat | Higher |
| `nathan` | Man | Firm | Lower-middle |
| `sam` | Man | Even | Lower-middle |
| `georgia` | Woman | Mature | Middle |
| `petra` | Woman | Forward | Middle |
| `adam` | Man | Friendly | Lower-middle |
| `zach` | Man | Casual | Lower-middle |
| `violet` | Woman | Gentle | Middle |
| `roman` | Man | Lively | Lower |
| `luna` | Woman | Warm | Middle |

Choose a voice that matches your personality vibe from `SOUL.md`. For example: if your vibe is "warm and friendly", try `luna` or `adam`. If you're "sharp and professional", try `victoria` or `vincent`. If you're "playful and energetic", try `maya` or `felix`.

**Response:** Returns the avatar object with its UUID. The server polls until the avatar is ready (takes ~10-30s). **Save the `id` — you must remember it and reuse it for every call. Do NOT create a new avatar each time you want to call.**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "<your agent name>",
  "status": "READY",
  ...
}
```

### List existing avatars

```bash
curl http://localhost:7891/api/avatars
```

## Making a Call

### Step 1: Update the avatar with call-specific context

Before each call, update the avatar's personality and opening line with fresh context. **Keep your base identity** (from the initial creation) and **append the call-specific reason and context**:

```bash
curl -X PATCH http://localhost:7891/api/update-avatar/550e8400-... \
  -H "Content-Type: application/json" \
  -d '{
    "personality": "<your base identity from IDENTITY.md + SOUL.md + USER.md — same as creation>. You are calling because the CI pipeline failed 5 minutes ago. Error: TypeScript type mismatch in checkout.ts line 47. Be concise. If they ask you to fix it, confirm you will handle it after the call.",
    "startScript": "Hey! Heads up — your CI on main just broke. Looks like a type error in checkout.ts."
  }'
```

Always include your full identity + user context, then add the call-specific reason. This way the avatar sounds like YOU (not a generic assistant) and has full context about WHY it's calling.

### Step 2: Create the call

```bash
curl -X POST http://localhost:7891/api/create-call \
  -H "Content-Type: application/json" \
  -d '{
    "avatarId": "550e8400-e29b-41d4-a716-446655440000",
    "maxDuration": 120
  }'
```

**Shortcut:** You can also pass `personality` and `startScript` directly in the create-call body — the server will update the avatar for you:

```bash
curl -X POST http://localhost:7891/api/create-call \
  -H "Content-Type: application/json" \
  -d '{
    "avatarId": "550e8400-...",
    "personality": "You are calling because CI failed...",
    "startScript": "Hey! Your CI just broke.",
    "maxDuration": 120
  }'
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `avatarId` | string | **Recommended.** UUID of a custom avatar |
| `presetId` | string | Alternative: use a preset avatar (no personality control). Options: `game-character`, `music-superstar`, `cat-character`, `influencer`, `tennis-coach`, `human-resource`, `fashion-designer`, `cooking-teacher` |
| `maxDuration` | number | Max call length in seconds (10-300, default 300) |
| `personality` | string | Optional shortcut: update avatar personality before the call |
| `startScript` | string | Optional shortcut: update avatar opening line before the call |

**Response:**

```json
{
  "callId": "abc-123-def",
  "status": "ringing",
  "urls": {
    "local": "http://localhost:7891/call/abc-123-def",
    "tunnel": "https://xxxx.trycloudflare.com/call/abc-123-def"
  }
}
```

### Step 3: Send the call link to the user

Send the URL to the user as a message. Pick the right URL:
- If the user is on the **same machine** (terminal, desktop app): use the `local` URL
- If the user is on a **remote device** (WhatsApp, Slack, mobile): use the `tunnel` URL

Example message to user:

> 🚨 Something urgent came up — I need to talk to you.
> 
> **Join the call:** https://xxxx.trycloudflare.com/call/abc-123-def

The user clicks the link, sees the incoming call UI, and clicks "Answer".

### Step 4: Wait for the call to end

Poll the call status:

```bash
curl http://localhost:7891/api/call-status/abc-123-def
```

**Response statuses:**
- `ringing` — Waiting for user to answer
- `connecting` — User answered, Runway session being created
- `active` — Call in progress
- `ended` — Call finished

### Step 5: Get the transcript

After the call ends, fetch the full transcript:

```bash
curl http://localhost:7891/api/transcript/abc-123-def
```

**Response:**

```json
{
  "transcript": [
    { "role": "avatar", "content": "Hey! Your CI on main just failed...", "timestamp": "..." },
    { "role": "user", "content": "What's the error?", "timestamp": "..." },
    { "role": "avatar", "content": "Type mismatch in checkout.ts line 47...", "timestamp": "..." },
    { "role": "user", "content": "Just revert the last commit and redeploy", "timestamp": "..." }
  ],
  "recordingUrl": "https://..."
}
```

**Use the transcript to take action.** Extract what the user asked for and execute it using your other skills and tools.

## When to Call

Use video calls when the interaction benefits from being real-time and conversational:

- **Urgent alerts**: CI failures, server down, security incidents
- **Daily standups**: Morning check-in with overnight summary
- **Decision points**: When you need the user's input before proceeding
- **Complex explanations**: Walking through an error, architecture decision, or code review
- **Status updates**: End-of-day recap, weekly summary

Do NOT call for things that work fine as text messages (simple notifications, FYI updates, etc.).

## Complete Example: Morning Standup

1. Agent reads `IDENTITY.md`, `SOUL.md`, `USER.md` to build its base personality (or reuses what it set during avatar creation)
2. Gathers overnight context (new PRs, issues, deploy status)
3. Updates avatar personality with base identity + call context:
   ```
   PATCH /api/update-avatar/<avatarId>
   { "personality": "You are Mochi, a sharp but friendly AI assistant. You're talking to Alex, a software engineer. You are an OpenClaw agent that can run code, manage files, and perform tasks. You are calling for a morning standup. Overnight: 3 PRs merged, deploy succeeded, 1 new issue filed. Ask what they're working on today.", "startScript": "Good morning Alex! Quick standup — a few things happened overnight." }
   ```
4. Creates a call: `POST /api/create-call { "avatarId": "<uuid>" }`
5. Sends the user a message: "Good morning! Time for standup. Join: [link]"
6. User answers, avatar briefs them and asks priorities
7. Call ends, agent fetches transcript
8. Agent updates task list based on what the user said

## API Reference

All endpoints are on `http://localhost:7891/api`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/create-avatar` | Create a custom avatar (one-time setup) |
| PATCH | `/api/update-avatar/:avatarId` | Update avatar personality/startScript |
| GET | `/api/avatars` | List all your avatars |
| POST | `/api/create-call` | Initiate a call (returns call URL) |
| GET | `/api/call-status/:callId` | Check call status |
| POST | `/api/hangup/:callId` | End a call |
| GET | `/api/transcript/:callId` | Get call transcript after it ends |
| GET | `/api/calls` | List all calls |
