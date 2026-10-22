#!/usr/bin/env python3
"""Backend simulado para probar los workflows sin la plataforma real.
Acepta cualquier POST, lo imprime en consola y responde 200. GET /health → 200."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class H(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send(200, {"status": "ok"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n).decode() if n else ""
        print(f"[mock-backend] POST {self.path} sig={'yes' if self.headers.get('X-N8N-Signature') else 'no'} "
              f"internal={'yes' if self.headers.get('X-Internal-Token') else 'no'} body={raw[:300]}", flush=True)
        self._send(200, {"ok": True, "score": 0})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("mock-backend escuchando en :8000", flush=True)
    HTTPServer(("0.0.0.0", 8000), H).serve_forever()
