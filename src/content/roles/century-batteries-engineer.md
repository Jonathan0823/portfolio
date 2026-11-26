---
title: "Software Engineer (Contract), Product Engineering"
org: "PT Century Batteries Indonesia"
location: "Karawang"
start: "2025-07"
end: "present"
kind: "work"
achievements:
  - id: "telemetry-dashboard-speedup"
    month: "2025-10"
    text: "Cut a 300M-point telemetry dashboard from five minutes to under ten seconds, about 30× faster."
    tags: ["Go","PostgreSQL","Next.js"]
    visual:
      kind: "screenshot"
      label: "telemetry dashboard"
    detail:
      problem: "A chart of 300 million readings took five minutes to load, so engineers stopped opening it."
      did: "Rebuilt the data path in Go and added LTTB downsampling, so the browser gets thousands of points, not millions."
      why: "LTTB keeps the peaks and dips that matter on a production line. Averaging would hide them."
      result: "Under ten seconds, about 30 times faster."
  - id: "modbus-connector"
    month: "2025-11"
    text: "Built a reusable Python Modbus connector for collecting data from different industrial IoT devices."
    tags: ["Python","Modbus"]
  - id: "modbus-mqtt-gateway"
    month: "2025-08"
    text: "Built the Modbus-to-MQTT gateway and a Redis Streams pipeline that keeps every reading through network drops."
    tags: ["Python","Go","Redis","MQTT"]
---


