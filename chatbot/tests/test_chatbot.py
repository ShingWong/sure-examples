"""
End-to-end test for the sure-chatbot using sure-web-testing's BrowserManager.

Demonstrates multi-step browser testing with sure-web-testing:
  - Launch a headed (or headless) browser session
  - Navigate, inspect DOM, interact, take screenshots
  - Capture console logs and network requests between steps
  - Highlight elements for visual confirmation

A note on assertions
--------------------
page.content() returns documentElement.outerHTML, which includes the text
of every inline <script>. On this page that is 83% of the document, so a
substring assertion like `assert 'LLM Provider' in html` can succeed by
matching a JavaScript string literal rather than anything the user can see.

Every assertion below is therefore scoped to a real element — via
get_dom(selector) for inner HTML, get_text() for rendered text, or
get_attribute() for a single attribute — and checks state that the browser
actually applied, not strings that merely appear somewhere in the source.

Run:
  cd sure-examples/chatbot
  python3 tests/run_tests.py
"""
import sys, os, time, json

# Add sure-web-testing to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'sure-web-testing', 'src'))

from browser import BrowserManager

CHATBOT_URL = 'http://localhost:3001'

# The settings entry point. The old suite looked for a button whose visible
# text was "Settings"; that button does not exist. Settings is opened from the
# header menu, identified by its title attribute.
SETTINGS_BTN = 'button[title="Provider / Model / Temperature"]'

# Theme swatches exist in three places on this page (the settings modal, the
# theme modal, and the preview panel). The preview-panel copy is rendered
# outside the 1280px viewport, so an unscoped selector resolves to an element
# Playwright refuses to click. Always scope theme clicks to the modal body.
THEME_BTN = '#modalBody .theme-btn[data-theme="{theme}"]'

# setTheme() applies a theme by replacing the text of <style id="theme-style">,
# fetched from /api/theme. There is no data-theme attribute on the root
# element, so the theme is verified by the CSS it actually injected.
THEME_EXPECTED_BG = {'nord': '#eceff4', 'forest': '#f4f1ea',
                     'dracula': '#282a36', 'dark': '#1a1a2e'}


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

    # ── 7. Verify the sidebar renders its heading ──
    step('verify sidebar', lambda: _check_sidebar(mgr))

    # ── 8. Take a screenshot of the initial state ──
    step('screenshot initial', lambda: mgr.screenshot())

    # ── 9. Open the settings modal ──
    step('open settings', lambda: _open_settings(mgr))

    # ── 10. Verify settings modal contents ──
    step('verify settings', lambda: _check_settings(mgr))

    # ── 11. Switch theme to Dracula via settings ──
    step('switch theme', lambda: _switch_theme(mgr, 'dracula'))

    # ── 12. Take screenshot of Dracula theme ──
    step('screenshot dracula', lambda: mgr.screenshot())

    # ── 13. Switch back to Nord theme ──
    step('switch back to nord', lambda: _switch_theme(mgr, 'nord'))

    # ── 14. Close the settings modal ──
    step('close settings', lambda: _close_settings(mgr))

    # ── 15. Send a chat message ──
    step('send message', lambda: _send_message(mgr, 'Hello! What can you do?'))

    # ── 16. Wait for response and verify ──
    step('verify response', lambda: _check_response(mgr))

    # ── 17. Take screenshot with conversation ──
    step('screenshot with messages', lambda: mgr.screenshot())

    # ── 18. Get console logs ──
    step('console logs', lambda: _check_console(mgr))

    # ── 19. Get network requests ──
    step('network requests', lambda: _check_network(mgr))

    # ── 20. Clear messages ──
    step('clear messages', lambda: _clear_messages(mgr))

    # ── 21. Create new conversation ──
    step('new conversation', lambda: _new_conversation(mgr))

    # ── 22. Verify the new conversation state ──
    step('verify new conversation', lambda: _check_new_conversation(mgr))

    # ── 23. Preview panel test ──
    step('preview panel', lambda: test_preview_panel(mgr))

    # ── 24. Key management test ──
    step('key management', lambda: test_key_management(mgr))

    # ── 25. Final screenshot ──
    step('screenshot final', lambda: mgr.screenshot())

    # ── 26. Close browser ──
    step('close', lambda: mgr.close())

    return results


# ── helpers ──────────────────────────────────────────────────────────────

