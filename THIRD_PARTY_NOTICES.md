# Third-Party Notices

Gemini KeyHub includes or bundles third-party open-source software.

## gclientid

- Project: `AnswerDotAI/gclientid`
- Source: https://github.com/AnswerDotAI/gclientid
- License: Apache License 2.0
- Copyright holder / author information remains with the upstream project and its contributors.
- Gemini KeyHub invokes gclientid through a local bridge and does not claim authorship of the upstream implementation.

The Apache-2.0 license text used for gclientid is included at:

`third_party/gclientid/LICENSE`

## Integration note

Gemini KeyHub adds its own Electron UI, encrypted local credential storage, Google Cloud project/key management, Gemini authorization-key workflow, Windows portable packaging, and a small bridge that calls gclientid's public provisioning functions.

The upstream gclientid source itself is not copied into Gemini KeyHub's TypeScript source tree; the pinned upstream package is bundled into the portable Windows build as a dependency.
