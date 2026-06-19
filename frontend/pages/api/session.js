import { proxyToBackend } from "../../utils/backendProxy";

export default function handler(req, res) {
  const sessionId = encodeURIComponent(req.query.session_id || "");
  return proxyToBackend(req, res, {
    path: `/api/session?session_id=${sessionId}`,
    methods: "GET",
  });
}