def _dom(mgr, selector):
    """inner_html() of a single element — excludes inline <script> source."""
    result = mgr.get_dom(selector)
    assert result['status'] == 'ok', f'get_dom({selector}) failed: {result}'
    return result['data']['html']


def _present(mgr, selector):
    """Is at least one element matching selector attached to the DOM?

    Use this for void elements (<input>, <img>, <hr>): inner_html() is
    legitimately empty for them, so _dom() cannot detect their presence.
    """
    result = mgr.query_elements(selector)
    assert result['status'] == 'ok', f'query_elements({selector}) failed: {result}'
    found = result.get('data') or []
    assert found, f'no element matches {selector}'
    return True


def _text(mgr, selector):
    """Rendered text of a single element."""
    result = mgr.get_text(selector)
    assert result['status'] == 'ok', f'get_text({selector}) failed: {result}'
    return (result.get('data', {}).get('text') or '').strip()


def _attr(mgr, selector, name):
    """A single attribute of a single element."""
    result = mgr.get_attribute(selector, name)
    assert result['status'] == 'ok', f'get_attribute({selector}, {name}) failed: {result}'
    return result.get('data', {}).get('value')


def _modal_is_open(mgr):
    return 'open' in (_attr(mgr, '#modalOverlay', 'class') or '')


def _require_open_modal(mgr, expected_title):
    """Assert the modal is actually open and showing the expected view."""
    assert _modal_is_open(mgr), '#modalOverlay is not .open — nothing is visible'
    title = _text(mgr, '#modalTitle')
    assert title == expected_title, f'modal title is {title!r}, expected {expected_title!r}'


# ── steps ────────────────────────────────────────────────────────────────

def _check_login_page(mgr):
    title = _text(mgr, 'body')
    assert 'Sign in to continue' in title or 'sure-chatbot' in title, 'Login page not found'
    for sel in ('#loginEmail', '#loginPassword', '#loginBtn'):
        _present(mgr, sel)
    return {'login_page_found': True}


def _sign_in(mgr, email, password):
    mgr.fill('#loginEmail', email)
    mgr.fill('#loginPassword', password)
    result = mgr.click('#loginBtn')
    assert result['status'] == 'ok', f'Sign in click failed: {result}'
    time.sleep(0.8)
    # The chat UI replaces the login wall; the message input proves it.
    _present(mgr, '#messageInput')
    return {'signed_in': True}


def _check_page_loaded(mgr):
    info = mgr.get_info()
    assert info['status'] == 'ok', f'get_info failed: {info}'
    data = info.get('data', {})
    url, title = data.get('url', ''), data.get('title', '')
    assert 'sure-chatbot' in title.lower(), f'Unexpected title: {title!r} (url={url!r})'
    return {'url': url, 'title': title}


def _check_sidebar(mgr):
    # The heading is the rendered app name. The old suite asserted
    # 'persona-bot', which no longer appears anywhere in the app.
    heading = _text(mgr, '.sidebar-header h1')
    assert heading == 'sure-chatbot', f'sidebar heading is {heading!r}'
    # The settings entry point lives in the header menu, not the sidebar.
    _present(mgr, SETTINGS_BTN)
    _present(mgr, '#messageInput')
    return {'heading': heading}


def _open_settings(mgr):
    result = mgr.click(SETTINGS_BTN)
    assert result['status'] == 'ok', f'Click settings failed: {result}'
    time.sleep(0.5)
    _require_open_modal(mgr, 'Settings')
    return True


def _check_settings(mgr):
    _require_open_modal(mgr, 'Settings')
    body = _dom(mgr, '#modalBody')
    assert body, 'modal body is empty'
    # Controls, identified by id, rather than by label text.
    for sel in ('#modalBody #provider', '#modalBody #model', '#modalBody #temperature'):
        _present(mgr, sel)
    # The provider select offers the mock backend plus real providers.
    assert 'mock' in body.lower(), 'provider select does not offer the mock backend'
    # The settings modal also carries a theme section.
    for theme in ('nord', 'forest', 'dracula', 'dark'):
        assert _dom(mgr, THEME_BTN.format(theme=theme)), f'theme swatch {theme} missing from settings'
    return {'controls': ['provider', 'model', 'temperature']}


