#!/usr/bin/env python3
import argparse
import json
import os
import struct
import subprocess
import time
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
ROOT = SKILL.parents[2]
OUT = ROOT / "appstore-screenshots"
CATALOG = json.loads((SKILL / "references/routes.json").read_text())


def command(*args, check=True):
    return subprocess.run(args, check=check, text=True, capture_output=True)


def roster(includes):
    names = {p.name for p in OUT.glob("*.png")} | set(includes)
    unknown = sorted(names - CATALOG["screens"].keys())
    if unknown:
        raise SystemExit("Unregistered captures: " + ", ".join(unknown))
    return sorted(names)


def device(override):
    if override:
        return override
    data = json.loads(command("xcrun", "simctl", "list", "-j", "devices", "available").stdout)
    matches = [d for devices in data["devices"].values() for d in devices
               if d["name"] == CATALOG["device_name"] and d["isAvailable"]]
    if not matches:
        raise SystemExit(f"No available {CATALOG['device_name']} simulator")
    return next((d["udid"] for d in matches if d["state"] == "Booted"), matches[0]["udid"])


def tree(udid):
    return command("axe", "describe-ui", "--udid", udid).stdout


def wait_for(udid, needle, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        current = tree(udid)
        if needle in current:
            return current
        time.sleep(0.4)
    raise RuntimeError(f"Timed out waiting for {needle!r}")


def tap(udid, selector, optional=False):
    key, value = next((k, v) for k, v in selector.items() if k.startswith("tap_"))
    if key == "tap_point":
        target = ("-x", str(value[0]), "-y", str(value[1]))
    elif key == "tap_id":
        target = ("--id", value)
    elif key == "tap_button_label":
        target = ("--label", value, "--element-type", "Button")
    else:
        target = ("--label", value)
    result = command("axe", "tap", *target, "--wait-timeout", "8", "--post-delay", "0.7",
                     "--udid", udid, check=not optional)
    return result.returncode == 0


def unlock(udid):
    end = time.time() + 15
    while time.time() < end:
        current = tree(udid)
        if "Saisis ton code PIN" in current or "home-balance-chart" in current:
            break
        time.sleep(0.4)
    else:
        raise RuntimeError("Timed out waiting for PIN or home screen")
    if "Saisis ton code PIN" in current:
        for _ in range(3):
            for _ in range(4):
                tap(udid, {"tap_id": "delete.backward"}, optional=True)
            for digit in os.environ.get("PULPE_CAPTURE_PIN", "1234"):
                tap(udid, {"tap_button_label": digit})
            try:
                current = wait_for(udid, "home-balance-chart", timeout=6)
                break
            except RuntimeError:
                pass
        else:
            raise RuntimeError("PIN was not accepted after 3 attempts")
    else:
        current = wait_for(udid, "home-balance-chart")
    if "CHF" not in current or "estimé fin" not in current:
        raise RuntimeError("Capture account must use French UI and CHF")


def capture(udid, name, route, output):
    bundle = CATALOG["bundle_id"]
    command("xcrun", "simctl", "terminate", udid, bundle, check=False)
    command("xcrun", "simctl", "launch", udid, bundle,
            "-AppleLanguages", "(fr)", "-AppleLocale", "fr_CH")
    unlock(udid)
    for action in route["actions"]:
        tap(udid, action, action.get("optional", False))
    wait_for(udid, route["expect"])
    temporary = output / f".{name}.tmp.png"
    command("axe", "screenshot", "--udid", udid, "--output", str(temporary))
    temporary.replace(output / name)


def dimensions(path):
    with path.open("rb") as image:
        if image.read(8) != b"\x89PNG\r\n\x1a\n" or image.read(4) != b"\x00\x00\x00\r":
            raise ValueError("not a PNG")
        if image.read(4) != b"IHDR":
            raise ValueError("missing IHDR")
        return struct.unpack(">II", image.read(8))


def check(names, output=OUT):
    expected = (CATALOG["width"], CATALOG["height"])
    failures = []
    for name in names:
        try:
            actual = dimensions(output / name)
            if actual != expected:
                failures.append(f"{name}: {actual[0]}x{actual[1]}")
        except (OSError, ValueError) as error:
            failures.append(f"{name}: {error}")
    if failures:
        raise SystemExit("Invalid captures:\n" + "\n".join(failures))
    print(f"OK: {len(names)} captures at {expected[0]}x{expected[1]}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("plan", "run", "check"))
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--udid")
    parser.add_argument("--output-dir", type=Path, default=OUT)
    args = parser.parse_args()
    names = roster(args.include)
    if args.mode == "plan":
        print(json.dumps(names, ensure_ascii=False, indent=2))
        return
    if args.mode == "check":
        check(names, args.output_dir)
        return
    args.output_dir.mkdir(parents=True, exist_ok=True)
    udid = device(args.udid)
    command("xcrun", "simctl", "boot", udid, check=False)
    command("xcrun", "simctl", "bootstatus", udid, "-b")
    command("xcrun", "simctl", "get_app_container", udid, CATALOG["bundle_id"])
    command("xcrun", "simctl", "status_bar", udid, "override", "--time", "09:41",
            "--batteryState", "charged", "--batteryLevel", "100", "--wifiBars", "3",
            "--cellularBars", "4")
    try:
        for name in names:
            print(f"Capturing {name}", flush=True)
            capture(udid, name, CATALOG["screens"][name], args.output_dir)
        check(names, args.output_dir)
    finally:
        command("xcrun", "simctl", "status_bar", udid, "clear", check=False)


if __name__ == "__main__":
    main()
