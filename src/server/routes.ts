import { Router } from "express";
import type { Request, Response } from "express";
import { randomUUID } from "crypto";

const RUNWAY_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";
const DEFAULT_REFERENCE_IMAGE =
  "https://runway-static-assets.s3.us-east-1.amazonaws.com/calliope-demo/presets-3-3/InApp_Avatar_4_input.png";

const PRESET_AVATAR_IDS = new Set([
  "game-character", "music-superstar", "game-character-man", "cat-character",
  "influencer", "tennis-coach", "human-resource", "fashion-designer", "cooking-teacher",
]);

interface PendingCall {
  callId: string;
  avatarId: string;
  avatarConfig: { type: "runway-preset"; presetId: string } | { type: "custom"; avatarId: string };
  maxDuration: number;
  status: "ringing" | "connecting" | "active" | "ended";
  runwaySessionId?: string;
  avatarImageUrl?: string;
  avatarName?: string;
  createdAt: number;
}

const activeCalls = new Map<string, PendingCall>();

export function createCallRouter(apiSecret: string): Router {
  const router = Router();

  const runwayFetch = (path: string, options: RequestInit = {}) =>
    fetch(`${RUNWAY_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiSecret}`,
        "X-Runway-Version": RUNWAY_VERSION,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

  // ── Avatar Management ──────────────────────────────────────────────

  router.post("/create-avatar", async (req: Request, res: Response) => {
    const { name, referenceImage, personality, voice, startScript, documentIds, imageProcessing } = req.body;

    if (!name || !personality || !voice) {
      res.status(400).json({ error: "Required: name, personality, voice" });
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name,
        referenceImage: referenceImage || DEFAULT_REFERENCE_IMAGE,
        personality,
        voice,
      };
      if (startScript) body.startScript = startScript;
      if (documentIds) body.documentIds = documentIds;
      body.imageProcessing = imageProcessing || "none";

      const createRes = await runwayFetch("/v1/avatars", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        res.status(createRes.status).json({ error: err });
        return;
      }

      const avatar = await createRes.json();
      console.log("[create-avatar] Created:", avatar.id, "status:", avatar.status);

      // Poll until avatar is processed (READY)
      if (avatar.status !== "READY") {
        const deadline = Date.now() + 120_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2_000));
          const pollRes = await runwayFetch(`/v1/avatars/${avatar.id}`);
          const pollData = await pollRes.json();
          console.log("[create-avatar] Poll:", pollData.id, "status:", pollData.status);

          if (pollData.status === "READY") {
            res.json(pollData);
            return;
          }
          if (pollData.status === "FAILED") {
            res.status(500).json({ error: "Avatar processing failed", details: pollData });
            return;
          }
        }
        res.status(504).json({ error: "Avatar processing timed out" });
        return;
      }

      res.json(avatar);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch("/update-avatar/:avatarId", async (req: Request, res: Response) => {
    const avatarId = req.params.avatarId as string;
    const { personality, startScript, name, referenceImage, documentIds } = req.body;

    const body: Record<string, unknown> = {};
    if (personality !== undefined) body.personality = personality;
    if (startScript !== undefined) body.startScript = startScript;
    if (name !== undefined) body.name = name;
    if (referenceImage !== undefined) body.referenceImage = referenceImage;
    if (documentIds !== undefined) body.documentIds = documentIds;

    if (Object.keys(body).length === 0) {
      res.status(400).json({ error: "At least one field required" });
      return;
    }

    try {
      const patchRes = await runwayFetch(`/v1/avatars/${avatarId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      if (!patchRes.ok) {
        const err = await patchRes.json();
        res.status(patchRes.status).json({ error: err });
        return;
      }

      const avatar = await patchRes.json();
      console.log("[update-avatar] Updated:", avatar.id);
      res.json(avatar);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/avatars", async (_req: Request, res: Response) => {
    try {
      const listRes = await runwayFetch("/v1/avatars");
      if (!listRes.ok) {
        const err = await listRes.json();
        res.status(listRes.status).json({ error: err });
        return;
      }
      const data = await listRes.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Call Management ────────────────────────────────────────────────

  router.post("/create-call", async (req: Request, res: Response) => {
    try {
      const { avatarId, presetId, maxDuration, personality, startScript } = req.body;
      const id = avatarId || presetId || "music-superstar";

      const isPreset = PRESET_AVATAR_IDS.has(id);
      let resolvedAvatarId = id;

      // If a custom avatar ID is given AND personality/startScript are provided,
      // update the avatar before creating the call
      if (!isPreset && (personality || startScript)) {
        const patchBody: Record<string, unknown> = {};
        if (personality) patchBody.personality = personality;
        if (startScript) patchBody.startScript = startScript;

        const patchRes = await runwayFetch(`/v1/avatars/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patchBody),
        });

        if (!patchRes.ok) {
          const err = await patchRes.json();
          console.warn("[create-call] Failed to update avatar personality:", err);
        } else {
          console.log("[create-call] Updated avatar personality/startScript before call");
        }
      }

      const avatarConfig = isPreset
        ? { type: "runway-preset" as const, presetId: id }
        : { type: "custom" as const, avatarId: id };

      let avatarImageUrl: string | undefined;
      let avatarName: string | undefined;
      if (!isPreset) {
        try {
          const avatarRes = await runwayFetch(`/v1/avatars/${id}`);
          if (avatarRes.ok) {
            const avatarData = await avatarRes.json();
            avatarImageUrl = avatarData.processedImageUri || avatarData.referenceImageUri;
            avatarName = avatarData.name;
          }
        } catch {
          // non-critical
        }
      }

      const callId = randomUUID();
      const call: PendingCall = {
        callId,
        avatarId: resolvedAvatarId,
        avatarConfig,
        maxDuration: Math.min(maxDuration || 300, 300),
        status: "ringing",
        avatarImageUrl,
        avatarName,
        createdAt: Date.now(),
      };
      activeCalls.set(callId, call);

      const tunnelUrl = req.app.locals.tunnelUrl;
      const localUrl = req.app.locals.localUrl;
      const callPath = `/call/${callId}`;

      res.json({
        callId,
        status: "ringing",
        urls: {
          local: `${localUrl}${callPath}`,
          ...(tunnelUrl && { tunnel: `${tunnelUrl}${callPath}` }),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/call-status/:callId", async (req: Request, res: Response) => {
    const call = activeCalls.get(req.params.callId as string);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    res.json({
      callId: call.callId,
      status: call.status,
      avatarImageUrl: call.avatarImageUrl,
      avatarName: call.avatarName,
    });
  });

  // User clicks "Answer" → create Runway realtime session
  router.post("/answer/:callId", async (req: Request, res: Response) => {
    const call = activeCalls.get(req.params.callId as string);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (call.status === "active") {
      res.status(409).json({ error: "Call already answered" });
      return;
    }

    call.status = "connecting";

    try {
      const sessionRes = await runwayFetch("/v1/realtime_sessions", {
        method: "POST",
        body: JSON.stringify({
          model: "gwm1_avatars",
          avatar: call.avatarConfig,
          maxDuration: call.maxDuration,
        }),
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.json();
        call.status = "ended";
        res.status(sessionRes.status).json({ error: err });
        return;
      }

      const { id: sessionId } = await sessionRes.json();
      call.runwaySessionId = sessionId;
      console.log("[answer] Session created:", sessionId);

      // Poll until READY
      const deadline = Date.now() + 60_000;
      let sessionKey: string | undefined;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1_000));
        const statusRes = await runwayFetch(`/v1/realtime_sessions/${sessionId}`);
        const session = await statusRes.json();

        if (session.status === "READY" && session.sessionKey) {
          sessionKey = session.sessionKey;
          console.log("[answer] Session ready");
          break;
        }
        if (session.status === "FAILED") {
          call.status = "ended";
          res.status(500).json({ error: session.failure || "Session failed" });
          return;
        }
      }

      if (!sessionKey) {
        call.status = "ended";
        res.status(504).json({ error: "Session creation timed out" });
        return;
      }

      call.status = "active";

      res.json({ callId: call.callId, sessionId, sessionKey, avatarId: call.avatarId });
    } catch (err: any) {
      call.status = "ended";
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/hangup/:callId", async (req: Request, res: Response) => {
    const call = activeCalls.get(req.params.callId as string);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }

    call.status = "ended";
    res.json({ status: "ended" });
  });

  router.delete("/session/:callId", async (req: Request, res: Response) => {
    const call = activeCalls.get(req.params.callId as string);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }

    call.status = "ended";

    if (call.runwaySessionId) {
      try {
        await runwayFetch(`/v1/realtime_sessions/${call.runwaySessionId}`, {
          method: "DELETE",
        });
      } catch {
        // best-effort cleanup
      }
    }

    res.json({ status: "ended" });
  });

  // ── Transcript ─────────────────────────────────────────────────────

  router.get("/transcript/:callId", async (req: Request, res: Response) => {
    const call = activeCalls.get(req.params.callId as string);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    if (!call.runwaySessionId) {
      res.status(404).json({ error: "No session — call was never answered" });
      return;
    }

    try {
      const transcriptRes = await runwayFetch(
        `/v1/avatars/${call.avatarId}/conversations/${call.runwaySessionId}`
      );

      if (!transcriptRes.ok) {
        const err = await transcriptRes.json();
        res.status(transcriptRes.status).json({ error: err });
        return;
      }

      const data = await transcriptRes.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Utility ────────────────────────────────────────────────────────

  router.get("/calls", (_req: Request, res: Response) => {
    const calls = Array.from(activeCalls.values()).map((c) => ({
      callId: c.callId,
      status: c.status,
      avatarId: c.avatarId,
      createdAt: c.createdAt,
    }));
    res.json({ calls });
  });

  return router;
}
