import http.server
import socketserver
import webbrowser
import os
import json
import time
from datetime import datetime

PORT = 5000
DATA_FILE = 'mkturbo_database.json'
BACKUP_DIR = 'backups'

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable caching
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/sync' or self.path.startswith('/api/sync?'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            if os.path.exists(DATA_FILE):
                try:
                    with open(DATA_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self.wfile.write(json.dumps({'status': 'ok', 'data': data}).encode('utf-8'))
                    return
                except Exception as e:
                    self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
                    return
            else:
                self.wfile.write(json.dumps({'status': 'ok', 'data': None}).encode('utf-8'))
                return
        
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/sync':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                payload['serverUpdatedAt'] = datetime.now().isoformat()
                
                # Save primary data file
                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(payload, f, indent=2)
                
                # Create timestamped version backup in backups/
                os.makedirs(BACKUP_DIR, exist_ok=True)
                backup_name = os.path.join(BACKUP_DIR, f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
                with open(backup_name, 'w', encoding='utf-8') as f:
                    json.dump(payload, f, indent=2)

                # Keep only last 25 version backups
                try:
                    backups = sorted([os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if f.endswith('.json')])
                    if len(backups) > 25:
                        for old in backups[:-25]:
                            os.remove(old)
                except Exception:
                    pass

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'ok',
                    'updatedAt': payload['serverUpdatedAt'],
                    'message': 'Successfully synced and version saved'
                }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'))
            return
            
        super().do_POST()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"\n=======================================================")
        print(f" M.K. TURBO Suite & Sync Server is running at: {url}")
        print(f" Data file: {DATA_FILE}")
        print(f" Version backups: {BACKUP_DIR}/")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.server_close()

if __name__ == '__main__':
    main()
