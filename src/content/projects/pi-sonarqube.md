---
name: 'pi-sonarqube'
order: 3
month: '2026-01'
result: 'About 1,000 downloads a month on npm.'
repo: 'https://github.com/Jonathan0823/pi-sonarqube'
package: 'https://www.npmjs.com/package/@jonathan0823/pi-sonarqube'
tags:
  - 'TypeScript'
  - 'SonarQube'
  - 'MCP'
visual:
  kind: 'diagram'
  label: 'The agent calls the sonarqube tool; it runs sonar-scanner, reads issues from the SonarQube API and returns them to the agent'
  src: '/diagrams/pi-sonarqube.svg'
---

Local SonarQube analysis for coding agents: an extension for the Pi agent, and an MCP server for Claude Code.

## How it works

It runs sonar-scanner on the project, then pulls issues, measures and duplications from the SonarQube API and hands them back as text the agent can act on. The agent gets a sonarqube tool and a /sonarqube command, so it can scan its own changes and fix what it finds before I review them.
