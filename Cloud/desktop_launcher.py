from __future__ import annotations

import json
import os
import socket
import sys
import threading
import urllib.error
import urllib.request
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tkinter import StringVar, Tk, messagebox, ttk
from urllib.parse import unquote, urlparse

from werkzeug.serving import make_server


API_HOST = '127.0.0.1'
API_PORT = 5000


def is_frozen() -> bool:
    return bool(getattr(sys, 'frozen', False))


def get_resource_root() -> Path:
    if is_frozen():
        return Path(getattr(sys, '_MEIPASS'))
    return Path(__file__).resolve().parents[1]


def get_runtime_root() -> Path:
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[1]


def get_ui_dist_dir() -> Path:
    return get_resource_root() / 'WebUI' / 'dist'


def ensure_runtime_environment() -> None:
    runtime_root = get_runtime_root()
    runtime_root.mkdir(parents=True, exist_ok=True)
    os.chdir(runtime_root)

    releases_dir = runtime_root / 'releases'
    releases_dir.mkdir(exist_ok=True)

    os.environ.setdefault('PORT', str(API_PORT))
    os.environ.setdefault('RELEASES_DIR', str(releases_dir))


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((API_HOST, 0))
        return int(sock.getsockname()[1])


def existing_api_is_healthy() -> bool:
    try:
        with urllib.request.urlopen(f'http://{API_HOST}:{API_PORT}/health', timeout=1.5) as response:
            payload = json.loads(response.read().decode('utf-8'))
            return bool(payload.get('success'))
    except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError):
        return False


class SpaRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format: str, *args):
        return

    def do_GET(self):
        parsed_path = unquote(urlparse(self.path).path)
        if parsed_path in ('', '/'):
            self.path = '/index.html'
            return super().do_GET()

        requested_file = (Path(self.directory) / parsed_path.lstrip('/')).resolve()
        try:
            requested_file.relative_to(Path(self.directory).resolve())
        except ValueError:
            self.send_error(403)
            return

        if not requested_file.exists() and '.' not in Path(parsed_path).name:
            self.path = '/index.html'

        return super().do_GET()


class ServerThread(threading.Thread):
    def __init__(self, server, shutdown_callback):
        super().__init__(daemon=True)
        self.server = server
        self.shutdown_callback = shutdown_callback

    def run(self):
        self.server.serve_forever()

    def stop(self):
        self.shutdown_callback()


class TraceXLauncher:
    def __init__(self):
        ensure_runtime_environment()

        ui_dist_dir = get_ui_dist_dir()
        if not ui_dist_dir.exists():
            raise FileNotFoundError(f'Built UI not found: {ui_dist_dir}')

        from app import app as flask_app

        self.flask_app = flask_app
        self.api_thread: ServerThread | None = None
        self.ui_thread: ServerThread | None = None
        self.ui_port = find_free_port()
        self.ui_url = f'http://{API_HOST}:{self.ui_port}'

        self.root = Tk()
        self.root.title('TraceX Launcher')
        self.root.geometry('520x220')
        self.root.resizable(False, False)
        self.root.configure(bg='#0b1020')
        self.root.protocol('WM_DELETE_WINDOW', self.shutdown)

        self.status_var = StringVar(value='Starting launcher services...')
        self.detail_var = StringVar(value='')

        style = ttk.Style()
        try:
            style.theme_use('vista')
        except Exception:
            pass

        container = ttk.Frame(self.root, padding=20)
        container.pack(fill='both', expand=True)

        title = ttk.Label(container, text='TraceX Launcher', font=('Segoe UI Semibold', 18))
        title.pack(anchor='w')

        subtitle = ttk.Label(container, text='Local desktop wrapper for the packaged WebUI and Cloud API.')
        subtitle.pack(anchor='w', pady=(4, 12))

        status = ttk.Label(container, textvariable=self.status_var, font=('Segoe UI', 10))
        status.pack(anchor='w')

        detail = ttk.Label(container, textvariable=self.detail_var, font=('Segoe UI', 9))
        detail.pack(anchor='w', pady=(8, 18))

        controls = ttk.Frame(container)
        controls.pack(anchor='w')

        self.open_button = ttk.Button(controls, text='Open Launcher', command=self.open_browser, state='disabled')
        self.open_button.pack(side='left')

        ttk.Button(controls, text='Quit', command=self.shutdown).pack(side='left', padx=(10, 0))

    def start(self):
        self.start_api_server()
        self.start_ui_server()
        self.status_var.set('Launcher is running.')
        self.detail_var.set(f'UI: {self.ui_url}    API: http://{API_HOST}:{API_PORT}')
        self.open_button.configure(state='normal')
        self.root.after(250, self.open_browser)
        self.root.mainloop()

    def start_api_server(self):
        try:
            api_server = make_server(API_HOST, API_PORT, self.flask_app)
            self.api_thread = ServerThread(api_server, api_server.shutdown)
            self.api_thread.start()
        except OSError as error:
            if existing_api_is_healthy():
                self.detail_var.set(f'Reusing existing API at http://{API_HOST}:{API_PORT}')
                self.api_thread = None
                return
            raise RuntimeError(f'Could not start local API on port {API_PORT}: {error}') from error

    def start_ui_server(self):
        handler = partial(SpaRequestHandler, directory=str(get_ui_dist_dir()))
        try:
            ui_server = ThreadingHTTPServer((API_HOST, self.ui_port), handler)
        except OSError as error:
            raise RuntimeError(f'Could not start local UI server on port {self.ui_port}: {error}') from error
        self.ui_thread = ServerThread(ui_server, ui_server.shutdown)
        self.ui_thread.start()

    def open_browser(self):
        webbrowser.open(self.ui_url)

    def shutdown(self):
        if self.ui_thread is not None:
            self.ui_thread.stop()
            self.ui_thread = None
        if self.api_thread is not None:
            self.api_thread.stop()
            self.api_thread = None
        self.root.after(50, self.root.destroy)


def main():
    try:
        launcher = TraceXLauncher()
        launcher.start()
    except Exception as error:
        messagebox.showerror('TraceX Launcher', str(error))
        raise SystemExit(1) from error


if __name__ == '__main__':
    main()