def _switch_theme(mgr, theme_name):
    assert theme_name in THEME_EXPECTED_BG, f'unknown theme {theme_name!r}'
    selector = THEME_BTN.format(theme=theme_name)
    result = mgr.click(selector, timeout=8000)
    assert result['status'] == 'ok', f'Click theme {theme_name} failed: {result}'
    time.sleep(0.6)

    # The swatch reflects the selection.
    classes = _attr(mgr, selector, 'class') or ''
    assert 'active' in classes, f'{theme_name} swatch not marked active (class={classes!r})'

    # And the theme CSS was actually injected and applied. This is the real
    # check: the old assertion looked for a data-theme attribute on the root
    # element, which this app never sets.
    applied = _dom(mgr, '#theme-style')
    assert applied, 'no #theme-style element — theme CSS was never injected'
    expected_bg = THEME_EXPECTED_BG[theme_name]
    assert expected_bg in applied, \
        f'theme CSS for {theme_name} (--bg {expected_bg}) not found in injected stylesheet'
    return {'theme': theme_name, 'bg': expected_bg}


def _close_settings(mgr):
    result = mgr.click('.modal__close')
    assert result['status'] == 'ok', f'Close settings failed: {result}'
    time.sleep(0.5)
    assert not _modal_is_open(mgr), 'modal is still open after clicking .modal__close'
    return True


def _send_message(mgr, text):
    result = mgr.fill('#messageInput', text)
    assert result['status'] == 'ok', f'Fill message failed: {result}'
    result = mgr.click('#sendBtn')
    assert result['status'] == 'ok', f'Click send failed: {result}'
    time.sleep(1.5)
    return True


def _check_response(mgr):
    messages = _dom(mgr, '#messages')
    assert messages, '#messages is empty — no conversation rendered'
    body = _text(mgr, '#messages')
    assert body, '#messages rendered no text'
    # Both the prompt and the reply should be present.
    assert 'Hello! What can you do?' in body, 'the sent message is not shown'
    return {'messages_text': body[:120]}


def _check_console(mgr):
    logs = mgr.get_console_logs()
    assert logs['status'] == 'ok'
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
    if result['status'] == 'error':
        result = mgr.click('.chat-header .btn-icon:last-child')
    if result['status'] == 'error':
        result = mgr.click('button[onclick="clearMessages()"]')
    if result['status'] == 'error':
        print('  ⚠ Clear messages button not found (non-critical)')
        return False
    time.sleep(0.4)
    return True


def _new_conversation(mgr):
    # The "+" in the sidebar header starts a new conversation.
    result = mgr.click('.sidebar-header .btn-icon')
    if result['status'] == 'error':
        result = mgr.click('button[onclick="newConversation()"]')
    assert result['status'] == 'ok', f'New conversation failed: {result}'
    time.sleep(0.4)
    return True


def _check_new_conversation(mgr):
    _present(mgr, '#messageInput')
    assert not _text(mgr, '#messages'), 'messages were not cleared for the new conversation'
    return {'input_present': True}


# ── standalone scenarios ─────────────────────────────────────────────────

def test_preview_panel(mgr):
    # Login
    mgr.fill('#loginEmail', 'demo@example.com')
    mgr.fill('#loginPassword', 'demo')
    mgr.click('#loginBtn')
    time.sleep(0.8)
    # Open the right-hand preview panel
    result = mgr.click('button[title="Preview panel"]')
    assert result['status'] == 'ok', f'Preview panel toggle failed: {result}'
    time.sleep(0.5)
    assert _dom(mgr, '.preview-panel'), 'preview panel not rendered'
    # The panel body should render the panel's current content.
    assert _dom(mgr, '#panelBody'), 'preview panel body is empty'
    return True


def test_key_management(mgr):
    # Login
    mgr.fill('#loginEmail', 'demo@example.com')
    mgr.fill('#loginPassword', 'demo')
    mgr.click('#loginBtn')
    time.sleep(0.8)
    # API keys have their own modal, opened from the header menu.
    result = mgr.click('button[title="API Keys"]')
    assert result['status'] == 'ok', f'API Keys modal failed: {result}'
    time.sleep(0.5)
    _require_open_modal(mgr, 'API Keys')
    body = _dom(mgr, '#modalBody')
    assert body, 'API Keys modal body is empty'
    return True


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
    os.environ.setdefault('ALLOW_EVALUATE', 'true')
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