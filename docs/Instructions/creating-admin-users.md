# Creating Admin Users

Admin accounts use **Supabase Auth** (email + password) and require two things to exist and be linked:
1. An **Auth user** in Supabase Authentication
2. A **profile row** in `public.profiles` with `role = 'admin'` and `auth_user_id` pointing to that auth user

These two are separate records — creating one does not automatically create the other. This is what causes the login to silently fail if you forget step 2.

---

## Step-by-Step Process

### Step 1 — Create the Auth User in Supabase

1. Open your Supabase project dashboard
2. Go to **Authentication → Users**
3. Click **"Add user"** → **"Create new user"**
4. Enter the admin's **email address** and a **secure password**
5. Click **Create User**

> Make sure **"Auto Confirm User"** is checked, or manually confirm the user afterwards. Unconfirmed users cannot sign in.

---

### Step 2 — Get the Auth User's UUID

After creating the user, find their UUID:

**Option A — from the dashboard**
On the Authentication → Users list, click the user row. The UUID is shown at the top.

**Option B — via SQL Editor**
```sql
SELECT id, email, confirmed_at
FROM auth.users
WHERE email = 'admin@example.com';
```
Copy the `id` value — this is the UUID you need.

---

### Step 3 — Insert the Profile Row

Run this in the **Supabase SQL Editor**, replacing the placeholder values:

```sql
INSERT INTO public.profiles (auth_user_id, email, contact_name, business_name, role, is_active)
VALUES (
  '<uuid-from-step-2>',
  'admin@example.com',
  'Full Name',
  'AR Steel Manufacturing',
  'admin',
  true
);
```

> **Note:** "Success. No rows returned" is the expected response for a successful INSERT. It does not mean the row was not created.

---

### Step 4 — Verify

Confirm the profile was created correctly:

```sql
SELECT id, email, role, auth_user_id, is_active
FROM public.profiles
WHERE email = 'admin@example.com';
```

You should see one row with:
- `role = admin`
- `auth_user_id` matching the UUID from Step 2
- `is_active = true`

The admin can now sign in at `/admin/login` with their email and password.

---

## Why This Is Required

The portal uses two separate authentication systems:

| User type | Auth method | How they log in |
|---|---|---|
| Buyers | Custom JWT cookie | Account number (no password) |
| Admins | Supabase Auth session | Email + password |

When an admin logs in, the code:
1. Signs in via Supabase Auth (`signInWithPassword`)
2. Takes the returned `user.id` (the auth UUID)
3. Looks up `public.profiles WHERE auth_user_id = user.id`
4. Checks `profile.role === 'admin'`

If step 3 returns no rows (because the profile row doesn't exist or `auth_user_id` is null), login fails with a generic "Invalid email or password" error — even though the password was correct.

---

## Removing Admin Access

To revoke an admin's access without deleting their account:

```sql
-- Soft disable (recommended — preserves audit trail)
UPDATE public.profiles SET is_active = false WHERE email = 'admin@example.com';

-- Or change role back to a non-admin role
UPDATE public.profiles SET role = 'buyer_default' WHERE email = 'admin@example.com';
```

You can also delete the auth user from the Supabase dashboard (Authentication → Users → Delete), which will prevent sign-in entirely.

---

## Super Admin (ADMIN_SUPER_EMAIL)

One admin email can be designated as the Super Admin, which unlocks additional controls in the UI (e.g. the Notifications/Settings sections in the sidebar).

Set this in your environment variables:

```env
# .env.local (local) or Vercel environment variables (production)
ADMIN_SUPER_EMAIL=luke@lpwebstudio.co.za
```

This email must still have a valid profile row (steps above apply). The `ADMIN_SUPER_EMAIL` variable only controls which extra UI sections are visible — it does not bypass the auth/profile requirement.
