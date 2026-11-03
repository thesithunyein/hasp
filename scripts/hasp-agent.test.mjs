import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(args) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [join(root, "scripts", "hasp-agent.mjs"), ...args],
      { cwd: root },
      (error, stdout, stderr) => {
        resolve({ code: error?.code ?? 0, stdout, stderr });
      },
    );
  });
}

describe("hasp-agent", () => {
  it("drops an over-cap amount before asking for a quote", async () => {
    const { code, stdout } = await run(["0.03", "name.near"]);
    assert.equal(code, 2);
    assert.match(stdout, /DROPPED/);
    assert.match(stdout, /Above 0\.02 NEAR\. Dropped\./);
    assert.doesNotMatch(stdout, /USDC/);
  });

  it("drops a malformed account before asking for a quote", async () => {
    const { code, stdout } = await run(["0.02", "not an account"]);
    assert.equal(code, 2);
    assert.match(stdout, /DROPPED/);
    assert.doesNotMatch(stdout, /USDC/);
  });
});
