# Notice

Hudson
Copyright 2026 Arach Tchoupani

Third-party material Hudson depends on that carries its own terms. Hudson's own
code is licensed under [Apache-2.0](./LICENSE.md); nothing below changes that,
and nothing below is legal advice — the licenses linked here are the authority.

## Speech recognition model — HudsonVoice

`HudsonVoice` (`packages/native/apple/HudsonKit/Sources/HudsonVoice/`) does
on-device dictation through **Vox** (`VoxEngine`), which `HudDictation` drives
via `EngineManager`. No model data is embedded at build time: depending on
`HudVoiceModelDownloadPolicy`, Vox downloads roughly 460 MB of Parakeet weights
onto the user's device at runtime. Three layers, three owners:

**Model — [nvidia/parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
— NVIDIA — [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).**
A 600M-parameter FastConformer encoder with a TDT decoder, built with NVIDIA
NeMo and trained on the Granary corpus. Attribution is a condition of CC-BY-4.0.

**Weights — [FluidInference/parakeet-tdt-0.6b-v3-coreml](https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml)
— FluidInference — [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).**
The Core ML conversion of the NVIDIA model — the artifact Vox actually fetches
(`Preprocessor`, `Encoder`, `Decoder`, `JointDecisionv3` `.mlmodelc` bundles plus
the vocabulary). FluidInference supplies the weights, not the runtime.

**Runtime — [Vox](https://github.com/arach/vox) (`VoxEngine`).**
Downloads, caches, and runs the Core ML model on-device. The inference code is
Vox's own; no third-party ASR runtime is involved. Consult the repository for
its terms.

Apps that ship `HudsonVoice` cause the same weights to be downloaded on their
users' devices, so the CC-BY-4.0 attribution condition reaches them too. Credit
NVIDIA, FluidInference, and Vox wherever you credit the rest of your
dependencies — `HudsonVoiceSettingsView` carries the same three names on-screen.
