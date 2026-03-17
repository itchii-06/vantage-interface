/**
 * test-sync.ts
 *
 * Validates the output of sync-vantage.ts.
 * Checks that required files exist and are well-formed.
 *
 * Usage:
 *   pnpm sync:test
 */

import fse from "fs-extra";
import * as fs from "fs/promises";
import * as path from "path";

const VANTAGE_DIR = path.resolve(process.cwd(), "src", "vantage");

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function check(
  label: string,
  fn: () => Promise<void>
): Promise<boolean> {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
    return true;
  } catch (err) {
    console.error(`  ❌ ${label}`);
    console.error(`     ${(err as Error).message}`);
    failed++;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n🧪 Running sync validation...\n");

  // 1. Top-level directory
  await check("src/vantage/ directory exists", async () => {
    if (!(await fse.pathExists(VANTAGE_DIR))) {
      throw new Error(
        "Directory not found — have you run `pnpm sync` first?"
      );
    }
  });

  // 2. addresses.ts
  await check("addresses.ts exists", async () => {
    const p = path.join(VANTAGE_DIR, "addresses.ts");
    if (!(await fse.pathExists(p))) throw new Error("File not found");

    const content = await fse.readFile(p, "utf8");
    if (!content.includes("auto-generated")) {
      throw new Error("Missing auto-generated header");
    }
  });

  // 3. abis/ has files
  const abisDir = path.join(VANTAGE_DIR, "abis");
  let abiFiles: string[] = [];

  await check("abis/ directory has at least one JSON", async () => {
    if (!(await fse.pathExists(abisDir))) throw new Error("abis/ not found");
    abiFiles = (await fs.readdir(abisDir)).filter((f) => f.endsWith(".json"));
    if (abiFiles.length === 0) throw new Error("No ABI JSON files found");
    console.log(`     → ${abiFiles.length} ABI file(s) found`);
  });

  // 4. Every ABI file is a valid array
  await check("All ABI files are valid arrays", async () => {
    const invalid: string[] = [];
    for (const file of abiFiles) {
      let data: unknown;
      try {
        data = await fse.readJson(path.join(abisDir, file));
      } catch {
        invalid.push(`${file} (JSON parse error)`);
        continue;
      }
      if (!Array.isArray(data)) {
        invalid.push(`${file} (not an array)`);
      }
    }
    if (invalid.length > 0) {
      throw new Error(`Invalid ABI files:\n     - ${invalid.join("\n     - ")}`);
    }
  });

  // 5. Vault.json specifically
  await check("Vault.json exists and is a non-empty ABI array", async () => {
    const vaultPath = path.join(abisDir, "Vault.json");
    if (!(await fse.pathExists(vaultPath))) {
      throw new Error(
        "Vault.json not found — check that Vault.sol was compiled"
      );
    }
    const abi: unknown = await fse.readJson(vaultPath);
    if (!Array.isArray(abi)) throw new Error("ABI is not an array");
    if (abi.length === 0) throw new Error("ABI array is empty");
    console.log(`     → ${abi.length} ABI entries`);
  });

  // 6. Smoke test — Vault ABI is importable and usable
  await check("Vault ABI smoke test (importable as array)", async () => {
    const vaultPath = path.join(abisDir, "Vault.json");
    const vault: unknown = await fse.readJson(vaultPath);

    if (!Array.isArray(vault)) {
      throw new Error("Vault ABI is not a valid array");
    }

    // Spot-check: entries should have a 'type' field (function/event/error/constructor)
    const validTypes = new Set(["function", "event", "error", "constructor", "fallback", "receive"]);
    const hasValidEntries = vault.some(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "type" in entry &&
        validTypes.has((entry as Record<string, string>).type)
    );
    if (!hasValidEntries) {
      throw new Error("ABI entries do not contain expected 'type' fields");
    }

    console.log(`     → Vault ABI is importable (${vault.length} entries)`);
  });

  // 7. types/ directory (optional — passes if typechain was not found)
  await check("types/ directory exists (if typechain was synced)", async () => {
    const typesDir = path.join(VANTAGE_DIR, "types");
    if (!(await fse.pathExists(typesDir))) {
      console.log("     → types/ not present (typechain-types was not found in source)");
      return; // non-fatal
    }

    async function countFiles(dir: string): Promise<number> {
      let n = 0;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          n += await countFiles(path.join(dir, entry.name));
        } else if (entry.name.endsWith(".ts")) {
          n++;
        }
      }
      return n;
    }

    const count = await countFiles(typesDir);
    console.log(`     → ${count} TypeScript file(s) in types/`);
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.error(
      "   Some checks failed. Run `pnpm sync` to regenerate, then try again."
    );
    process.exit(1);
  }

  console.log("   All checks passed! ✨");
}

main().catch((err: Error) => {
  console.error("\n❌ Test runner error:", err.message);
  process.exit(1);
});
