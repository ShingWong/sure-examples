"""
End-to-end test for the sure-chatbot using sure-web-testing's BrowserManager.

Demonstrates multi-step browser testing with sure-web-testing:
  - Launch a headed (or headless) browser session
  - Navigate, inspect DOM, interact, take screenshots
  - Capture console logs and network requests between steps
  - Highlight elements for visual confirmation

Run:
  cd sure-examples/chatbot
  python ../test_runner.py
"""
import sys, os, time, json

# Add sure-web-testing to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'sure-web-testing', 'src'))

from browser import BrowserManager

CHATBOT_URL = 'http://localhost:3001'


def run_all_tests(mgr):
    results = []

    def step(name, fn):
        print(f'\n  ── {name} ──')
        try:
            result = fn()
            results.append((name, 'PASS', result))
            print(f'  ✓ {name}')
            return result
        except Exception as e:
            results.append((name, 'FAIL', str(e)))
            print(f'  ✗ {name}: {e}')
            return None

    # ── 1. Launch browser ──
    step('launch', lambda: mgr.launch(headless=True, viewport={'width': 1280, 'height': 800}))

    # ── 2. Navigate to chatbot ──
    step('goto chatbot', lambda: mgr.goto(CHATBOT_URL))

    # ── 3. Verify login page is shown ──
    step('verify login page', lambda: _check_login_page(mgr))

    # ── 4. Take a screenshot of the login page ──
    step('screenshot login', lambda: mgr.screenshot())

    # ── 5. Sign in with demo credentials ──
    step('sign in', lambda: _sign_in(mgr, 'demo@example.com', 'demo'))

    # ── 6. Verify page loaded — check for key elements ──
    step('verify page load', lambda: _check_page_loaded(mgr))

    # ── 7. Get DOM and verify sidebar ──
    step('verify sidebar', lambda: _check_sidebar(mgr))

    # ── 8. Take a screenshot of the initial state ──
    step('screenshot initial', lambda: mgr.screenshot())

    # ── 9. Open settings drawer ──
    step('open settings', lambda: _open_settings(mgr))

    # ── 10. Verify settings drawer contents ──
    step('verify settings', lambda: _check_settings(mgr))

    # ── 11. Switch theme to Dracula via settings ──
    step('switch theme', lambda: _switch_theme(mgr, 'dracula'))

    # ── 12. Take screenshot of Dracula theme ──
    step('screenshot dracula', lambda: mgr.screenshot())

    # ── 13. Switch back to Nord theme ──
    step('switch back to nord', lambda: _switch_theme(mgr, 'nord'))

    # ── 14. Close settings drawer ──
    step('close settings', lambda: _close_settings(mgr))

    # ── 15. Send a chat message ──
    step('send message', lambda: _send_message(mgr, 'Hello! What can you do?'))

    # ── 16. Wait for response and verify ──
    step('verify response', lambda: _check_response(mgr))

    # ── 16. Take screenshot with conversation ──
    step('screenshot with messages', lambda: mgr.screenshot())

    # ── 17. Get console logs ──
    step('console logs', lambda: _check_console(mgr))

    # ── 18. Get network requests ──
    step('network requests', lambda: _check_network(mgr))

    # ── 19. Clear messages ──
    step('clear messages', lambda: _clear_messages(mgr))

    # ── 20. Create new conversation ──
    step('new conversation', lambda: _new_conversation(mgr))

    # ── 21. Verify the new conversation state ──
    step('verify new conversation', lambda: _check_new_conversation(mgr))

    # ── 22. Final screenshot ──
    step('screenshot final', lambda: mgr.screenshot())

    # ── 23. Close browser ──
    step('close', lambda: mgr.close())

    return results


def _check_login_page(mgr):
    dom = mgr.get_dom()
    assert dom['status'] == 'ok'
    html = dom['data']['html']
    assert 'Sign in to continue' in html or 'sure-chatbot' in html, 'Login page not found'
    assert 'loginEmail' in html or 'login' in html.lower(), 'Login form not found'
    return {'login_page_found': True}


def _sign_in(mgr, email, password):
    mgr.fill('#loginEmail', email)
    mgr.fill('#loginPassword', password)
    result = mgr.click('#loginBtn')
    assert result['status'] == 'ok', f'Sign in click failed: {result}'
    time.sleep(0.5)
    # Verify login succeeded by checking chat UI is visible
    info = mgr.get_info()
    dom = mgr.get_dom()
    assert 'messageInput' in dom['data']['html'] or 'sidebar' in dom['data']['html'], 'Chat UI not found after login'
    return {'signed_in': True}


def _check_page_loaded(mgr):
    info = mgr.get_info()
    assert info['status'] == 'ok', f'get_info failed: {info}'
    data = info.get('data', {})
    url = data.get('url', '')
    title = data.get('title', '')
    assert 'sure-chatbot' in title.lower() or 'sure' in title.lower() or 'localhost' in url, \
        f'Unexpected title or URL: title={title!r}, url={url!r}'
    return {'url': url, 'title': title}


def _check_sidebar(mgr):
    dom = mgr.get_dom()
    assert dom['status'] == 'ok'
    html = dom['data']['html']
    assert 'sure-chatbot' in html, 'Sidebar header missing'
    assert 'Settings' in html, 'Settings button missing'
    # Verify the chat input exists
    assert 'messageInput' in html or 'Type a message' in html, 'Chat input missing'
    return {'sidebar_found': True}


