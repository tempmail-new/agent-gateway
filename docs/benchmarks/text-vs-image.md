# Text vs Image Benchmark

This spike tests the "compress text into an image" idea before any product work. The current gateway request contract accepts `input` as text, so the image variant is represented as a deterministic SVG data URL containing the same words. This measures whether the idea has any value in the gateway's current transport shape; it is not a live multimodal provider benchmark.

Run it with:

```bash
make benchmark-text-image
```

The harness generates fixed `100`-word and `1000`-word samples, renders each sample into an SVG image data URL, compares the gateway's existing input-token estimate, and measures median local gateway latency through the in-process `echo` provider.

Measured locally on 2026-07-21:

| words | native estimated tokens | image data-url estimated tokens | token ratio | native median gateway ms | image median gateway ms | latency ratio |
| ----: | ----------------------: | ------------------------------: | ----------: | -----------------------: | ----------------------: | ------------: |
|   100 |                     208 |                             443 |       2.13x |                     0.63 |                    0.54 |         0.86x |
|  1000 |                    2084 |                            3727 |       1.79x |                     0.70 |                    0.70 |         1.00x |

Iterations per variant: `25`.

## Verdict

Do not build a text-as-image compression path for the current gateway. Under the current text-only API shape, the image representation is larger by estimated token cost and does not create a meaningful latency win. A future multimodal experiment would need provider-native image inputs, real provider token accounting, latency, and answer-quality checks before it should displace native text.
