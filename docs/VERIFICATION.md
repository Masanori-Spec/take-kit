# Verification status

Local verification date: 2026-10-03. Node 24.19.0 / Python 3.12.14.

## Executed locally

- `npm run check`: passed syntax/no-runtime-network-API checks, 81 Node engine/CLI/UI-lifecycle-model tests, static build, Python independent readback
- Engine/CLI cases include strict RIFF structure and malicious declared lengths; nonzero view offsets; PCM extrema; mono/stereo exact cuts; threshold and silence edges; silent/DC material; adjacent regions; channel-shared fades; clipping rejection; common-gain ratio error within one PCM LSB; source hash and review gates; safe paths; round-robin structure and deterministic ZIP
- Randomized independent oracles compare 500 exact cuts, 300 sound-island fixtures and 400 rational gain/fade fixtures
- Eight fake-DOM/Worker/audio lifecycle model cases cover late replies, Stop/background, stale file reads, cancelled exports, unapplied edits, timeout and late playback rejection; these are not real browser tests
- Maximum 32 MiB stereo input (8,388,597 frames at 96 kHz, 87.38 s) local engine benchmark: 194 ms analyze, 1,613 ms export; not a browser latency or memory guarantee
- Independent Python stdlib reads generated WAV headers and PCM words, checks stereo frame ranges/rates, verifies every ZIP CRC and output SHA-256, safe ZIP paths and mapping correspondence

These local results are separate from the successful remote CI and downloaded-artifact checks below.

## Browser execution blocked locally

A sandbox-enabled Playwright Chromium launch was attempted with `/usr/bin/chromium`. Before any page or scenario ran, Chromium failed with `socket() failed: Operation not permitted`, `ptrace: Operation not permitted`, and a read-only Crash Reports path. No sandbox bypass or permissions expansion was attempted. The result is recorded at `tests/browser/artifacts/results.json` in the local working tree (excluded from the source archive unless deliberately supplied as verification evidence).

Eight scenario groups are prepared in `tests/browser/browser-test.mjs`: bilingual/keyboard/demo/waveform, audition cleanup, boundary validation, review/export/import mapping, malformed/silent inputs, cancel/stale workers, mobile layout, and off-origin request/page-error checks. These scenarios have **not** been executed successfully locally. They subsequently passed in the sandbox-enabled CI run below. Automated audition lifecycle checks establish browser behavior, not audible quality.

## Remote CI and downloaded artifacts verified

[Run 37145506490](https://github.com/Masanori-Spec/take-kit/actions/runs/37145506490), source commit `495500031b74bd965a90bd81a628dafd4eff7353`, completed successfully on 2026-10-03:

- Node 22 and Node 24: syntax checks, all 81 tests, static build, and independent Python readback
- Chromium 141 with sandbox enabled on Ubuntu 22.04: all eight browser scenario groups passed
- No page errors or off-origin requests in those scenarios
- Downloaded artifact SHA-256 matched GitHub's reported digest: `ae2482bb6e1e3939b1e789910efa33361331618f642b8e31b6dfadbca81cffaf`
- Actual desktop 1440px and mobile 390px screenshots were inspected; controls, waveform, boundaries and export section were readable without obvious clipping
- Actual downloaded browser pack contained the intended three reordered hits and excluded the fourth. An independent Python `wave`/`zipfile`/rational-arithmetic readback checked all **28,926 PCM words**, shared gain, endpoint fades, frame counts, stereo/rate headers, ZIP CRCs, fixed dates, per-WAV hashes and SFZ path/sequence correspondence

The browser pack SHA-256 is `67d69756165829b3555d9ec3e266e5366e6cf7227d9778ab4fb62a9d7ac2ae18`. Evidence is retained under [docs/ci](ci/): screenshots, the actual ZIP/review JSON, browser results, and independent readback results. Recheck the saved exported bytes with `python3 scripts/check-browser-export.py`.

The browser runner uses Ubuntu 22.04 as a temporary compatibility baseline; its known 2027-04-17 retirement requires migration and verification before that date. The CI log also warns that v4 actions target Node 20 and were forced to Node 24; the jobs passed, but action major-version migration remains maintenance work. A benign parallel npm-cache save collision did not affect verification.

The screenshots and export belong to the exact source commit above. Later evidence-only commits do not retroactively change that provenance. Automated audio-element behavior and PCM checks are not a listening test or proof of SFZ player interoperability.

## Untested / not claimed

Actual SFZ player/DAW import and MIDI round-robin playback, listening quality with real instruments, browser/device sample-rate behavior, assistive-technology testing, and product demand. Structural SFZ tests verify intended region sequences, not a sampler implementation. No claim of patent novelty or validated time savings is made.
