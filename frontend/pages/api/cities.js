import { proxyToBackend } from "../../utils/backendProxy";

export default function handler(req, res) {
  const q = encodeURIComponent(req.query.q || "");
  return proxyToBackend(req, res, { path: `/api/cities?q=${q}`, methods: "GET", timeoutMs: 30000 });
}
