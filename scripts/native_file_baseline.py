#!/usr/bin/env python3
"""Read-only literal-token Markdown search/read baseline backed by ripgrep."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import re
import shutil
import stat
import subprocess
import sys
import time
from pathlib import Path, PurePosixPath
from typing import Any


POLICY = {
    "name": "ripgrep-literal-token-v1",
    "queryTokenization": "Python Unicode \\w+ runs after casefold; unique tokens keep first-seen order",
    "stopwords": "none",
    "matching": "OR across tokens; ripgrep fixed-string, case-insensitive, Unicode word-boundary matching",
    "candidateOrder": "POSIX relative path ascending by Python Unicode code-point order; query order does not rank",
    "files": "lowercase .md files under corpus; hidden and ignored files included; ripgrep does not follow symlinks",
}
DEFAULT_TIMEOUT_SECONDS = 30.0
MAX_TIMEOUT_SECONDS = 120.0
RG_GLOB = "*.md"


class BaselineError(Exception):
    def __init__(self, code: str, message: str, native_calls: list[dict[str, Any]] | None = None):
        super().__init__(message)
        self.code = code
        self.native_calls = native_calls or []


def _validate_timeout(timeout_seconds: float) -> float:
    if isinstance(timeout_seconds, bool) or not isinstance(timeout_seconds, (int, float)):
        raise BaselineError("invalid-timeout", "timeout_seconds must be a finite number in (0, 120].")
    timeout = float(timeout_seconds)
    if not math.isfinite(timeout) or timeout <= 0 or timeout > MAX_TIMEOUT_SECONDS:
        raise BaselineError("invalid-timeout", "timeout_seconds must be a finite number in (0, 120].")
    return timeout


def _resolve_root(corpus: str | os.PathLike[str]) -> Path:
    try:
        root = Path(corpus).resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise BaselineError("invalid-corpus", "Corpus directory does not resolve to an existing directory.") from exc
    if not root.is_dir():
        raise BaselineError("invalid-corpus", "Corpus path must be a directory.")
    return root


def _resolve_rg(rg_executable: str | os.PathLike[str] | None = None) -> str:
    candidate = os.fspath(rg_executable) if rg_executable is not None else "rg"
    executable = shutil.which(candidate)
    if executable is None:
        raise BaselineError("ripgrep-unavailable", "The installed ripgrep executable (rg) was not found on PATH.")
    return str(Path(executable).resolve())


def _run_native(argv: list[str], timeout: float) -> dict[str, Any]:
    started = time.monotonic()
    try:
        child = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               timeout=timeout, check=False, shell=False)
        elapsed = time.monotonic() - started
    except subprocess.TimeoutExpired as exc:
        elapsed = time.monotonic() - started
        call = {
            "argv": argv,
            "returncode": None,
            "stdoutBytes": len(exc.stdout or b""),
            "stderrBytes": len(exc.stderr or b""),
            "seconds": round(elapsed, 6),
            "timedOut": True,
        }
        if exc.stdout is not None:
            call["stdoutBase64"] = base64.b64encode(exc.stdout).decode("ascii")
        if exc.stderr is not None:
            call["stderrBase64"] = base64.b64encode(exc.stderr).decode("ascii")
        raise BaselineError("ripgrep-timeout", "ripgrep exceeded the bounded subprocess timeout.", [call]) from exc
    return {
        "argv": argv,
        "returncode": child.returncode,
        "stdoutBytes": len(child.stdout),
        "stderrBytes": len(child.stderr),
        "seconds": round(elapsed, 6),
        "timedOut": False,
        "_stdout": child.stdout,
        "_stderr": child.stderr,
    }


def _public_native_call(call: dict[str, Any], capture_stdout: bool) -> dict[str, Any]:
    public = {key: value for key, value in call.items() if not key.startswith("_")}
    if capture_stdout:
        stdout = call.get("_stdout")
        stderr = call.get("_stderr")
        if stdout is not None:
            public["stdoutBase64"] = base64.b64encode(stdout).decode("ascii")
        if stderr is not None:
            public["stderrBase64"] = base64.b64encode(stderr).decode("ascii")
    return public


def _version(rg: str, timeout: float) -> tuple[str, dict[str, Any]]:
    call = _run_native([rg, "--version"], timeout)
    stdout = call.get("_stdout", b"")
    if call["returncode"] != 0 or not stdout:
        raise BaselineError("ripgrep-version-failed", "Could not query the installed ripgrep version.", [call])
    first_line = os.fsdecode(stdout.splitlines()[0]).strip()
    call["purpose"] = "version"
    return first_line, call


def _query_tokens(query: str) -> list[str]:
    if not isinstance(query, str):
        raise BaselineError("invalid-query", "query must be a string.")
    tokens: list[str] = []
    seen: set[str] = set()
    for raw in re.findall(r"\w+", query.casefold(), flags=re.UNICODE):
        if raw not in seen:
            seen.add(raw)
            tokens.append(raw)
    return tokens


def _safe_relative_path(raw_path: str, root: Path) -> str:
    try:
        candidate = Path(raw_path)
        absolute = candidate if candidate.is_absolute() else (Path.cwd() / candidate)
        relative = absolute.relative_to(root)
    except (ValueError, OSError) as exc:
        raise BaselineError("unsafe-candidate-path", "ripgrep returned a path outside the supplied corpus.") from exc
    if not relative.parts or relative.suffix != ".md" or any(part in ("", ".", "..") for part in relative.parts):
        raise BaselineError("unsafe-candidate-path", "ripgrep returned a non-Markdown or invalid path.")
    current = root
    for part in relative.parts:
        current = current / part
        try:
            info = current.lstat()
        except OSError as exc:
            raise BaselineError("unsafe-candidate-path", "ripgrep returned a path that no longer exists.") from exc
        if stat.S_ISLNK(info.st_mode):
            raise BaselineError("unsafe-candidate-path", "ripgrep returned a symlink path.")
    try:
        resolved = absolute.resolve(strict=True)
        resolved.relative_to(root)
    except (OSError, RuntimeError, ValueError) as exc:
        raise BaselineError("unsafe-candidate-path", "ripgrep returned a path escaping the supplied corpus.") from exc
    if not resolved.is_file():
        raise BaselineError("unsafe-candidate-path", "ripgrep returned a path that is not a regular file.")
    return PurePosixPath(*relative.parts).as_posix()


def _snapshot_id(query: str, tokens: list[str], candidates: list[str], rg_version: str) -> str:
    frozen = {
        "policy": POLICY["name"],
        "query": query,
        "tokens": tokens,
        "candidates": candidates,
        "ripgrep": rg_version,
    }
    payload = json.dumps(frozen, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def search(
    corpus: str | os.PathLike[str],
    query: str,
    *,
    offset: int = 0,
    page_size: int = 10,
    expected_snapshot: str | None = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    rg_executable: str | os.PathLike[str] | None = None,
    capture_native_stdout: bool = False,
) -> dict[str, Any]:
    """Return a deterministic page of Markdown paths matching literal query tokens.

    Pass the returned snapshotId as expected_snapshot on continuation. This catches
    candidate-set changes between independently requested pages.
    """
    if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
        raise BaselineError("invalid-offset", "offset must be a non-negative integer.")
    if isinstance(page_size, bool) or not isinstance(page_size, int) or page_size <= 0:
        raise BaselineError("invalid-page-size", "page_size must be a positive integer.")
    if expected_snapshot is not None and (not isinstance(expected_snapshot, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_snapshot)):
        raise BaselineError("invalid-snapshot", "expected_snapshot must be a lowercase SHA-256 hex digest.")
    timeout = _validate_timeout(timeout_seconds)
    root = _resolve_root(corpus)
    rg = _resolve_rg(rg_executable)
    tokens = _query_tokens(query)
    native_calls: list[dict[str, Any]] = []
    try:
        rg_version, version_call = _version(rg, timeout)
        native_calls.append(version_call)
        candidates: list[str] = []
        if tokens:
            argv = [rg, "--files-with-matches", "--null", "--fixed-strings", "--ignore-case", "--word-regexp",
                    "--glob", RG_GLOB, "--hidden", "--no-ignore"]
            for token in tokens:
                argv.extend(["-e", token])
            argv.extend(["--", str(root)])
            search_call = _run_native(argv, timeout)
            search_call["purpose"] = "literal-token-search"
            native_calls.append(search_call)
            if search_call["returncode"] not in (0, 1):
                raise BaselineError("ripgrep-search-failed", "ripgrep failed while searching the corpus.", native_calls)
            stdout = search_call.get("_stdout", b"")
            raw_paths = stdout.split(b"\0")
            if raw_paths and raw_paths[-1] == b"":
                raw_paths.pop()
            for raw in raw_paths:
                candidates.append(_safe_relative_path(os.fsdecode(raw), root))
            if len(candidates) != len(set(candidates)):
                raise BaselineError("duplicate-candidate-path", "ripgrep returned a duplicate candidate path.", native_calls)
            candidates.sort()
        snapshot_id = _snapshot_id(query, tokens, candidates, rg_version)
        if expected_snapshot is not None and expected_snapshot != snapshot_id:
            raise BaselineError("snapshot-changed", "Candidate set changed between pages; restart pagination from offset 0.", native_calls)
        if offset > len(candidates):
            raise BaselineError("invalid-offset", "offset is beyond the current candidate count.", native_calls)
        page_paths = candidates[offset:offset + page_size]
        end = offset + len(page_paths)
        has_more = end < len(candidates)
        if has_more and end <= offset:
            raise BaselineError("pagination-no-progress", "Continuation would not advance.", native_calls)
        native_seconds = sum(float(call["seconds"]) for call in native_calls)
        native_output_bytes = sum(int(call["stdoutBytes"]) + int(call["stderrBytes"]) for call in native_calls)
        return {
            "offset": offset,
            "nextOffset": end if has_more else None,
            "hasMore": has_more,
            "results": [{"path": path} for path in page_paths],
            "candidateCount": len(candidates),
            "snapshotId": snapshot_id,
            "query": query,
            "tokens": tokens,
            "policy": POLICY,
            "ripgrep": {"executable": rg, "version": rg_version},
            "nativeSeconds": round(native_seconds, 6),
            "nativeOutputBytes": native_output_bytes,
            "nativeCalls": [_public_native_call(call, capture_native_stdout) for call in native_calls],
        }
    except BaselineError as exc:
        if not exc.native_calls:
            exc.native_calls = native_calls
        raise


def _validate_read_path(raw_path: str) -> tuple[str, ...]:
    if not isinstance(raw_path, str) or not raw_path or "\x00" in raw_path or "\\" in raw_path:
        raise BaselineError("invalid-original-path", "path must be a non-empty corpus-relative POSIX path.")
    if raw_path.startswith("/") or re.match(r"^[A-Za-z]:", raw_path):
        raise BaselineError("invalid-original-path", "absolute paths are not allowed.")
    parts = raw_path.split("/")
    if any(part in ("", ".", "..") for part in parts) or not parts or not raw_path.endswith(".md"):
        raise BaselineError("invalid-original-path", "path must stay inside the corpus and end in lowercase .md.")
    return tuple(parts)


def _open_original(root: Path, parts: tuple[str, ...]) -> bytes:
    if not hasattr(os, "O_NOFOLLOW") or not hasattr(os, "O_DIRECTORY"):
        raise BaselineError("secure-open-unavailable", "This platform lacks no-follow directory-open support.")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    try:
        current_fd = os.open(root.anchor, flags)
    except OSError as exc:
        raise BaselineError("unsafe-original-path", "Could not safely open corpus root.") from exc
    try:
        for component in root.parts[1:]:
            try:
                next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=current_fd)
            except OSError as exc:
                raise BaselineError("unsafe-original-path", "Corpus root changed or contains a symlink component.") from exc
            os.close(current_fd)
            current_fd = next_fd
        for component in parts[:-1]:
            try:
                next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=current_fd)
            except OSError as exc:
                raise BaselineError("unsafe-original-path", "Original path contains an invalid or symlink directory.") from exc
            os.close(current_fd)
            current_fd = next_fd
        try:
            file_fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=current_fd)
        except OSError as exc:
            raise BaselineError("unsafe-original-path", "Original path is missing or is a symlink.") from exc
        try:
            before = os.fstat(file_fd)
            if not stat.S_ISREG(before.st_mode):
                raise BaselineError("unsafe-original-path", "Original path is not a regular file.")
            chunks: list[bytes] = []
            while True:
                chunk = os.read(file_fd, 1024 * 1024)
                if not chunk:
                    break
                chunks.append(chunk)
            after = os.fstat(file_fd)
            identity_before = (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
            identity_after = (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns)
            if identity_before != identity_after:
                raise BaselineError("original-changed-during-read", "Original Markdown changed during its read.")
            return b"".join(chunks)
        finally:
            os.close(file_fd)
    finally:
        os.close(current_fd)


def read_original(
    corpus: str | os.PathLike[str],
    path: str,
    *,
    expected_sha256: str | None = None,
) -> dict[str, Any]:
    """Read one complete immutable Markdown original and return exact-byte identity."""
    parts = _validate_read_path(path)
    if expected_sha256 is not None and (not isinstance(expected_sha256, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_sha256)):
        raise BaselineError("invalid-expected-hash", "expected_sha256 must be a lowercase SHA-256 hex digest.")
    root = _resolve_root(corpus)
    raw = _open_original(root, parts)
    digest = hashlib.sha256(raw).hexdigest()
    if expected_sha256 is not None and digest != expected_sha256:
        raise BaselineError("original-hash-mismatch", "Original bytes do not match expected_sha256.")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BaselineError("original-not-utf8", "Markdown original is not valid UTF-8.") from exc
    return {"path": PurePosixPath(*parts).as_posix(), "content": content, "sha256": digest, "byteLength": len(raw)}


def _cli() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    search_parser = commands.add_parser("search", help="search Markdown paths with literal query tokens")
    search_parser.add_argument("--corpus", required=True)
    search_parser.add_argument("--query", required=True)
    search_parser.add_argument("--offset", type=int, default=0)
    search_parser.add_argument("--page-size", type=int, default=10)
    search_parser.add_argument("--expected-snapshot")
    search_parser.add_argument("--timeout-seconds", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    search_parser.add_argument("--capture-native-stdout", action="store_true")
    read_parser = commands.add_parser("read", help="read and hash one complete Markdown original")
    read_parser.add_argument("--corpus", required=True)
    read_parser.add_argument("--path", required=True)
    read_parser.add_argument("--expected-sha256")
    args = parser.parse_args()
    try:
        if args.command == "search":
            result = search(args.corpus, args.query, offset=args.offset, page_size=args.page_size,
                            expected_snapshot=args.expected_snapshot, timeout_seconds=args.timeout_seconds,
                            capture_native_stdout=args.capture_native_stdout)
        else:
            result = read_original(args.corpus, args.path, expected_sha256=args.expected_sha256)
    except BaselineError as exc:
        result = {"error": {"code": exc.code, "message": str(exc)}}
        if exc.native_calls:
            result["nativeCalls"] = [_public_native_call(call, "--capture-native-stdout" in sys.argv) for call in exc.native_calls]
        print(json.dumps(result, ensure_ascii=True, separators=(",", ":")))
        return 2
    print(json.dumps(result, ensure_ascii=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
