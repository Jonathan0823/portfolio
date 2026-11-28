---
title: 'Software Engineer (Contract), Product Engineering'
org: 'PT Century Batteries Indonesia'
location: 'Karawang'
start: '2025-07'
end: 'present'
kind: 'work'
# shown in this order, most important first
achievements:
  - id: 'telemetry-dashboard-speedup'
    month: '2025-10'
    text: 'Got the battery telemetry dashboard, which sits on a 314-million-row table, from a five-minute load to under ten seconds.'
    tags: ['Go', 'PostgreSQL', 'Next.js']
    visual:
      kind: 'diagram'
      label: 'Raw readings roll up into a daily table; the Go API reads the rollup and downsamples raw ranges with LTTB'
      src: '/diagrams/telemetry-dashboard.svg'
    story:
      - 'The dashboard read bms_data, the raw battery telemetry table, on every load. That table has 314 million rows, and at the zoom levels people actually use, most of them add nothing to a chart. A page took about five minutes to load.'
      - 'I added a daily rollup table with one summary row per day and pointed the long date ranges at it. When a chart needs raw readings, the Go API downsamples them with LTTB first. The browser gets a few thousand points instead of millions, and the peaks and dips that an average would flatten are still there.'
      - 'I also found a duplicate index on bms_data and dropped it, which freed 6.7 GB. The dashboard now loads in under ten seconds.'
  - id: 'modbus-mqtt-gateway'
    month: '2025-08'
    text: 'Built the pipeline that reads the production devices over Modbus and delivers every reading to the database, even when the network drops for a few seconds.'
    tags: ['Python', 'Go', 'Redis', 'MQTT']
  - id: 'react-native-telemetry-app'
    month: '2026-08'
    text: 'Built a React Native app, still pre-release, that shows device telemetry over Wi-Fi, Bluetooth and MQTT, and the Arduino firmware that connects the devices to it.'
    tags: ['React Native', 'Arduino', 'MQTT']
---
