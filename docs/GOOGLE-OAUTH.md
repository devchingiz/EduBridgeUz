# Google sign-in configuration

EduBridge already implements Google OAuth sign-in and registration with
authorization code + PKCE, state validation, verified-email checks, and the
existing database-backed session system. Google sign-in stays unavailable until
the server-only client credentials below are configured.

## Create an OAuth client

1. In Google Cloud Console, create or select a project and configure the OAuth
   consent screen (Google Auth Platform). During testing, add the Google
   accounts that should be allowed to sign in as test users.
2. Create an OAuth client with application type **Web application**.
3. Add the matching JavaScript origin and redirect URI:

   | Environment | Authorized JavaScript origin | Authorized redirect URI                            |
   | ----------- | ---------------------------- | -------------------------------------------------- |
   | Local       | `http://localhost:3000`      | `http://localhost:3000/api/auth/google/callback`   |
   | Production  | `https://app.example.edu`    | `https://app.example.edu/api/auth/google/callback` |

   Replace `app.example.edu` with the deployed HTTPS host. The redirect URI
   must match exactly, including scheme, host, port, and path. Register each
   environment separately; do not use a wildcard callback.

## Configure the app

For local development, copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

Restart the development server after editing environment values. In production,
set `NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in the
deployment platform's configuration or secret manager. Use the same HTTPS
origin as the registered redirect URI.

`GOOGLE_CLIENT_SECRET` is server-only. Never prefix it with `NEXT_PUBLIC_`, put
it in browser code, commit it, or send it in chat. Keep separate OAuth clients
and credentials for local, preview, and production environments.

## Verify the configuration

1. Open `/login` and select **Continue with Google**.
2. Confirm Google shows the account chooser and returns to
   `/api/auth/google/callback`.
3. Confirm an existing linked account reaches `/dashboard`.
4. To test registration, use `/register`; Google sign-up also requires date of
   birth and terms acceptance. Guardian consent remains required for minors.

If credentials are absent, sign-in redirects back to the auth page with a
configuration message; email/password sign-in remains available. If Google
reports `redirect_uri_mismatch`, compare the complete callback URI above with
the URI registered on that OAuth client.
