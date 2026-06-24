const defaultBackendUrl = "http://localhost:8080";

export function getBackendHttpUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultBackendUrl;
  return new URL(path, baseUrl).toString();
}

export function getBackendWsUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultBackendUrl;
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
