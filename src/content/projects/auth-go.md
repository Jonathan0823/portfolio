---
name: 'auth-go'
order: 2
month: '2025-01'
repo: 'https://github.com/Jonathan0823/auth-go'
tags:
  - 'Go'
  - 'Gin'
  - 'PostgreSQL'
  - 'Redis'
  - 'Docker'
visual:
  kind: 'diagram'
  label: 'Login issues an access and refresh token; each refresh rotates the pair; a reused refresh token revokes its family'
  src: '/diagrams/auth-go.svg'
---

A standalone authentication service in Go. I run it next to my other projects instead of writing login again for each one.

## How it works

Passwords are hashed with Argon2id. Logging in returns a 15-minute access token and a refresh token, and every refresh swaps both for a new pair. Refresh tokens are grouped into families: if a token that was already swapped out shows up again, the service treats it as stolen and revokes the whole family.

It also handles sign-in with GitHub and Google over OAuth, and limits request rates with a fixed-window counter kept in Redis. It’s built on Gin and pgx and ships with Docker Compose.
