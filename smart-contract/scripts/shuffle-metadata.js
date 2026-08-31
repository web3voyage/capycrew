const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function usage() {
  console.error("Usage: node scripts/shuffle-metadata.js --input <dir> --output <dir> --seed <64-hex-chars>");
  process.exit(1);
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const inputDir = arg("--input");
const outputDir = arg("--output");
const seedHex = arg("--seed").replace(/^0x/, "");
if (!inputDir || !outputDir || !/^[0-9a-fA-F]{64}$/.test(seedHex)) usage();

const sourceFiles = fs.readdirSync(inputDir)
  .filter((name) => /^\d+\.json$/i.test(name))
  .sort((a, b) => Number.parseInt(a) - Number.parseInt(b));

if (!sourceFiles.length) throw new Error("Input directory has no numbered metadata JSON files.");

const seed = Buffer.from(seedHex, "hex");
const seedHash = crypto.createHash("sha256").update(seed).digest("hex");
const order = sourceFiles.map((_, index) => index);

function randomUint64(counter) {
  const message = Buffer.allocUnsafe(8);
  message.writeBigUInt64BE(BigInt(counter));
  return crypto.createHmac("sha256", seed).update(message).digest().readBigUInt64BE(0);
}

// Fisher-Yates with deterministic HMAC-derived entropy.
for (let i = order.length - 1, counter = 0; i > 0; i -= 1, counter += 1) {
  const j = Number(randomUint64(counter) % BigInt(i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}

fs.mkdirSync(outputDir, { recursive: true });
for (let target = 0; target < order.length; target += 1) {
  const source = path.join(inputDir, sourceFiles[order[target]]);
  const destination = path.join(outputDir, String(target + 1) + ".json");
  fs.copyFileSync(source, destination);
}

const manifest = {
  algorithm: "HMAC-SHA256 Fisher-Yates",
  count: sourceFiles.length,
  seedCommitment: "0x" + seedHash,
  sourceOrder: sourceFiles,
  shuffledSourceOrder: order.map((index) => sourceFiles[index]),
  note: "Publish seedCommitment before minting. Reveal the seed after minting closes so anyone can reproduce this order."
};
fs.writeFileSync(path.join(outputDir, "shuffle-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ ...manifest, seed: "0x" + seedHex }, null, 2));

