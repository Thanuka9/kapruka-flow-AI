export default function handler(req, res) {
  res.status(200).json({
    backendUrl: process.env.BACKEND_URL || "http://localhost:8000",
    proxyTimeout: process.env.PROXY_TIMEOUT_MS || "not set"
  });
}
