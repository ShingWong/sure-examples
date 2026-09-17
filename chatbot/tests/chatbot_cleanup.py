"""Stop stale chatbot server processes left by manual runs (port 3001)."""
import os
import signal
import socket
import subprocess
import time


def _port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(('127.0.0.1', port)) == 0


def stop_stale_chatbot_servers():
    if not _port_in_use(3001):
        return
    ps = subprocess.run(
        ['ps', '-eo', 'pid=,ppid=,cmd='],
        text=True, capture_output=True, check=True,
    )
    for line in ps.stdout.splitlines():
        parts = line.strip().split(maxsplit=2)
        if len(parts) < 3:
            continue
        pid, _ppid, cmd = parts
        if 'sure-examples/chatbot/server.js' not in cmd and 'tsx server.js' not in cmd:
            continue
        try:
            os.kill(int(pid), signal.SIGTERM)
        except ProcessLookupError:
            continue
    deadline = time.monotonic() + 3
    while _port_in_use(3001) and time.monotonic() < deadline:
        time.sleep(0.1)
    if _port_in_use(3001):
        raise RuntimeError('Port 3001 is still in use by a stale chatbot process')
