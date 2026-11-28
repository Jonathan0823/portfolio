---
name: 'NexusBus'
order: 1
month: '2025-08'
result: 'The same design runs in production at Century Batteries.'
repo: 'https://github.com/Jonathan0823/nexusbus'
extraRepos:
  - text: 'nexusbus-mqtt-consumer'
    href: 'https://github.com/Jonathan0823/nexusbus-mqtt-consumer'
tags:
  - 'Python'
  - 'FastAPI'
  - 'Go'
  - 'Redis'
  - 'PostgreSQL'
visual:
  kind: 'diagram'
  label: 'Modbus devices → FastAPI gateway → MQTT → Go consumer → Redis Stream → PostgreSQL, with a dead-letter stream'
  src: '/diagrams/nexusbus.svg'
fromAchievement: 'modbus-mqtt-gateway'
---

An open-source rebuild of the Modbus-to-MQTT gateway I wrote at Century Batteries, in two parts: a Python gateway and a Go consumer.

## How it works

The gateway is a FastAPI service that polls Modbus TCP and RTU devices and publishes what it reads over MQTT. Device settings live in the database rather than in code.

The consumer, written in Go, puts each message on a Redis Stream and reads it back through a consumer group before writing to PostgreSQL. Every reading carries an idempotency key, so a retry after a network drop can’t store it twice. Messages that are malformed or keep failing go to a dead-letter stream instead of holding up the rest.
