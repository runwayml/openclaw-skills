/**
 * Creates a free Cloudflare Quick Tunnel (no account needed).
 * Falls back gracefully if unavailable.
 */
export async function createTunnel(port: number): Promise<string> {
  const { spawn } = await import("child_process");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("Tunnel creation timed out"));
    }, 15_000);

    const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;

    const handleOutput = (data: Buffer) => {
      const line = data.toString();
      const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(match[0]);
      }
    };

    proc.stdout.on("data", handleOutput);
    proc.stderr.on("data", handleOutput);

    proc.on("error", () => {
      clearTimeout(timeout);
      if (!resolved) reject(new Error("cloudflared not found — install from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"));
    });

    proc.on("exit", (code) => {
      clearTimeout(timeout);
      if (!resolved) reject(new Error(`cloudflared exited with code ${code}`));
    });

    process.on("exit", () => proc.kill());
  });
}
