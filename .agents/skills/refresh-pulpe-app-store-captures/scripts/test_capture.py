#!/usr/bin/env python3
import json

import capture


def main():
    hierarchy = {"children": [{"AXUniqueId": "email"}, {"AXUniqueId": "password"}]}
    assert capture.has_identifier(json.dumps(hierarchy, separators=(",", ":")), "email")
    assert not capture.has_identifier(json.dumps(hierarchy, indent=4), "loginButton")

    expected = {
        "name": capture.CATALOG["device_name"],
        "deviceTypeIdentifier": capture.CATALOG["device_type"],
        "isAvailable": True,
        "state": "Shutdown",
        "udid": "expected",
    }
    wrong_type = expected | {"deviceTypeIdentifier": "wrong", "udid": "wrong-type"}
    devices = {
        "devices": {
            "wrong-runtime": [expected | {"udid": "wrong-runtime"}],
            capture.CATALOG["runtime"]: [wrong_type, expected],
        }
    }
    assert [device["udid"] for device in capture.matching_devices(devices)] == ["expected"]


if __name__ == "__main__":
    main()
