# 0003. License: Apache-2.0

Status: accepted

## Context

An open-source desktop app that may grow a hosted edition. Options: MIT, Apache-2.0, AGPL-3.0, GPL-3.0.

## Decision

Apache-2.0 with a NOTICE file. Contributions use inbound = outbound licensing with the Developer Certificate of
Origin (`git commit -s`); there is no CLA.

## Consequences

Simple, compatible with the dependencies (React, Electron and others are MIT), explicit patent grant. It does
not stop someone from hosting a competing service. If the hosted edition becomes the business model and that
matters, reconsider AGPL (or dual licensing with a CLA) **before accepting substantial external contributions**,
because changing license later needs every author's consent. This is not legal advice.
