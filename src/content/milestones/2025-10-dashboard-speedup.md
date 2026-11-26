---
tags:
  - "Go"
  - "PostgreSQL"
  - "Next.js"
date: "2025-10"
label: "Work"
title: "Five minutes to under ten seconds."
refs:
  - kind: "achievement"
    id: "telemetry-dashboard-speedup"
---

The one I’m proudest of. Engineers had stopped opening the dashboard because it was so slow.

#### Problem

A chart of 300 million readings took five minutes to load, so engineers stopped opening it.

#### What I did

Rebuilt the data path in Go and added LTTB downsampling, so the browser gets thousands of points, not millions.

#### Why

LTTB keeps the peaks and dips that matter on a production line. Averaging would hide them.

#### Result

Under ten seconds, about 30 times faster.
