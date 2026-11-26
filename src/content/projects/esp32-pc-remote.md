---
name: "esp32-pc-remote"
hook: "Wake my PC from anywhere by voice, Telegram or MQTT, with no open ports."
status: "Daily use"
role: "Solo, hardware and firmware"
order: 4
month: "2026-01"
result: "Wakes my PC every day. Open source with setup docs."
repo: "https://github.com/Jonathan0823/esp32-pc-remote"
tags:
  - "Rust"
  - "ESP32"
  - "React"
visual:
  kind: "photo"
  label: "ESP32-S3 board + React dashboard"
---

Rust firmware for an ESP32-S3 that wakes my PC from an offline voice command, a Telegram message or MQTT, with a React dashboard.

## Problem

I wanted to wake my PC from anywhere without opening ports at home.

## What I did

Firmware that listens for three kinds of triggers, plus a small dashboard.
