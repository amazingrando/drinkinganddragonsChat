# Supabase Security Actions - Completed & Pending

## ✅ Completed via MCP Tools

### 1. Fixed Function Search Path Security Issue
**Status**: ✅ FIXED  
**Migration**: `fix_function_search_path_security`

The `handle_new_user()` function has been fixed to explicitly set `search_path = public, pg_temp`. This prevents search_path injection attacks where malicious users could potentially manipulate the search_path to execute unauthorized code.

**Before**: Function had mutable search_path (security risk)  
**After**: Function explicitly sets `search_path TO 'public', 'pg_temp'` ✓

## ⚠️ Actions Required in Supabase Dashboard

These actions cannot be automated via SQL/MCP tools and must be done manually:

### 1. Enable Leaked Password Protection
**Priority**: HIGH  
**Location**: Supabase Dashboard → Authentication → Settings → Password Security

**Action**: Enable "Leaked Password Protection"  
**Why**: Prevents users from using compromised passwords by checking against HaveIBeenPwned.org

**Steps**:
1. Go to Supabase Dashboard
2. Navigate to Authentication → Settings
3. Find "Password Security" section
4. Enable "Leaked Password Protection"
5. Save changes

**Reference**: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. Configure Storage Bucket Policies
**Priority**: HIGH  
**Location**: Supabase Dashboard → Storage → Policies

**Current Status** (Verified via SQL):
- ❌ **avatars bucket**: Has public policies for SELECT, INSERT, UPDATE (anyone can access)
- ❌ **server-images bucket**: Has public policies for SELECT, INSERT, UPDATE (anyone can access)
- ⚠️ Both buckets are currently publicly accessible - anyone with a URL can read/upload files

**Action Required**: Replace public policies with authenticated-only policies:

#### Bucket: `avatars`
**Current Issues**:
- `Allow public downloads avatars` - PUBLIC role can SELECT
- `Allow public uploads avatars` - PUBLIC role can INSERT
- `Allow public updates avatars` - PUBLIC role can UPDATE

**Recommended Policies**:

#### Bucket: `avatars`
**Step 1**: Delete existing public policies:
- Delete `Allow public downloads avatars`
- Delete `Allow public uploads avatars`
- Delete `Allow public updates avatars`
- Keep `Allow authenticated deletes avatars` (this is good)

**Step 2**: Create new authenticated-only policies:
**Policy 1 - Upload**:
- Policy Name: `Authenticated users can upload avatars`
- Operation: INSERT
- Roles: authenticated
- Policy: `(bucket_id = 'avatars')`
- With Check: `(bucket_id = 'avatars') AND (auth.role() = 'authenticated')`

**Policy 2 - Read**:
- Policy Name: `Users can read their own avatars`
- Operation: SELECT
- Roles: authenticated
- Policy: `(bucket_id = 'avatars') AND ((storage.foldername(name))[1] = auth.uid()::text)`

#### Bucket: `server-images`
**Current Issues**:
- `Allow public downloads 1p8vltu_0` - PUBLIC role can SELECT
- `Allow public uploads 1p8vltu_0` - PUBLIC role can INSERT
- `Allow public updates 1p8vltu_0` and `1p8vltu_1` - PUBLIC role can UPDATE
- `Allow public deletes 1p8vltu_0` - Multiple roles can DELETE (authenticated, prisma, service_role)

**Step 1**: Delete all existing public policies for `server-images`

**Step 2**: Create new authenticated-only policies:
**Policy 1 - Upload**:
- Policy Name: `Authenticated users can upload server images`
- Operation: INSERT
- Roles: authenticated
- Policy: `(bucket_id = 'server-images')`
- With Check: `(bucket_id = 'server-images') AND (auth.role() = 'authenticated')`

**Policy 2 - Read** (Temporary - consider making bucket private):
- Policy Name: `Authenticated users can read server images`
- Operation: SELECT
- Roles: authenticated
- Policy: `(bucket_id = 'server-images') AND (auth.role() = 'authenticated')`

**⚠️ Important**: This bucket should ideally be **PRIVATE** with signed URLs for better security. Full access control should still be verified server-side using `lib/authorization.ts` helpers.

#### Bucket: `uploads`
**Status**: Not found in current policies - verify bucket exists and configure if needed

**If bucket exists, create policies**:
**Policy 1 - Upload**:
- Policy Name: `Authenticated users can upload files`
- Operation: INSERT
- Roles: authenticated
- Policy: `(bucket_id = 'uploads') AND (auth.role() = 'authenticated')`

**Policy 2 - Read**:
- Policy Name: `Authenticated users can read their uploaded files`
- Operation: SELECT
- Roles: authenticated
- Policy: `(bucket_id = 'uploads') AND (auth.role() = 'authenticated')`

**⚠️ Recommendation**: Make this bucket private and use signed URLs for file access

**Recommendation**: For `server-images` and `uploads`, consider:
1. Making buckets private
2. Using signed URLs generated server-side
3. Validating permissions before generating signed URLs (see `lib/authorization.ts`)

### 3. Review Session Configuration
**Priority**: MEDIUM  
**Location**: Supabase Dashboard → Authentication → Settings

**Actions**:
- Review JWT expiry settings
- Configure appropriate session timeout
- Enable refresh token rotation if available
- Monitor for suspicious login patterns

### 4. Set CSRF Secret Environment Variable
**Priority**: HIGH  
**Location**: Project environment variables (production)

**Action**: Set `CSRF_SECRET` environment variable to a strong random value  
**Current**: Defaults to insecure `'change-me-in-production'`  
**Recommendation**: Generate a secure random string (e.g., 32+ characters)

**How to generate**:
```bash
openssl rand -hex 32
```

## 📊 Security Advisor Summary

### Current Issues
1. ✅ **FIXED**: Function search_path mutable (`handle_new_user`)
2. ⚠️ **PENDING**: Leaked password protection disabled

### Performance Advisors
Several unused indexes detected (low priority):
- `PollOption_createdBy_idx`
- `PollVote_pollId_idx`
- `PollVote_memberId_idx`
- `ChannelReadState_channelId_idx`
- `File_serverId_idx`
- `File_channelId_idx`
- `Message_memberId_idx`

These can be reviewed and potentially removed if not needed for future queries.

## Next Steps Priority

1. **CRITICAL** (Do immediately):
   - Set `CSRF_SECRET` environment variable in production
   - Enable leaked password protection in Supabase Dashboard

2. **HIGH** (Do this week):
   - Configure storage bucket policies
   - Test CSP in development using report-only mode (see `CSP_TESTING.md`)
   - Review and adjust CSP headers for production (see `CSP_TESTING.md`)

3. **MEDIUM** (Do this month):
   - Consider implementing signed URLs for file access
   - Review unused indexes and remove if not needed

4. **ONGOING**:
   - Regular security audits
   - Monitor Supabase security advisors
   - Keep dependencies updated

