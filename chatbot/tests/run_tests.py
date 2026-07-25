"""
Test runner for sure-chatbot E2E tests using sure-web-testing's BrowserManager.

Starts the chatbot server, runs the browser tests, and cleans up.

Usage:
  python tests/run_tests.py

Requires:
  - sure-web-testing installed or accessible (PYTHONPATH or pip install -e)
  - Playwright browsers installed (playwright install chromium)
  - Chatbot dependencies installed (npm install)
"""
import subprocess
import sys
import os
import time
import signal

# Paths
CHATBOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SURE_WEB_TESTING_DIR = os.path.join(os.path.dirname(CHATBOT_DIR), '..', 'sure-web-testing')


def main():
    # Ensure sure-web-testing is in PYTHONPATH
    swt_src = os.path.join(SURE_WEB_TESTING_DIR, 'src')
    if not os.path.isdir(swt_src):
        print(f'Error: sure-web-testing not found at {swt_src}')
        sys.exit(1)

    env = os.environ.copy()
    pythonpath = env.get('PYTHONPATH', '')
    if pythonpath:
        pythonpath = f'{swt_src}:{pythonpath}'
    else:
        pythonpath = swt_src
    env['PYTHONPATH'] = pythonpath
    env['ALLOW_EVALUATE'] = 'true'

    # Start the chatbot server
    print('Starting chatbot server...')
    server = subprocess.Popen(
        ['npx', 'tsx', 'server.js'],
        cwd=CHATBOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env={**env, 'PYTHONPATH': ''},  # reset for Node
    )

    # Wait for server to be ready
    time.sleep(2)
    if server.poll() is not None:
        print(f'Server failed to start (exit code {server.returncode})')
        print(server.stdout.read().decode() if server.stdout else 'No output')
        sys.exit(1)

    print('Chatbot server started on http://localhost:3001')

    # Run the tests
    print('\nRunning E2E browser tests...\n')
    success = False
    try:
        # Import and run test suite
        sys.path.insert(0, swt_src)
        from test_chatbot import run_all_tests, print_summary
        from browser import BrowserManager

        mgr = BrowserManager()
        try:
            results = run_all_tests(mgr)
            success = print_summary(results)
        finally:
            try:
                mgr.close()
            except Exception:
                pass
    except ImportError as e:
        print(f'Import error: {e}')
        print(f'Make sure sure-web-testing is available. Try:')
        print(f'  pip install -e {SURE_WEB_TESTING_DIR}')
        success = False
    except Exception as e:
        print(f'Test error: {e}')
        import traceback
        traceback.print_exc()
        success = False
    finally:
        # Cleanup: stop the server
        print('\nStopping chatbot server...')
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
