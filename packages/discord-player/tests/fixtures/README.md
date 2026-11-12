The raw-stream fixture is the official v7 attachment extractor from
`packages/extractor/src/extractors/AttachmentExtractor.ts`, version 7.2.0,
in the supplied legacy checkout. It retains its validation, metadata, Track
construction, raw data, requestMetadata, file handling, and streaming methods.

Fixture changes: strict TypeScript import/probe type annotations and a non-null assertion; anonymous class/identifier and thumbnail URL; imports point to
the v8 API; the downloader and MIME dependency use deterministic offline fakes.
Optional native metadata probing remains inside the original try/catch and is
unavailable in this test. This checks real extractor code against the adapter,
not the networking, MIME library, native probe, or the complete official bundle.
The upstream MIT license is reproduced in LICENSE.
