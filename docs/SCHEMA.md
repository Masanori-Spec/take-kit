# Review and export schema

## take-kit-review/v1

Required top-level fields:

- `schema`: exact `take-kit-review/v1`
- `sourceSha256`: lowercase 64-character hex, verified against the complete original WAV bytes when resuming/exporting
- `source`: `sampleRate`, `channels`, `frames`, each identical to parsed source
- `detection`: finite `thresholdDb` in −72..0 and `silenceMs` in 0.1..2000
- `settings`: integer `midiKey` 0..127, `gain` equal to `none` or `shared-peak`, integer `fadeInFrames` and `fadeOutFrames` each 0..floor(rate×0.05)
- `hits`: array of at most 128 objects with unique `id` matching `h\d{4}`, integer `start` ≥0, integer `end` > start and ≤source frames, boolean `included` and boolean `reviewed`

The hit array is the round-robin order. At export, 1..100 hits must be included, all included hits reviewed, and included ranges must not overlap. Fades must not overlap or exceed any included range. Valid empty/all-excluded reviews can be restored for further editing but cannot export. Audition may inspect more than 100 candidates; the mapping limit applies to export. Excluded ranges must still be valid source coordinates.

The UI clears review for edited cuts, and clears all review marks when processing changes. When shared gain is active, changing inclusion or cut ranges clears all marks because the common gain may change. Reordering or changing MIDI key does not alter exported PCM. UI/CLI do not authenticate user assertions in JSON; `reviewed` is a workflow gate, not a signature.

## take-kit-pack/v1

`manifest.json` includes engine version, input hash/metadata, coordinate convention, detector settings, processing settings and computed shared gain/input peak/target, an ordered list of output paths/ranges/frame lengths/sequence/output hashes, and an explicit untested-player notice. No timestamps or input filename are included, keeping exports reproducible and avoiding private source-name leakage.

Generated names are `instrument.sfz`, `manifest.json`, `README.txt` and `samples/hit-NNN.wav`. Consumers should retain their relative layout after extracting.
