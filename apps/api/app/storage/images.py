"""Tiny, dependency-free image dimension prober (PNG / JPEG / GIF / WebP).

Reads only the header bytes — no Pillow, no full decode. Returns ``None`` for
anything it doesn't recognize (e.g. SVG, corrupt data), so callers treat metadata
as best-effort. Used on upload-complete to record ``{width, height, format}``.
"""

from __future__ import annotations

import struct


def probe_image(data: bytes) -> dict[str, int | str] | None:
    """Return ``{"width", "height", "format"}`` for a known raster image, else None."""
    if len(data) < 24:
        return None
    dims = _png(data) or _gif(data) or _webp(data) or _jpeg(data)
    if dims is None:
        return None
    width, height, fmt = dims
    return {"width": width, "height": height, "format": fmt}


def _png(data: bytes) -> tuple[int, int, str] | None:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    width, height = struct.unpack(">II", data[16:24])
    return width, height, "png"


def _gif(data: bytes) -> tuple[int, int, str] | None:
    if data[:6] not in (b"GIF87a", b"GIF89a"):
        return None
    width, height = struct.unpack("<HH", data[6:10])
    return width, height, "gif"


def _webp(data: bytes) -> tuple[int, int, str] | None:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    chunk = data[12:16]
    if chunk == b"VP8X" and len(data) >= 30:
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return width, height, "webp"
    if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
        width = int.from_bytes(data[26:28], "little") & 0x3FFF
        height = int.from_bytes(data[28:30], "little") & 0x3FFF
        return width, height, "webp"
    if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        width = (bits & 0x3FFF) + 1
        height = ((bits >> 14) & 0x3FFF) + 1
        return width, height, "webp"
    return None


def _jpeg(data: bytes) -> tuple[int, int, str] | None:
    if data[:2] != b"\xff\xd8":
        return None
    i, n = 2, len(data)
    while i + 9 < n:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        # SOF markers carry the frame dimensions (skip SOF4/8/12 = non-frame markers).
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return width, height, "jpeg"
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seg_len = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + seg_len
    return None
