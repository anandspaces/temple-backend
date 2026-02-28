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
| POST | `/auth/send-otp` | Send OTP to phone (body: `{ "phoneNumber": "..." }`) |
| POST | `/auth/verify-otp` | Verify OTP (body: `{ "phoneNumber", "otp" }`) |
| POST | `/auth/login` | Login with phone + OTP |
| POST | `/users/register` | Register user (phone must be verified first) |

OTP is logged to the console in development. Phone must be verified via `/auth/verify-otp` before calling `/users/register`.

This project was created using `bun init`. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
