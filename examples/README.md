# Synthetic example

`synthetic-four-strikes.wav` is generated exclusively by `makeDemo()` in the shared engine: four decaying stereo oscillator mixtures at 24 kHz. No real instrument, voice or third-party recording is used.

`synthetic-review.json` is an unreviewed analysis result, bound to those exact WAV bytes. Review flags deliberately remain false. Open the WAV in the UI and optionally resume this JSON, then inspect, audition and mark the hits yourself.

Regenerate both in a fresh directory using the CLI `demo` and `analyze` commands from the README. The CLI refuses to overwrite the existing example files.