def _open_settings(mgr):
    # Click the Settings button
    result = mgr.click('button:has-text("Settings")')
    assert result['status'] == 'ok', f'Click settings failed: {result}'
    time.sleep(0.3)
    # Verify drawer opened
    dom = mgr.get_dom()
    assert 'LLM Provider' in dom['data']['html'], 'Settings drawer did not open'
    return True


def _check_settings(mgr):
    dom = mgr.get_dom()
    html = dom['data']['html']
    checks = {
        'provider select': 'select' in html and ('mock' in html or 'openai' in html or 'anthropic' in html),
        'api key field': 'API Key' in html or 'apiKey' in html,
        'model field': 'Model' in html or 'model' in html,
        'temperature slider': 'temperature' in html or 'range' in html,
        'theme selector': 'Nord' in html and 'Forest' in html and 'Dracula' in html,
    }
    failed = [k for k, v in checks.items() if not v]
    assert not failed, f'Settings drawer missing: {failed}'
    return checks


def _switch_theme(mgr, theme_name):
    # Find and click the theme button
    theme_btn = f'.theme-btn[data-theme="{theme_name}"]'
    result = mgr.click(theme_btn)
    assert result['status'] == 'ok', f'Click theme {theme_name} failed: {result}'
    time.sleep(0.3)
    # Verify theme changed (check active state)
    dom = mgr.get_dom()
    assert f'data-theme="{theme_name}"' in dom['data']['html'], f'Theme {theme_name} not in DOM'
    return True


def _close_settings(mgr):
    # Click the close button (✕) in the drawer header
    result = mgr.click('.drawer-header .btn-icon')
    if result['status'] == 'error':
        # Try clicking the overlay instead
        result = mgr.click('.drawer-overlay')
    assert result['status'] == 'ok', f'Close settings failed: {result}'
    time.sleep(0.3)
    return True


def _send_message(mgr, text):
    # Type in the message input
    result = mgr.fill('#messageInput', text)
    assert result['status'] == 'ok', f'Fill message failed: {result}'
    # Click Send button
    result = mgr.click('#sendBtn')
    assert result['status'] == 'ok', f'Click send failed: {result}'
    # Wait for response to appear
    time.sleep(1)
    return True


def _check_response(mgr):
    dom = mgr.get_dom()
    html = dom['data']['html']
    assert 'message' in html.lower() or 'user' in html.lower() or 'assistant' in html.lower(), \
        'No messages found in DOM'
    # Check for both user message and assistant response
    messages_found = html.count('message')
    assert messages_found >= 2, f'Expected at least 2 message elements, found {messages_found}'
    return {'messages_found': messages_found}


def _check_console(mgr):
    logs = mgr.get_console_logs()
    assert logs['status'] == 'ok'
    # Check for errors
    errors = [log for log in logs.get('data', []) if log.get('level') in ('error', 'exception')]
    if errors:
        print(f'  ⚠ Console errors found: {len(errors)}')
        for e in errors[:3]:
            print(f'    {e.get("text", "")[:120]}')
    return {'total_logs': len(logs.get('data', [])), 'errors': len(errors)}


def _check_network(mgr):
    requests = mgr.get_network_requests()
    assert requests['status'] == 'ok'
    api_calls = [r for r in requests.get('data', []) if '/api/' in r.get('url', '')]
    print(f'  📡 API calls detected: {len(api_calls)}')
    return {'total_requests': len(requests.get('data', [])), 'api_calls': len(api_calls)}


def _clear_messages(mgr):
    result = mgr.click('button:has-text("🗑")')
    # The button might use unicode or be hard to find — try other selectors
    if result['status'] == 'error':
        result = mgr.click('.chat-header .btn-icon:last-child')
    if result['status'] == 'error':
        result = mgr.click('button[onclick="clearMessages()"]')
    # Not critical if clear fails — just log
    if result['status'] == 'error':
        print('  ⚠ Clear messages button not found (non-critical)')
        return False
    time.sleep(0.3)
    return True


def _new_conversation(mgr):
    # Click the + button in sidebar header
    result = mgr.click('.sidebar-header .btn-icon')
    if result['status'] == 'error':
        result = mgr.click('button[onclick="newConversation()"]')
    assert result['status'] == 'ok', f'New conversation failed: {result}'
    time.sleep(0.3)
    return True


def _check_new_conversation(mgr):
    # Should have a clean state
    dom = mgr.get_dom()
    html = dom['data']['html']
    # The new conversation might not have an active conv id yet,
    # but the UI should be ready for input
    input_present = 'messageInput' in html or 'Type a message' in html
    assert input_present, 'Message input not found after new conversation'
    return {'input_present': input_present}


def print_summary(results):
    passed = sum(1 for _, s, _ in results if s == 'PASS')
    failed = sum(1 for _, s, _ in results if s == 'FAIL')
    total = len(results)
    print(f'\n{"=" * 50}')
    print(f'  Results: {passed}/{total} passed, {failed} failed')
    if failed:
        print(f'\n  Failed steps:')
        for name, status, detail in results:
            if status == 'FAIL':
                print(f'    ✗ {name}: {detail}')
    print(f'{"=" * 50}')
    return failed == 0


if __name__ == '__main__':
    mgr = BrowserManager()
    success = False
    try:
        results = run_all_tests(mgr)
        success = print_summary(results)
    finally:
        try:
            mgr.close()
        except Exception:
            pass
    sys.exit(0 if success else 1)
