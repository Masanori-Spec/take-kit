# Product assessment · 2026-10-03

## User problem and hypothesis

A maker recording repeated strikes of one object needs a small, inspectable path from a raw take to a sampler-ready pack. The prototype hypothesis is that keeping candidate cuts, audible review, common-level handling, round-robin order and a source-bound export record together reduces handoff mistakes. This is an engineering and workflow hypothesis, **not validated demand**, demonstrated savings or novel DSP.

## Existing products and honest difference

- **Audacity Label Sounds** already identifies sound using level thresholds and configurable silence duration, and supports sound/silence labels. TakeKit's basic detection is not new. [Official manual](https://manual.audacityteam.org/man/label_sounds.html)
- **Audacity Export Multiple** already exports separate audio files from tracks or labels. Audio cuts and batch export are not differentiators by themselves. [Official manual](https://manual.audacityteam.org/man/export_multiple.html)
- **Versilian Studios Folder-to-SFZ** maps prepared sample sets into SFZ, including round-robin/velocity-layer handling, configurable naming dictionaries and complex instrument folders. TakeKit does not claim to invent mapping or browser-based sampling. Its narrower starting point is a raw single-instrument take, followed by reviewed slicing and actual PCM WAV packaging with a small simple mapping. [Official product](https://versilian-studios.com/sfzconverter/)

TakeKit's intended distinction is the **bounded single-take → candidate → audition → exact boundary review → deterministic real WAV/SFZ/manifest handoff**. It is deliberately less capable than a DAW or general sampler editor. Whether users prefer this constrained workflow remains untested. Source comparisons were reviewed on 2026-10-03; they are not an exhaustive market or patent search.

## Scope and non-goals

One source, one instrument, one numeric key, one sequential round-robin group. No multi-key/velocity mapping, synthesis UI, MIDI keyboard, MP3, capture, DAW integration, pitch detection, upload service, rights checking, resampling or automatic artifact removal. Fade/gain are transparent operations, not mastering.

## Evidence before a business claim

A later validation would ask consenting users with their own short instrument recordings to make an equivalent pack with their current tool and TakeKit, recording setup time, boundary corrections, failure cases and successful import into their actual sampler. No participants have been contacted, no recordings collected, and no commercial validation has occurred. SFZ playback in an actual player is still an explicit verification gap.

## Protocol references

- [SFZ seq_length](https://sfzformat.com/opcodes/seq_length/) and [seq_position](https://sfzformat.com/opcodes/seq_position/): sequential round-robin configuration; TakeKit caps included hits at 100
- [SFZ key](https://sfzformat.com/opcodes/key/): numeric note 0..127 avoids differing displayed octave conventions
- [SFZ loop_mode](https://sfzformat.com/opcodes/loop_mode/): explicit `one_shot` for the intended percussive behavior

These are reference-grounded format choices. Structural tests do not establish actual player compatibility.
