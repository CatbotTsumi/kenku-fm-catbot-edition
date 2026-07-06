/**
 * Squirrel.Windows RELEASES must be UTF-8 without BOM.
 * electron-forge maker-squirrel can emit a BOM that breaks auto-update silently.
 */
import fs from "fs";
import path from "path";

const releasesPath = path.join(
  "out",
  "make",
  "squirrel.windows",
  "x64",
  "RELEASES",
);

if (!fs.existsSync(releasesPath)) {
  console.warn("fix-squirrel-releases: RELEASES not found, skipping");
  process.exit(0);
}

let content = fs.readFileSync(releasesPath);
if (
  content.length >= 3 &&
  content[0] === 0xef &&
  content[1] === 0xbb &&
  content[2] === 0xbf
) {
  content = content.subarray(3);
  fs.writeFileSync(releasesPath, content);
  console.log("fix-squirrel-releases: stripped UTF-8 BOM from RELEASES");
} else {
  console.log("fix-squirrel-releases: no BOM found");
}
