import { proxyToBackend } from "../../utils/backendProxy";

export default function handler(req, res) {
  const email = encodeURIComponent(req.query.email || "");
  return proxyToBackend(req, res, { path: `/api/profile/orders?email=${email}`, methods: "GET" });
}
