import { proxyToBackend } from "../../utils/backendProxy";

export default function handler(req, res) {
  return proxyToBackend(req, res, { path: "/api/analytics", methods: "POST", timeoutMs: 15000 });
}
