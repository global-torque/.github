# Global Torque community health and workflows

This repository provides the default community-health files and reusable,
SHA-pinned workflows used by Global Torque public repositories.

Public package repositories call reusable workflows by an immutable commit
SHA. Changes to those workflows require a reviewed pull request and a caller
update; mutable branch or tag references are not accepted.

`public-package-ci.yml` defaults to required Node.js 22 and 24 checks plus an
informational Node.js 26 check. Callers with a narrower support policy may pass
`required-node-versions` as a JSON array and disable the informational job with
`run-node-26: false`.

The embedded candidate-workflow policy accepts the default Node.js 22/24
clean-room matrix or a Node.js 24-only matrix; both continue to require npm and
pnpm artifact verification.

The candidate policy requires downloaded attestation bundles to be normalized
from GitHub CLI's Linux `sha512:<digest>.jsonl` filename to the portable
`sha512-<digest>.jsonl` form before verification and artifact retention.
