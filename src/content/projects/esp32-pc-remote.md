---
name: 'esp32-pc-remote'
order: 4
month: '2026-01'
result: 'Wakes my PC every day.'
repo: 'https://github.com/Jonathan0823/esp32-pc-remote'
tags:
  - 'C++'
  - 'ESP32'
  - 'Rust'
  - 'React'
visual:
  kind: 'diagram'
  label: 'Voice, Telegram and MQTT reach the ESP32-S3 over outbound connections; it sends a Wake-on-LAN packet to the PC'
  src: '/diagrams/esp32-pc-remote.svg'
---

An ESP32-S3 that stays on my home network and wakes my PC by voice, Telegram or MQTT, without opening a single port.

## How it works

Voice recognition runs on the board: Espressif’s ESP-SR listens for a “Jarvis” wake word and a short command, with no cloud service in the loop. The firmware, C++ on the Arduino framework, also polls a Telegram bot and subscribes to an MQTT broker. Both are outbound connections, so nothing at home is exposed.

When a command arrives, the board sends a Wake-on-LAN packet to the PC. A React dashboard talks to it over MQTT, and a small Rust daemon runs on the PC side.
