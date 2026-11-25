---
name: "NexusBus"
order: 1
month: "2025-08"
result: "The same design runs the gateway on the factory floor at Century Batteries."
repo: "https://github.com/Jonathan0823/nexusbus"
extraRepos:
  - text: "nexusbus-mqtt-consumer"
    href: "https://github.com/Jonathan0823/nexusbus-mqtt-consumer"
tags:
  - "Python"
  - "FastAPI"
  - "Go"
  - "Redis"
visual:
  kind: "diagram"
  label: "Modbus devices → gateway → MQTT → Redis Streams → consumer"
fromAchievement: "modbus-mqtt-gateway"
---

The open-source version of the gateway I run at work. It polls Modbus TCP and RTU devices, caches values and publishes them over MQTT, and a Go consumer keeps every reading through network drops.

## Problem

Every machine on the floor spoke Modbus a little differently, and the network drops for a few seconds at a time.

## What I did

A FastAPI gateway with database-driven config that polls TCP and RTU devices, plus a Go consumer that buffers MQTT in Redis Streams, removes duplicates and parks bad messages.

## Why open source

I rebuilt it outside work so others with the same machines don’t start from zero.
