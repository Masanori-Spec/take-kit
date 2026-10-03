# Security and privacy

- Untrusted WAV files are parsed with exact length/chunk/format/rate/alignment/duration/count budgets before PCM allocation
- Input: 32 MiB / 120 s; review JSON: 128 KiB; candidates: 128; included SFZ hits: 100; ZIP: 34 MiB
- Browser work uses terminate-on-cancel/replacement, a serial stale-result guard and 30-second deadline. The input cap is not a total memory cap
- Audio stays in the browser/CLI process. Runtime code has no fetch, telemetry, external scripts/fonts, microphone access or persistent storage. CSP denies connections and plugins
- The local development server binds only 127.0.0.1. It is a development convenience, not a hardened public server; serve a read-only dist directory with a proper static host for deployment
- Source metadata and names are not copied to outputs. SHA-256 values can identify known audio, so a review/manifest should not be treated as anonymization
- SFZ/ZIP paths are fixed generated safe ASCII; no user filenames, comments or free-form strings enter SFZ. All output ZIP entries are STORE with CRC32
- CLI outputs use exclusive-create and refuse overwrites. It does not extract archives or recursively scan folders
- No executable content is loaded from WAV or review JSON. Audio parsing and audition are still subject to browser/OS codec behavior
- Source-bound reviews are not tamper-resistant signatures and do not prove that listening or copyright clearance occurred
- Test/demo assets are generated synthetic audio only. No private/customer recordings or credentials belong in the repository

No authentication, cloud data service or production multi-user threat model is implemented. Sandbox bypass flags must not be used to make browser tests pass. Any browser/runtime verification blocker should be disclosed.
