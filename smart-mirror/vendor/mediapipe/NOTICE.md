# Third-party files

These files are copied unchanged from official sources, so the mirror works offline.
The only edit: the `//# sourceMappingURL` line was removed from `vision_bundle.mjs`,
because the map file is not shipped.

| File | Source | Licence |
|---|---|---|
| `vision_bundle.mjs`, `wasm/vision_wasm_internal.js`, `wasm/vision_wasm_internal.wasm` | npm package `@mediapipe/tasks-vision@1.2.3` | Apache License 2.0 |
| `models/face_landmarker.task` | `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` | Apache License 2.0 |

Copyright Google LLC. Full licence text: https://www.apache.org/licenses/LICENSE-2.0

To update MediaPipe: download the new package (`npm pack @mediapipe/tasks-vision@<version>`),
replace the three files above, and change the version in this table.
