# TakeKit

**One take. Every strike.** A small, local-first workbench that turns one PCM16 WAV recording of one instrument into reviewed WAV one-shots, a sequential round-robin SFZ, and a provenance manifest in a deterministic ZIP.

日本語 UI / English UI · shared browser/CLI engine · no runtime dependencies · no audio upload

## Why this exists

A recording of repeated percussion strikes still needs listening, deliberate boundaries, exclusions, ordering, and a usable sample mapping. TakeKit keeps that narrow process in one reviewable workflow. It does **not** claim new sound detection or SFZ mapping: Audacity already detects sound and exports labels, and Versilian Studios' Folder-to-SFZ maps prepared samples including round robins/velocity layers. See [product assessment](docs/PRODUCT.md).

## Start locally

Node.js 22+ and Python 3 are needed for all verification. The browser/CLI runtime itself uses no third-party packages. Serve from localhost or an HTTPS origin; module workers and Web Crypto need a supported browser environment. Opening `index.html` with `file://` is not supported.

```sh
npm ci --ignore-scripts
npm run check
npm run serve
# Open http://127.0.0.1:4173
```

1. Open your own WAV, or try the bundled synthetic four-strike demo
2. Adjust threshold and minimum silence if necessary
3. Select each candidate. Inspect its waveform, edit integer `[start, end)` frames, and audition the processed sound
4. Exclude unwanted hits and change their round-robin order
5. Choose one numeric MIDI key, optional shared peak gain, and explicit fade lengths
6. Mark each included hit reviewed, then export the ZIP

All processing is local. Closing/reloading loses unsaved work. Save review JSON, keep the original WAV, and resume it later; a SHA-256 check binds the review to the exact source bytes. Review JSON contains source hash/format/settings/boundaries, not the source audio. It is not a secure redaction format: hashes can fingerprint known recordings.

## CLI

```sh
node src/cli.mjs demo synthetic.wav
node src/cli.mjs analyze synthetic.wav review.json -36 80
# Review the source audio and edit review.json intentionally:
# start/end: integer frames; included/reviewed: booleans; hits array: sequence order
# Set reviewed:true on every included hit only after checking it.
node src/cli.mjs pack synthetic.wav review.json take-kit-pack.zip
```

The CLI never overwrites existing outputs. There is no automatic review bypass flag, and no source filename interpolation into SFZ/ZIP paths. UI and CLI call the same engine. CLI errors go to stderr with nonzero exit status.

## Input and processing contract

- RIFF/WAVE little-endian PCM format 1, exactly 16-bit, mono or stereo
- Sample rate 8,000–192,000 Hz; at most 32 MiB and 120 seconds
- Up to 1,024 RIFF chunks; strict declared sizes, odd-byte padding, format/data uniqueness, rate and block alignment checks
- At most 128 detected candidates; at most 100 included round robins per exported pack
- Detection uses each frame's maximum absolute channel sample; amplitude ≥ ceil(32768 × 10^(threshold dB/20)) is active
- Minimum silence separates islands. Shorter silence remains inside a candidate. Boundaries are first active frame through last active frame + 1, with no automatic pre/post-roll
- Stereo channels always share frame boundaries. Included overlaps are rejected; touching intervals are allowed
- No level change by default. Optional **one shared gain** targets a conservative −1 dBFS peak over all included raw samples, before fades; individual hits are never normalized
- Explicit linear endpoint fades, each at most 50 ms, may not overlap. One-frame fade means that endpoint is zero. Fade processing changes the edge dynamics, while shared gain preserves relative amplitudes away from fades within PCM16 rounding
- No resampling or pitch change in exported WAV. Browser audio playback may be resampled by the browser/device. No DC removal, denoising, dithering, velocity layers, loops or multi-instrument analysis

The source WAV is treated as untrusted. The parser rejects float/extensible/compressed/RF64/RIFX, truncated or oversized containers and inconsistent fields. Unknown chunks are skipped and not copied. Review errors, overlaps and clipping attempts fail rather than silently changing data.

## Output

```text
take-kit-pack.zip
  instrument.sfz
  manifest.json
  README.txt
  samples/hit-001.wav
  samples/hit-002.wav
  ...
```

`instrument.sfz` uses numeric `key=0..127`, `seq_length=1..100`, matching `seq_position`, and `loop_mode=one_shot`. No user-provided paths or strings enter the mapping. The manifest records source SHA-256, source format, exact frame ranges, order, processing, and each output WAV's SHA-256. ZIP entries use STORE, CRC32 and the fixed timestamp 1980-01-01 for reproducibility.

**SFZ player compatibility and actual MIDI playback have not been tested.** Mapping cycle/path tests are structural, not an SFZ player certification. Extract the archive before loading the SFZ, keeping the samples folder alongside it.

## Verification

```sh
npm run check                 # syntax, engine/CLI tests, static build, independent Python readback
npm run test:browser          # start npm run serve first; sandboxed Playwright Chromium
npm run package              # source ZIP + SHA-256 file manifest in ../take-kit-output
```

See [verification status](docs/VERIFICATION.md), [design](docs/ENGINE.md), [review schema](docs/SCHEMA.md), and [security](SECURITY.md). Browser test dependencies are pinned in the lockfile. The GitHub Actions workflow is supplied but a local test pass does not imply a remote workflow pass. No SFZ player or human listening comparison was conducted.

## Rights and scope

The included demo is synthesized by `makeDemo()` and contains no third-party recording. Use only audio you have the right to process and share. No customer recordings, private recordings, microphone capture, paid service, university system or patent-candidate material is included.

No project license has been selected. Public source availability does not itself grant a software license. Third-party development-tool notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
