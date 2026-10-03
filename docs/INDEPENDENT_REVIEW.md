# Independent adversarial review

Reviewed locally on 2026-10-03 in the project’s cloud workspace. This report covers the source snapshot identified below. No public write, customer contact, external audio upload, or browser sandbox bypass was performed for the review.

## Outcome

The final aggregate local check passed: **81 Node tests, static syntax/runtime-network-API scan, static application build, and independent Python WAV/ZIP readback**. A separate real FIFO-input check returned an error promptly and created no output. No unresolved implementation defect was found in the reviewed, bounded engine/CLI scope after the fixes below.

This is **not a full browser or sampler acceptance pass**. Real-browser interaction, browser sound playback, visual/accessibility behavior, and actual SFZ player/DAW import remain unverified. The UI tests added by this review execute a fake-DOM/Worker/audio state model; they do not establish browser behavior. The sandbox-enabled local Chromium attempt by the builder failed before a page ran. Remote CI results were not available to this reviewer.

## Issues found and resolved

1. **SFZ sequence overflow.** The initial implementation allowed 128 included regions, but the documented `seq_length` and `seq_position` ranges end at 100. Export now rejects 101 or more included regions while allowing up to 128 candidates to be inspected. The independently authored 100/101 boundary test verifies both sides. References: [seq_length](https://sfzformat.com/opcodes/seq_length/) and [seq_position](https://sfzformat.com/opcodes/seq_position/), accessed 2026-10-03.
2. **Late audition after Stop or backgrounding.** Stop initially cleared current audio without invalidating a pending audition worker. Stop/backgrounding now cancel pending audition, and late results cannot start playback in the state model. Existing audio is paused, cleared, and its Blob URL revoked.
3. **Stale audio-play rejection status.** A rejected pending `audio.play()` promise could overwrite the newer Stop status. A separate audio lifecycle serial now rejects stale catch handlers. The reviewer reproduced the original failure and verified the regression test passes after the fix.
4. **CLI read-budget race.** The initial stat-then-readFile flow could read beyond the cap if an input grew or was replaced. The final implementation opens one nonblocking handle, checks that handle’s metadata, reads at most the budget plus one byte, rejects overflow, and closes in `finally`. Existing output and output-symlink targets remain unchanged. An actual FIFO is rejected promptly without waiting for a writer.

The builder’s final self-audit also separated the manifest’s gain mode from its numeric `gainFactor`, restricted manifest metadata to canonical fields, and made blank numeric UI fields invalid rather than silently zero. The 81-test aggregate was rerun after these changes, including the manifest regression.

A suspected trailing-newline regex issue was investigated and disproved for the original JavaScript non-multiline expression. It was not a confirmed vulnerability. Negative regression tests remain; strict string/end checks provide additional input hardening.

## Independently authored evidence

`tests/adversarial-independent.test.mjs` adds eight tests:

- Manually assembled stereo RIFF input, including data before format and an odd padded unknown chunk; neither the production encoder nor parser constructs the expected exported PCM
- Independent central-directory/local-header ZIP readback with a separate table-based CRC implementation; minimal PCM header/word inspection, SHA-256, fixed timestamps, entry order, and SFZ path/position correspondence
- Reversed hit order and exclusions, including an excluded high-amplitude region that must not set shared gain
- Exact stereo frame slicing with negative full scale and positive full scale; positive/negative half-away quantization cases; negative-gain rejection
- **300 deterministic randomized detection fixtures** checked against active-frame index/gap grouping, rather than a duplicate of the production streaming loop
- **400 deterministic randomized gain/fade fixtures** checked against a BigInt rational oracle, allowing at most one PCM quantization unit of floating-point boundary difference, with exact fade endpoint and conservative no-clipping assertions
- Documented SFZ maximum boundary and deterministic repeat export
- CLI invalid numeric arguments, directory and review-size rejection, no-overwrite/symlink-target preservation, and hostile identifier/path rejection

`tests/ui-lifecycle-unit.test.mjs` adds eight isolated state-model tests:

- Stop during pending audition and forcibly delivered stale worker result
- Backgrounding during pending audition and cleanup of existing audio
- Cancelled analysis cannot resurrect the workbench
- Newer file selection supersedes an older asynchronous file read
- Processing edit cancels a pending export before download
- Unapplied/applied boundary edits invalidate export review
- Timeout discards a late result and permits new work
- Late audio-play rejection cannot overwrite Stop status

The existing suite additionally covers strict RIFF formats/chunk bounds, source/hash/review validation, silence edges, resource limits, fades, overlaps, path controls, 500 direct-array exact-cut fixtures, and independent Python `wave`/`struct`/`zipfile` readback. These were rerun as part of the 81-test aggregate rather than inferred from earlier logs.

## Remaining verification gates

- Run the prepared sandbox-enabled browser scenarios in a permitted browser environment and inspect screenshots, downloads, actual cancellation behavior, and audio playback
- Import the generated SFZ and extracted WAV files into an actual SFZ player and verify complete one-shot playback plus the intended 1..N round-robin cycle
- Perform real-instrument listening and user workflow validation before claiming sound quality, compatibility, demand, or saved time

The prototype describes these limitations. Structural mapping checks alone cannot prove how a sampler implements SFZ.

## Reproduction

Run `npm ci --ignore-scripts`, then `npm run check`. The browser workflow is separate: build/serve the static app and run `npm run test:browser` only in an environment that supports sandboxed Chromium. Do not disable its sandbox to convert an environment failure into a nominal pass.

## Reviewed source identity

- `src/engine.mjs`: SHA-256 `0ca12d15a0398ec6be3604f2387cf219dc71927501d0d03698f148cadc2db517`

- `src/cli.mjs`: SHA-256 `6d79129888bb4ff67d0ad2f51c14008402ee217d6ad7782dd63df9ab89eb3074`

- `web/app.mjs`: SHA-256 `bdb973f1b9da03931079696e45bb56161ec42965307118db296e3aa33cc525cf`

- `web/worker.mjs`: SHA-256 `e7a475edf956b6b29c1110f7218999d44c62c2582947466c0c2344848daa577b`

- `tests/adversarial-independent.test.mjs`: SHA-256 `3d24b0cbe9838fd3eca898dbaeaaa883975cf21b1b4a6c6ae58be91e5e2e81e0`

- `tests/ui-lifecycle-unit.test.mjs`: SHA-256 `ef7a9e87f5ca6b61af0ed8ad07c447c4a4338ad84deb904c76e38d9d430ef5a9`
