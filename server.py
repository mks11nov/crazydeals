#!/usr/bin/env python3
"""
Local Development Server with URL Rewriting for Slug-based Product URLs
Supports: /product/slug -> /product.html

Usage:
    python server.py
    python server.py --port 8000
"""

import http.server
import socketserver
import urllib.parse
import os
import sys
from pathlib import Path

PORT = 8000

class SlugRewriteHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that rewrites /product/slug to /product.html"""
    
    def do_GET(self):
        """Handle GET requests with URL rewriting"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        # Handle /product/slug or /products/slug -> rewrite to product.html
        if path.startswith('/product/') or path.startswith('/products/'):
            # Extract slug (everything after /product/ or /products/)
            slug_match = path.split('/', 2)
            if len(slug_match) >= 3:
                # Rewrite to product.html
                self.path = '/product.html' + (f'?{parsed_path.query}' if parsed_path.query else '')
                # Continue with normal file serving
                return super().do_GET()
        
        # Block ID-based URLs
        query_params = urllib.parse.parse_qs(parsed_path.query)
        if 'id' in query_params and ('product' in path or 'products' in path):
            # Send 404 for ID-based URLs
            self.send_error(404, "Product not found")
            return
        
        # Block direct access to product.html without slug
        if path == '/product.html' and not parsed_path.query:
            self.send_error(404, "Product not found")
            return
        
        # Default behavior for all other files
        return super().do_GET()

def main():
    """Start the server"""
    # Change to frontend directory
    script_dir = Path(__file__).parent.absolute()
    os.chdir(script_dir)
    
    # Parse port from command line if provided
    global PORT
    if len(sys.argv) > 1:
        if '--port' in sys.argv:
            try:
                port_index = sys.argv.index('--port')
                PORT = int(sys.argv[port_index + 1])
            except (ValueError, IndexError):
                print("Invalid port number. Using default port 8000.")
        elif sys.argv[1].isdigit():
            PORT = int(sys.argv[1])
    
    Handler = SlugRewriteHandler
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("=" * 60)
        print("🚀 Local Development Server Started")
        print("=" * 60)
        print(f"📍 Server running at: http://127.0.0.1:{PORT}")
        print(f"📍 Alternative URL:   http://localhost:{PORT}")
        print("=" * 60)
        print("✅ URL Rewriting Enabled:")
        print("   /product/slug → /product.html")
        print("   /products/slug → /product.html")
        print("=" * 60)
        print("❌ Blocked URLs (will return 404):")
        print("   /product.html?id=*")
        print("   /product.html (direct access)")
        print("=" * 60)
        print("💡 Press CTRL+C to stop the server")
        print("=" * 60)
        print()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Goodbye!")

if __name__ == "__main__":
    main()
