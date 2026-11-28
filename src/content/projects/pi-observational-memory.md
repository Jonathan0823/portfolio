---
name: 'pi-observational-memory'
order: 5
month: '2026-11'
repo: 'https://github.com/Jonathan0823/pi-observational-memory'
tags:
  - 'TypeScript'
visual:
  kind: 'diagram'
  label: 'Observers write a ledger; compaction folds it into a summary; a consolidator writes topic files the next session can recall'
  src: '/diagrams/pi-observational-memory.svg'
---

Long-term memory for the Pi coding agent, so what it learns in one session is still there in the next.

## How it works

Observer subprocesses read the session in chunks and record what they notice in a ledger. When the context gets large, a compaction step folds the ledger into a summary block without calling a model. A consolidator then writes it out as topic files under .memory/, which later sessions read back through a recall tool.
