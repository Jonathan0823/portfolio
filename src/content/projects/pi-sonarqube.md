---
name: 'pi-sonarqube'
hook: 'My coding agent fixes its own SonarQube issues before I review.'
status: 'On npm'
role: 'Solo'
order: 3
month: '2026-01'
result: 'Published on npm as @jonathan0823/pi-sonarqube.'
repo: 'https://github.com/Jonathan0823/pi-sonarqube'
package: 'https://www.npmjs.com/package/@jonathan0823/pi-sonarqube'
tags:
  - 'TypeScript'
  - 'npm'
visual:
  kind: 'screenshot'
  label: 'SonarQube findings in the agent’s terminal'
---

Runs SonarQube inside the Pi coding agent, so the agent reads and fixes its own issues before I review.

## Problem

My coding agent wrote code faster than I could review it.

## What I did

A Pi extension that runs SonarQube locally and feeds the findings back to the agent.
