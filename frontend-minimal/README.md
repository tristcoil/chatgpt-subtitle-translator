Minimal React Frontend (No Build Tools)
======================================

This is a minimal React app (single HTML) that talks to the Express API.

How to run (no bundler):
- Open index.html in a modern browser (or serve statically from any server)
- Ensure your Express server is running (default http://127.0.0.1:5100)

Features:
- Upload an SRT/TXT file and start async translation
- Shows live progress via Server-Sent Events (SSE)
- Download link when finished
