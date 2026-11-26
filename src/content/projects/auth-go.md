---
name: "auth-go"
hook: "The login service I drop into every new project, with safe defaults."
status: "Open source"
role: "Solo"
order: 2
month: "2025-01"
result: "The login service I drop into every new project."
repo: "https://github.com/Jonathan0823/auth-go"
tags:
  - "Go"
  - "Gin"
  - "PostgreSQL"
  - "Redis"
  - "Docker"
visual:
  kind: "diagram"
  label: "login → access + refresh token → rotation → replay detection"
---

The auth service I reuse everywhere: Argon2id passwords, short-lived JWTs, rotating refresh tokens with replay detection, OAuth and rate limiting.

## Problem

Every new project needed login, and copying it each time led to mistakes.

## What I did

One service with safe defaults that I drop into new projects.
