#!/usr/bin/env python3
"""Tiny static server for the PWA preview. Correct MIME types matter: a
.webmanifest served as text/plain will not register."""
import http.server, socketserver, sys, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cocktail-game')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return TYPES.get(ext, super().guess_type(path))

    def end_headers(self):
        # Never let a stale service worker hide a change during development.
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Service-Worker-Allowed', '/')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s\n' % (fmt % args))


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
    print(f'serving {ROOT} on 0.0.0.0:{PORT}', flush=True)
    httpd.serve_forever()
