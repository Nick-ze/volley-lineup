#!/usr/bin/env bash
# Smoke test of the installed APK on an Android emulator: create a profile, open it,
# and print what is on screen (accessibility labels) plus any JS errors from logcat.
set -u
PKG=com.volleylineup.app
OUT=${OUT:-e2e-out}
mkdir -p "$OUT"

dump() { # $1 = step name
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb pull /sdcard/ui.xml "$OUT/$1.xml" >/dev/null 2>&1
  adb exec-out screencap -p > "$OUT/$1.png"
  echo "=== SCREEN $1: labels/texts ==="
  grep -o -E '(text|content-desc)="[^"]+"' "$OUT/$1.xml" | sort -u | head -60
}

tap_label() { # tap the element whose content-desc or text equals $1 (input fields first)
  local b
  b=$(grep -o -E "<node[^>]*>" "$OUT/last.xml" | grep 'class="android.widget.EditText"' | grep -E "content-desc=\"$1\"" | head -1 | grep -o 'bounds="[^"]*"' | head -1)
  [ -z "$b" ] && b=$(grep -o -E "<node[^>]*(content-desc|text)=\"$1\"[^>]*>" "$OUT/last.xml" | head -1 | grep -o 'bounds="[^"]*"' | head -1)
  if [ -z "$b" ]; then echo "!!! element '$1' not found"; return 1; fi
  read -r x1 y1 x2 y2 < <(echo "$b" | grep -o '[0-9]\+' | tr '\n' ' ')
  echo ">>> tap '$1' at $(( (x1+x2)/2 )),$(( (y1+y2)/2 ))"
  adb shell input tap $(( (x1+x2)/2 )) $(( (y1+y2)/2 ))
}

step() { sleep "${2:-4}"; dump "$1"; cp "$OUT/$1.xml" "$OUT/last.xml"; }

FAILED=0
expect() { # $1 = text or label that must be on the current screen
  if grep -q -E "(text|content-desc)=\"$1\"" "$OUT/last.xml"; then echo "PASS: '$1' visible"
  else echo "FAIL: '$1' not visible"; FAILED=1; fi
}

adb wait-for-device
adb logcat -c
adb install -r "$1"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
step 01-launch 20
tap_label "Profile name" && sleep 1 && adb shell input text "Coach" && adb shell input keyevent 111
step 02-typed 3
tap_label "Create profile"
# Creating a profile should open its teams straight away.
step 03-after-create 6
expect "Coach's teams"
tap_label "New team"
step 04-team-form 4
tap_label "Team name" && sleep 1 && adb shell input text "Herren" && adb shell input keyevent 111
step 05-team-typed 3
tap_label "Create team"
step 06-team-created 4
expect "Open team Herren"
# Restart the app: with a saved profile it should land on Teams again.
adb shell am force-stop "$PKG"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
step 07-relaunch 15
expect "Coach's teams"
expect "Open team Herren"
tap_label "Open team Herren" || true
step 08-team 5
expect "Roster"

echo "=== LOGCAT: ReactNativeJS / errors ==="
adb logcat -d -s ReactNativeJS:V ReactNative:V AndroidRuntime:E '*:E' | grep -v -E 'chatty|Watchdog' | tail -150

if [ "$FAILED" = 1 ]; then echo "SMOKE TEST FAILED"; exit 1; fi
echo "SMOKE TEST PASSED"
