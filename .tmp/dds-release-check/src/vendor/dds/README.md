# Vendored DDS JavaScript engine

Source: https://github.com/danvk/dds.js
Pinned commit: cb9bf826838a087d1d1a0c70dd295dbec5093800
Original file: out.js
License: Apache-2.0 (included in LICENSE)

The engine is an Emscripten build of the bridge Double Dummy Solver, distributed
by Dan Vanderkam's dds.js project. It calculates exact maximum declarer tricks
with all cards known and optimal play by both sides.

Local changes to out.js:
- Replaced its initial eval-based Module lookup with explicit module settings.
- Suppressed native diagnostic output and automatic main/exit handling.
- Selected the browser worker environment and removed unused Node/shell loaders.
- Replaced eval/source-toString based ccall/cwrap with ordinary closures for
  compatibility with production minification and restrictive content policies.
- Wrapped the legacy script in a function scope and exported the initialized
  runtime as the default ES module export.

The application calls generateDDTable via cwrap in a dedicated web worker.
The whole engine is bundled locally; analysis sends no cards to a remote service.
