# temple-backend

Backend for Temple: Bun + Express + MongoDB. User registration (with OTP) and sign-in via phone + OTP.

## Setup

```bash
bun install
```

Copy `.env.example` to `.env` and set:

- `PORT` – server port (default 3000)
- `MONGO_URI` – MongoDB connection string (default `mongodb://localhost:27017/temple`)
- `OTP_EXPIRY_MINUTES` – OTP validity in minutes (default 5)

## Run

Ensure MongoDB is running, then:

```bash
bun run index.ts
```

Server listens on `http://localhost:${PORT}`.

## Main endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/send-otp` | Send OTP to phone (body: `{ "phoneNumber": "...", "countryCode": "..." }`) |
| POST | `/auth/verify-otp` | Verify OTP (body: `{ "phoneNumber", "otp", "countryCode" }`). Success always returns `accessToken`, `expiresIn`, `userId`, `onboarding`; `user` only when `onboarding` is true. |
| POST | `/auth/login` | Deprecated; use send-otp → verify-otp (returns 400) |
| POST | `/auth/complete-onboarding` | Complete profile; requires `Authorization: Bearer <token>` (token from verify-otp). Body is profile only (no userId). |
| POST | `/users/register` | Register user (phone must be verified first) |

OTP is logged to the console in development. Phone must be verified via `/auth/verify-otp` before calling `/users/register`.

### Auth flow and complete-onboarding

1. **POST /auth/send-otp** → 2. **POST /auth/verify-otp** → 3. **POST /auth/complete-onboarding** with `Authorization: Bearer <accessToken>` from step 2. Use the token from the **same** verify-otp response.

**Important for curl:** Do **not** use `-L` (follow redirects) when calling complete-onboarding. Curl does not re-send the `Authorization` header on redirected requests, so you will get 401. Either omit `-L` for that request, or use `--location-trusted` so the header is sent after redirect. Example:

```bash
# Correct: no -L for complete-onboarding
curl 'http://localhost:3005/auth/complete-onboarding' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -F 'language="english"' \
  ...
```

Server logs for `complete-onboarding auth:` indicate why auth failed (no token, invalid token, session not found, etc.).

### API test script

Run all API tests (server and MongoDB must be up): `bun run scripts/test-api.ts` or `bun run test:api`. Set `TEST_OTP` in env if not using the default `123456`; set `BASE_URL` if the server is not at `http://localhost:3005`.

This project was created using `bun init`. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
