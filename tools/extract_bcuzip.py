#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path

try:
    from Cryptodome.Cipher import AES
except ImportError as e:
    raise SystemExit("Cryptodome が必要です: pip install pycryptodomex") from e


def pad_len(size: int) -> int:
    return size + (16 - size % 16)


def safe_join(base: Path, rel: str) -> Path:
    rel_path = Path(rel)
    parts = [p for p in rel_path.parts if p not in (".", "")]
    out = base.joinpath(*parts).resolve()
    if not str(out).startswith(str(base.resolve())):
        raise ValueError(f"unsafe path: {rel}")
    return out


def extract_bcuzip(input_path: Path, output_dir: Path) -> None:
    data = input_path.read_bytes()
    if len(data) < 0x24:
        raise ValueError("file too small")

    key = data[0x10:0x20]
    iv = hashlib.md5(b"battlecatsultimate").digest()

    json_len = int.from_bytes(data[0x20:0x24], "little")
    json_padded = pad_len(json_len)

    json_start = 0x24
    json_end = json_start + json_padded

    if json_end > len(data):
        raise ValueError("broken json length")

    meta_raw = AES.new(key, AES.MODE_CBC, iv).decrypt(data[json_start:json_end])[:json_len]
    meta = json.loads(meta_raw.decode("utf-8"))

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "info.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    enc_files = data[json_end:]

    count = 0
    for f in meta.get("files", []):
        rel = f["path"]
        size = int(f["size"])
        offset = int(f["offset"])
        plen = pad_len(size)

        chunk = enc_files[offset:offset + plen]
        if len(chunk) != plen:
            raise ValueError(f"truncated file data: {rel}")

        plain = AES.new(key, AES.MODE_CBC, iv).decrypt(chunk)[:size]

        out_path = safe_join(output_dir, rel)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(plain)
        count += 1

    desc = meta.get("desc", {})
    print(f"extracted: {count} files")
    print(f"id: {desc.get('id')}")
    print(f"author: {desc.get('author')}")
    print(f"BCU_VERSION: {desc.get('BCU_VERSION')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract .bcuzip / BCUZip files")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    extract_bcuzip(args.input, args.output)


if __name__ == "__main__":
    main()
