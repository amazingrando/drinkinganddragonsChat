# Security Documentation

This document outlines security measures implemented in the application.

## Authentication & Authorization

### Authentication
- Uses Supabase Auth for authentication with secure cookie-based sessions
- All authenticated endpoints verify user identity via `currentProfile()`
- Session cookies are automatically secured by Supabase SSR library

### Authorization
- Server membership checks before accessing channels/messages
- Resource ownership verification for modifications
- Role-based access control (ADMIN, MODERATOR, MEMBER)
- Helper functions in `lib/authorization.ts` for consistent checks

## API Security

### Rate Limiting
- Implemented in `lib/rate-limit.ts`
- Strict limits for authentication endpoints (5 requests per 15 minutes)
- Moderate limits for write operations (30 requests per minute)
- Lenient limits for read operations (100 requests per minute)
- Rate limiting applied to critical endpoints

### CSRF Protection
- Implemented in `lib/csrf.ts`
- CSRF tokens required for state-changing operations (POST, PATCH, DELETE, PUT)
- Token generation endpoint: `/api/csrf-token`
- Public endpoints excluded from CSRF checks

### Input Validation
- Zod schema validation for all request bodies
- Validation schemas in `lib/validation.ts`
- UUID format validation for IDs
- File upload validation (MIME types, size limits, path sanitization)

### Error Handling
- Generic error messages returned to clients
- Detailed errors logged server-side only
- No sensitive information leaked in error responses

## File Upload Security

### Validation
- Server-side MIME type validation
- File size limits (10MB default)
- Path traversal prevention
- File name sanitization
- Allowed file extensions and types enforced

### Storage Security
- Files validated before database entry
- Authorization checks before file access/deletion
- Server membership required for server/channel files

## Security Headers

Applied via middleware:
- `Strict-Transport-Security`: Enforces HTTPS
- `X-Frame-Options`: Prevents clickjacking
- `X-Content-Type-Options`: Prevents MIME type sniffing
- `X-XSS-Protection`: XSS protection
- `Referrer-Policy`: Controls referrer information
- `Content-Security-Policy`: Restricts resource loading
- `Permissions-Policy`: Limits browser features

## Session Security

### Supabase Session Configuration
- Cookies managed by Supabase SSR library
- Automatic secure flag in production
- SameSite protection
- Session refresh handled automatically

### Recommendations
1. Ensure `CSRF_SECRET` environment variable is set (defaults to insecure value)
2. Review CSP policy and adjust for production needs
3. Monitor session timeout settings in Supabase dashboard
4. Implement proper logout with token invalidation

## Database Security

### Prisma vs Supabase RLS
- Currently using Prisma ORM which bypasses Supabase Row Level Security (RLS)
- All authorization checks must be implemented at the application layer
- Authorization helpers provide consistent access control patterns

### Future Considerations
- Consider migrating to Supabase Postgres client if RLS benefits are needed
- Document all authorization checks comprehensively
- Regular security audits of authorization logic

## Environment Variables

Required secure environment variables:
- `CSRF_SECRET`: Secret for CSRF token signing (must be set in production)
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side only, never exposed to client
- `DATABASE_URL`: Database connection string
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`: Video/audio service credentials

## Supabase Storage Security

### Current Configuration
- Storage buckets are currently public
- Files accessible via public URLs

### Recommendations (To be implemented in Supabase Dashboard)
1. Configure bucket policies:
   - `avatars`: Authenticated users can upload, read own files only
   - `server-images`: Authenticated users can upload, read files for servers they're members of
   - `uploads`: Restrict based on access patterns
2. Add authentication requirements to buckets
3. Set bucket-level file size limits
4. Consider using private buckets with signed URLs for sensitive files
5. See `lib/authorization.ts` for permission checking patterns

## Rate Limiting

Current implementation uses in-memory storage. For production:
- Consider using Redis for distributed rate limiting
- Adjust limits based on usage patterns
- Monitor rate limit violations

## Security Best Practices

1. Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side
2. Always validate user input with Zod schemas
3. Use authorization helpers instead of inline checks
4. Log security events for monitoring
5. Regularly review and update security headers
6. Keep dependencies up to date
7. Conduct security audits regularly

