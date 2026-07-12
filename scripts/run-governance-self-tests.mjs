import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/public-package-ci.yml",
);
const workflow = readFileSync(workflowPath, "utf8");
const python = process.argv[2];

if (!python) {
  throw new Error("Usage: run-governance-self-tests.mjs <isolated-python>");
}

function extractHeredoc(startMarker, endMarker) {
  const start = workflow.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing workflow marker: ${startMarker}`);
  const contentStart = start + startMarker.length;
  const end = workflow.indexOf(endMarker, contentStart);
  if (end === -1) throw new Error(`Missing workflow terminator: ${endMarker}`);
  return workflow
    .slice(contentStart, end)
    .split("\n")
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function requireSuccess(result, label) {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

const policyScript =
  "import copy" +
  extractHeredoc(
    "          \"${policy_python}\" -I - <<'PYTHON'\n          import copy",
    "\n          PYTHON\n\n  reuse:",
  );
const dcoScript =
  "const fs" +
  extractHeredoc(
    "          node - \"${RUNNER_TEMP}/commits.json\" <<'NODE'\n          const fs",
    "\n          NODE",
  );
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "governance-self-test-"));

try {
  const fixtureRoot = resolve(temporaryRoot, "policy-repository");
  const fixtureWorkflows = resolve(fixtureRoot, ".github/workflows");
  mkdirSync(fixtureWorkflows, { recursive: true });
  cpSync(resolve(repositoryRoot, ".github/workflows"), fixtureWorkflows, {
    recursive: true,
  });
  copyFileSync(
    resolve(repositoryRoot, ".github/fixtures/candidate.yml"),
    resolve(fixtureWorkflows, "candidate.yml"),
  );
  const policyResult = run(python, ["-I", "-"], {
    cwd: fixtureRoot,
    env: { ...process.env, RUNNER_TEMP: resolve(temporaryRoot, "runner") },
    input: policyScript,
  });
  requireSuccess(policyResult, "Embedded public-package policy self-test");

  const identity = { name: "Policy Test", email: "policy@example.test" };
  const baseCommit = {
    sha: "a".repeat(40),
    commit: {
      author: identity,
      committer: identity,
    },
  };
  const runDco = (message, suffix) => {
    const commitsPath = resolve(temporaryRoot, `commits-${suffix}.json`);
    writeFileSync(
      commitsPath,
      JSON.stringify([
        [{ ...baseCommit, commit: { ...baseCommit.commit, message } }],
      ]),
    );
    return run(process.execPath, ["-", commitsPath], {
      cwd: fixtureRoot,
      input: dcoScript,
    });
  };

  requireSuccess(
    runDco(
      "Implement policy test\n\nSigned-off-by: Policy Test <policy@example.test>",
      "valid",
    ),
    "Valid terminal DCO trailer fixture",
  );

  const rejectedMessages = [
    ["subject", "Signed-off-by: Policy Test <policy@example.test>"],
    [
      "followed-body",
      "Subject\n\nSigned-off-by: Policy Test <policy@example.test>\n\nordinary body",
    ],
    ["quoted", "Subject\n\n> Signed-off-by: Policy Test <policy@example.test>"],
    [
      "fenced",
      "Subject\n\n```text\nSigned-off-by: Policy Test <policy@example.test>\n```",
    ],
    [
      "non-trailer-tail",
      "Subject\n\nSigned-off-by: Policy Test <policy@example.test>\nnot a trailer",
    ],
    [
      "mismatched",
      "Subject\n\nSigned-off-by: Different Person <different@example.test>",
    ],
  ];
  for (const [label, message] of rejectedMessages) {
    const result = runDco(message, label);
    if (result.status === 0) {
      throw new Error(`Embedded DCO policy accepted ${label} fixture`);
    }
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
