# Global Torque community health and workflows

This repository provides the default community-health files and reusable,
SHA-pinned workflows used by Global Torque public repositories.

Public package repositories call reusable workflows by an immutable commit
SHA. Changes to those workflows require a reviewed pull request and a caller
update; mutable branch or tag references are not accepted.

The candidate policy requires downloaded attestation bundles to be normalized
from GitHub CLI's Linux `sha512:<digest>.jsonl` filename to the portable
`sha512-<digest>.jsonl` form before verification and artifact retention.
