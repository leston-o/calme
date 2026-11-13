Parked while CalMe focuses on Home and Assistants (business details + live test).
These files are outside `src/` so they are not built. They still call API
endpoints that were removed (voice cloning, voice library, TTS preview, phone
numbers), so they need updating before they go back into `src/`.
