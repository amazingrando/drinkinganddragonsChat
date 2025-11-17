# Content Security Policy (CSP) Testing Guide

This guide explains how to test and debug Content Security Policy (CSP) in your application.

## Overview

The application uses environment-based CSP policies:
- **Development**: More permissive policies for easier debugging
- **Production**: Strict policies with nonce support for maximum security

## Testing CSP in Development

### 1. Enable CSP Report-Only Mode

CSP Report-Only mode allows you to test CSP policies without blocking content. Violations are reported but not enforced.

**Step 1**: Create or update `.env.local`:
```bash
NEXT_PUBLIC_CSP_REPORT_ONLY=true
```

**Step 2**: Restart your development server:
```bash
npm run dev
```

**Step 3**: Check the browser console for CSP violation reports. You'll see messages like:
```
Content Security Policy: The page's settings blocked the loading of a resource
```

**Step 4**: Check server logs for CSP violation reports (they're sent to `/api/csp-report`).

### 2. Monitor CSP Violations

**Browser Console**:
- Open DevTools → Console
- Look for CSP violation warnings
- These appear in yellow/red depending on severity

**Network Tab**:
- Open DevTools → Network
- Filter by "csp-report"
- Click on requests to `/api/csp-report` to see violation details

**Server Logs**:
- CSP violations are logged to the server console when `NEXT_PUBLIC_CSP_REPORT_ONLY=true`
- Format: `[CSP VIOLATION] { violation details }`

### 3. Testing Production CSP Locally

To test production CSP locally:

**Step 1**: Build the application:
```bash
npm run build
```

**Step 2**: Start production server:
```bash
npm start
```

**Step 3**: Test with production CSP (note: nonces are required in production mode)

## Understanding CSP Violations

### Common Violation Types

1. **script-src violations**:
   - Inline scripts without nonce
   - External scripts from blocked domains
   - `eval()` or `new Function()` calls (blocked by `'unsafe-eval'`)

2. **style-src violations**:
   - Inline styles without nonce
   - External stylesheets from blocked domains

3. **connect-src violations**:
   - XHR/fetch requests to blocked domains
   - WebSocket connections to blocked domains

4. **img-src violations**:
   - Images loaded from blocked domains
   - Data URIs (if not allowed)

5. **font-src violations**:
   - Web fonts from blocked domains

### Reading Violation Reports

CSP violation reports include:
```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "violated-directive": "script-src 'self'",
    "blocked-uri": "https://evil.com/script.js",
    "source-file": "https://example.com/page",
    "line-number": 42,
    "column-number": 10
  }
}
```

## Fixing Common CSP Issues

### Issue: Inline Script Blocked

**Problem**: Inline `<script>` tags are blocked.

**Solution**: 
1. Move script to external file, OR
2. Add nonce to script tag: `<script nonce={nonce}>`
3. In Next.js, use `next/script` component which handles nonces automatically

### Issue: External Script Blocked

**Problem**: Script from external domain is blocked.

**Solution**: 
1. Add domain to `script-src` in `lib/csp.ts`
2. Use `'strict-dynamic'` if scripts are dynamically loaded

### Issue: WebSocket Connection Blocked

**Problem**: WebSocket (`wss://`) connections fail.

**Solution**: 
1. Add domain to `connect-src` in `lib/csp.ts`
2. Ensure both `https://` and `wss://` are included

### Issue: Inline Styles Blocked

**Problem**: Inline `<style>` tags or `style=""` attributes blocked.

**Solution**: 
1. Move styles to external CSS file
2. Use CSS-in-JS library that supports nonces
3. Add `'unsafe-inline'` to `style-src` (less secure but sometimes necessary)

### Issue: External Resources Blocked

**Problem**: Images, fonts, or other resources from external domains blocked.

**Solution**: 
1. Add domain to appropriate directive in `lib/csp.ts`
2. Use relative URLs when possible
3. Consider using a CDN that's already whitelisted

## Gradual CSP Implementation

### Phase 1: Report-Only Mode
1. Set `NEXT_PUBLIC_CSP_REPORT_ONLY=true`
2. Monitor violations for 1-2 weeks
3. Fix all violations

### Phase 2: Enforced CSP
1. Remove `NEXT_PUBLIC_CSP_REPORT_ONLY` or set to `false`
2. Deploy with enforced CSP
3. Monitor for any unexpected blocks

### Phase 3: Nonce-Based CSP
1. Ensure nonces are properly injected
2. Remove `'unsafe-inline'` and `'unsafe-eval'` from script-src
3. Test thoroughly

## Testing Checklist

Before deploying CSP to production:

- [ ] Test in development with report-only mode
- [ ] Fix all CSP violations
- [ ] Test in production build locally
- [ ] Verify all third-party integrations work (Supabase, LiveKit, etc.)
- [ ] Check that WebSocket connections work
- [ ] Verify file uploads work
- [ ] Test authentication flows
- [ ] Check all pages load correctly
- [ ] Verify dynamic content (polls, messages) load correctly
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)

## Browser CSP Testing Tools

### Chrome DevTools
1. Open DevTools → Console
2. Filter by "CSP" to see only CSP-related messages
3. Check Network tab for `/api/csp-report` requests

### Firefox DevTools
1. Open DevTools → Console
2. CSP violations appear with orange warning icon
3. Click to see full violation details

### Safari Web Inspector
1. Open Web Inspector → Console
2. CSP violations appear as warnings
3. Click for detailed information

## Advanced: CSP Monitoring

For production monitoring, consider:

1. **Sentry**: Set up CSP violation tracking
2. **DataDog/New Relic**: Log CSP violations as events
3. **Custom Analytics**: Track violation frequency and patterns
4. **Alerts**: Set up alerts for critical violations (XSS attempts, etc.)

## Example: Testing Supabase Realtime

To verify Supabase Realtime WebSocket connections work:

1. Open DevTools → Network
2. Filter by "WS" (WebSocket)
3. Look for connection to `wss://*.supabase.co`
4. Should see successful upgrade to WebSocket
5. Check Console for any CSP violations related to `connect-src`

## Example: Testing LiveKit

To verify LiveKit works:

1. Navigate to a channel with video/audio
2. Open DevTools → Network
3. Verify connections to `https://*.livekit.cloud` and `wss://*.livekit.cloud`
4. Check that media elements load correctly
5. Verify no CSP violations in Console

## Troubleshooting

### CSP Header Not Applied
- Check middleware matcher excludes the route
- Verify middleware is running
- Check response headers in Network tab

### Nonce Not Working
- Verify nonce is set in request headers
- Check that Next.js script components use nonces
- Ensure nonce is passed to inline scripts

### Too Many Violations
- Start with report-only mode
- Fix violations gradually
- Consider relaxing policies temporarily, then tightening

## Resources

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/) - Tool to test CSP policies
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

