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


def command(*args, check=True, env=None, input_text=None):
    return subprocess.run(
        args, check=check, text=True, capture_output=True, env=env, input=input_text
    )


def roster(includes, output=OUT):
    names = {p.name for p in output.glob("*.png")} | set(includes)
    unknown = sorted(names - CATALOG["screens"].keys())
    if unknown:
        raise SystemExit("Unregistered captures: " + ", ".join(unknown))
    return sorted(names)


def matching_devices(data):
    return [
        device
        for runtime, devices in data["devices"].items()
        if runtime == CATALOG["runtime"]
        for device in devices
        if device["name"] == CATALOG["device_name"]
        and device.get("deviceTypeIdentifier") == CATALOG["device_type"]
        and device["isAvailable"]
    ]


def device(override):
    if override:
        return override
    data = json.loads(command("xcrun", "simctl", "list", "-j", "devices", "available").stdout)
    matches = matching_devices(data)
    if not matches:
        return command(
            "xcrun", "simctl", "create", CATALOG["device_name"],
            CATALOG["device_type"], CATALOG["runtime"]
        ).stdout.strip()
    return next((d["udid"] for d in matches if d["state"] == "Booted"), matches[0]["udid"])


def tree(udid):
    return command("axe", "describe-ui", "--udid", udid).stdout


def has_identifier(description, identifier):
    try:
        pending = [json.loads(description)]
    except json.JSONDecodeError as error:
        raise RuntimeError("axe describe-ui returned invalid JSON") from error
    while pending:
        value = pending.pop()
        if isinstance(value, dict):
            if value.get("AXUniqueId") == identifier:
                return True
            pending.extend(value.values())
        elif isinstance(value, list):
            pending.extend(value)
    return False


def wait_for(udid, needle, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        current = tree(udid)
        if needle in current:
            return current
        time.sleep(0.4)
    raise RuntimeError(f"Timed out waiting for {needle!r}")


def tap(udid, selector, optional=False):
    target = next(((k, v) for k, v in selector.items() if k.startswith("tap_")), None)
    if target is None:
        raise ValueError(f"Action has no tap_* key: {selector}")
    key, value = target
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


def paste(udid, identifier, value):
    tap(udid, {"tap_id": identifier})
    command("axe", "key-combo", "--modifiers", "227", "--key", "4", "--udid", udid)
    command("xcrun", "simctl", "pbcopy", udid, input_text=value)
    command("axe", "key-combo", "--modifiers", "227", "--key", "25", "--udid", udid)


def unlock(udid, ready):
    pin = os.environ.get("PULPE_CAPTURE_PIN", "1234")
    if len(pin) != 4 or not pin.isascii() or not pin.isdigit():
        raise ValueError("PULPE_CAPTURE_PIN must contain exactly 4 ASCII digits")
    end = time.time() + 45
    pin_attempts = 0
    login_attempts = 0
    last_login = 0
    while time.time() < end:
        current = tree(udid)
        if ready in current:
            if "home-balance-chart" in current and (
                "homeProjectedBalanceAmount" not in current or "CHF" not in current
            ):
                raise RuntimeError("Capture account must display projected amounts in CHF")
            return
        if "networkReturnToLoginButton" in current:
            tap(udid, {"tap_id": "networkReturnToLoginButton"})
        elif "existingAccountButton" in current:
            tap(udid, {"tap_id": "existingAccountButton"})
        elif has_identifier(current, "email"):
            if time.time() - last_login < 5:
                time.sleep(0.4)
                continue
            if login_attempts >= 3:
                raise RuntimeError("Demo account login failed after 3 attempts")
            paste(udid, "email", os.environ.get("PULPE_CAPTURE_EMAIL", "demo@pulpe.test"))
            paste(udid, "password", os.environ.get("PULPE_CAPTURE_PASSWORD", "local-demo-only"))
            tap(udid, {"tap_id": "loginButton"})
            login_attempts += 1
            last_login = time.time()
        elif "pinEntryRoot" in current:
            if pin_attempts >= 3:
                raise RuntimeError("PIN was not accepted after 3 attempts")
            for _ in pin:
                tap(udid, {"tap_id": "delete.backward"}, optional=True)
            for digit in pin:
                tap(udid, {"tap_button_label": digit})
            pin_attempts += 1
        time.sleep(0.4)
    raise RuntimeError(f"Timed out waiting for {ready!r}")


def capture(udid, name, route, output):
    bundle = CATALOG["bundle_id"]
    command("xcrun", "simctl", "terminate", udid, bundle, check=False)
    launch_env = os.environ | {
        f"SIMCTL_CHILD_{key}": str(value) for key, value in route.get("launch_env", {}).items()
    }
    command("xcrun", "simctl", "launch", udid, bundle,
            "-AppleLanguages", "(fr)", "-AppleLocale", "fr_CH",
            *route.get("launch_args", []), env=launch_env)
    unlock(udid, route.get("ready", route["expect"]))
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
    parser.add_argument("mode", choices=("plan", "device", "run", "check"))
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--udid")
    parser.add_argument("--app", type=Path)
    parser.add_argument("--output-dir", type=Path, default=OUT)
    args = parser.parse_args()
    if args.mode == "device":
        print(device(args.udid))
        return
    roster_dir = args.output_dir if args.mode == "check" else OUT
    names = roster(args.include, roster_dir)
    if args.only:
        missing = sorted(set(args.only) - set(names))
        if missing:
            raise SystemExit("Captures not in roster: " + ", ".join(missing))
        names = sorted(set(args.only))
    if args.mode == "plan":
        print(json.dumps(names, ensure_ascii=False, indent=2))
        return
    if args.mode == "check":
        check(names, args.output_dir)
        return
    if not args.app or not args.app.is_dir():
        raise SystemExit("run requires --app with a freshly built .app directory")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    udid = device(args.udid)
    command("xcrun", "simctl", "boot", udid, check=False)
    command("xcrun", "simctl", "bootstatus", udid, "-b")
    command("xcrun", "simctl", "ui", udid, "appearance", "light")
    command("xcrun", "simctl", "install", udid, str(args.app))
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
