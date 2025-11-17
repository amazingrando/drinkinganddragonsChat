# Supabase Security Configuration Guide

This document provides instructions for configuring Supabase-specific security settings that cannot be implemented in code.

## Storage Bucket Policies

### Current Status
Storage buckets (`avatars`, `server-images`, `uploads`) are currently public. Anyone with a URL can access files.

### Recommended Configuration

#### 1. Avatars Bucket
**Policy Name**: `Authenticated users can upload avatars`
- **Operation**: INSERT
- **Policy**: `(bucket_id = 'avatars') AND (auth.role() = 'authenticated')`

**Policy Name**: `Users can read their own avatars`
- **Operation**: SELECT
- **Policy**: `(bucket_id = 'avatars') AND ((storage.foldername(name))[1] = auth.uid()::text)`

#### 2. Server-Images Bucket
**Policy Name**: `Authenticated users can upload server images`
- **Operation**: INSERT
- **Policy**: `(bucket_id = 'server-images') AND (auth.role() = 'authenticated')`

**Policy Name**: `Users can read images from servers they're members of`
- **Operation**: SELECT
- **Policy**: This requires a database check - consider using a server-side endpoint instead of public URLs
- **Alternative**: Use private bucket with signed URLs (see below)

#### 3. Uploads Bucket
**Policy Name**: `Authenticated users can upload files`
- **Operation**: INSERT
- **Policy**: `(bucket_id = 'uploads') AND (auth.role() = 'authenticated')`

**Policy Name**: `Users can read files they have access to`
- **Operation**: SELECT
- **Policy**: Similar to server-images, requires database verification
- **Recommendation**: Use private bucket with signed URLs

### Steps to Configure
1. Go to Supabase Dashboard → Storage → Policies
2. Select the bucket (`avatars`, `server-images`, or `uploads`)
3. Click "New Policy"
4. Create policies as described above
5. Save and test

### Alternative: Private Buckets with Signed URLs
For better security, consider:
1. Making buckets private
2. Creating server-side endpoints that validate permissions
3. Generating signed URLs for file access
4. See `lib/authorization.ts` for permission checking patterns

## Realtime Channel Security

### Current Implementation
- Realtime channels use predictable names: `chat:{channelId}:messages`
- Channels are created via server-side broadcasts (service role)

### Recommendations
1. Verify channels are not publicly subscribable
2. Ensure channel subscriptions require authentication
3. Consider adding channel membership checks before allowing subscriptions
4. Review Realtime RLS policies if using Postgres channels

### Implementation Notes
- Current broadcast implementation uses service role key (server-side only) ✓
- Channel names are predictable but scoped to authenticated users via API
- No direct client subscriptions to database tables (good)

## Service Role Key Security

### Current Usage
- Service role key is used in `lib/supabase/server-broadcast.ts`
- This is correct - server-side only

### Verification Checklist
- [x] Service role key never used in client-side code
- [x] Service role key only in server-side files
- [ ] Documented that `SUPABASE_SERVICE_ROLE_KEY` must never be exposed

### Additional Recommendations
1. Rotate service role key periodically
2. Use least-privilege service role operations
3. Monitor service role key usage in Supabase dashboard
4. Consider creating a separate service role with limited permissions if possible

## Row Level Security (RLS)

### Current Status
- **Not in use** - Application uses Prisma ORM
- All security is implemented at the application layer

### Implications
- Authorization checks must be comprehensive in code
- Cannot rely on database-level RLS
- All queries should verify permissions before execution

### Migration Considerations
If migrating to use Supabase Postgres client for RLS:
1. Define RLS policies in Supabase dashboard
2. Enable RLS on all tables
3. Update application code to use Supabase client where appropriate
4. Maintain application-level checks as defense-in-depth

## Environment Variables

### Required Supabase Variables
```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> # Server-side only!
```

### Security Notes
- `NEXT_PUBLIC_*` variables are exposed to the client (by design)
- Service role key should never have `NEXT_PUBLIC_` prefix
- Store service role key securely in production
- Rotate keys periodically

## Session Configuration

### Supabase Auth Cookies
Supabase SSR library handles cookie security automatically:
- `httpOnly`: Set automatically for auth cookies
- `secure`: Enabled in production
- `sameSite`: Configured for CSRF protection

### Recommendations
1. Review session timeout settings in Supabase Dashboard → Auth → Settings
2. Configure appropriate JWT expiry times
3. Consider implementing refresh token rotation
4. Monitor for suspicious login patterns

## Security Issues Fixed via MCP

### ✅ Function Search Path Security (FIXED)
- **Issue**: `handle_new_user()` function had mutable search_path
- **Fix**: Applied migration to set explicit `search_path = public, pg_temp`
- **Migration**: `fix_function_search_path_security`
- **Status**: ✅ Resolved

## Next Steps

1. **Immediate** (Manual Dashboard Actions Required):
   - Enable leaked password protection in Supabase Dashboard
   - Configure storage bucket policies (see `SUPABASE_SECURITY_ACTIONS.md`)
   - Set `CSRF_SECRET` environment variable in production

2. **Short-term**: Implement signed URLs for file access (see `lib/authorization.ts`)
3. **Medium-term**: Review and tighten CSP policy for production
4. **Ongoing**: Regular security audits and dependency updates

**See `SUPABASE_SECURITY_ACTIONS.md` for detailed action items.**

