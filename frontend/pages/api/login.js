import { proxyToBackend } from "../../utils/backendProxy";

export default function handler(req, res) {
  return proxyToBackend(req, res, { path: "/api/login", methods: "POST" });
}
