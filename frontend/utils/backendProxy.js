// Shared helper for Next.js API routes that proxy to the FastAPI backend.
// Adds a bounded timeout, consistent error shape, and status passthrough.

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 120000);

/**
 * Proxy the incoming request to the backend.
 *
 * @param {object} req Next.js API request
 * @param {object} res Next.js API response
 * @param {object} [options]
 * @param {string} [options.path] Backend path (defaults to req.url, preserving query string)
 * @param {string|string[]} [options.methods] Allowed HTTP method(s)
 * @param {boolean} [options.forwardBody] Whether to forward the JSON body
 * @param {number} [options.timeoutMs] Request timeout in milliseconds
 */
export async function proxyToBackend(req, res, options = {}) {
  const {
    path = req.url,
    methods,
    forwardBody = req.method !== "GET" && req.method !== "HEAD",
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (methods) {
    const allowed = Array.isArray(methods) ? methods : [methods];
    if (!allowed.includes(req.method)) {
      res.setHeader("Allow", allowed.join(", "));
      return res.status(405).json({ error: "Method not allowed" });
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Forward the real client IP so the backend rate limiter sees individual
  // users rather than the Next.js server's address.
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "";

  try {
    const upstream = await fetch(`${BACKEND_URL}${path}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
      },
      body: forwardBody && req.body ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });

    const text = await upstream.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: "Invalid backend response", detail: text.slice(0, 500) };
    }

    return res.status(upstream.status).json(data);
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? "Backend request timed out" : "Backend unavailable",
      detail: String(err?.message || err),
    });
  } finally {
    clearTimeout(timeout);
  }
}
