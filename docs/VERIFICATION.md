# Verification status

Local verification date: 2026-10-03. Node 24.19.0 / Python 3.12.14.

## Executed locally

- `npm run check`: passed syntax/no-runtime-network-API checks, 81 Node engine/CLI/UI-lifecycle-model tests, static build, Python independent readback
- Engine/CLI cases include strict RIFF structure and malicious declared lengths; nonzero view offsets; PCM extrema; mono/stereo exact cuts; threshold and silence edges; silent/DC material; adjacent regions; channel-shared fades; clipping rejection; common-gain ratio error within one PCM LSB; source hash and review gates; safe paths; round-robin structure and deterministic ZIP
- Randomized independent oracles compare 500 exact cuts, 300 sound-island fixtures and 400 rational gain/fade fixtures
- Eight fake-DOM/Worker/audio lifecycle model cases cover late replies, Stop/background, stale file reads, cancelled exports, unapplied edits, timeout and late playback rejection; these are not real browser tests
- Maximum 32 MiB stereo input (8,388,597 frames at 96 kHz, 87.38 s) local engine benchmark: 194 ms analyze, 1,613 ms export; not a browser latency or memory guarantee
- Independent Python stdlib reads generated WAV headers and PCM words, checks stereo frame ranges/rates, verifies every ZIP CRC and output SHA-256, safe ZIP paths and mapping correspondence

The final test count and independent review outcome should be taken from the release's test log/review report; this page does not claim remote CI completed.

## Browser execution blocked locally

A sandbox-enabled Playwright Chromium launch was attempted with `/usr/bin/chromium`. Before any page or scenario ran, Chromium failed with `socket() failed: Operation not permitted`, `ptrace: Operation not permitted`, and a read-only Crash Reports path. No sandbox bypass or permissions expansion was attempted. The result is recorded at `tests/browser/artifacts/results.json` in the local working tree (excluded from the source archive unless deliberately supplied as verification evidence).

Eight scenario groups are prepared in `tests/browser/browser-test.mjs`: bilingual/keyboard/demo/waveform, audition cleanup, boundary validation, review/export/import mapping, malformed/silent inputs, cancel/stale workers, mobile layout, and off-origin request/page-error checks. These scenarios have **not** been executed successfully locally. Screenshots/UI visual quality and actual browser sound remain unverified until the authorized CI run or another permitted browser environment establishes them.

## CI supplied, not yet observed

`.github/workflows/ci.yml` includes engine checks on Node 22/24 and sandbox-enabled Chromium browser tests. It stores screenshots, downloaded ZIP/review and result JSON as artifacts. The browser runner uses Ubuntu 22.04 as a temporary compatibility baseline; its known 2027-04-17 retirement requires migration and verification before that date. A supplied workflow is not evidence of a successful remote run.

## Untested / not claimed

Actual SFZ player/DAW import and MIDI round-robin playback, listening quality with real instruments, browser/device sample-rate behavior, assistive-technology testing, and product demand. Structural SFZ tests verify intended region sequences, not a sampler implementation. No claim of patent novelty or validated time savings is made.
