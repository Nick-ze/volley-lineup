# Volley Lineup

**Volley Lineup** is an app for volleyball coaches and team managers. Plan the starting lineup for every set, see all six
rotations, keep the score live during the match and look at the stats afterwards.

It runs on Android phones and in the browser, works fully offline, and needs no account: everything is saved on your
device. You can back up your data or move it to another device with a file.

Available in English and German.

## What you can do

- **Teams and players**: keep your roster with jersey numbers, positions, photos and an injured flag.
- **Lineups**: drag players from the bench onto the court (or tap a player, then a spot) for every set. 5-1 and 6-2
  formations, libero, team starters and saved lineups ("presets") make it quick.
- **Rotations**: step through all six rotations and see who serves and who is in the front row.
- **Live match**: tap "Point us" / "Point them". The app keeps the score, rotates for you, counts substitutions and can
  undo anything. Optionally tag each rally (kill, ace, block, error…).
- **Stats and performance**: results, set scores, points per rotation and how each player did, per match, season or
  tournament.
- **Seasons and tournaments**: group your matches and keep a record against every opponent.
- **Print**: a lineup sheet to print or share as a PDF.
- **Guided tour**: short tips with pictures show you around; choose the full or quick tour, or none.
- **Make it yours**: light or dark mode, a dyslexia-friendly font, names or numbers on the player chips.

**What's new in 9.0**: a guided tour. On first start choose a full tour, a quick tour (from your profile to your first
match) or none; short popups show what to tap. Change your mind any time in Profile → Tutorial.
[All versions →](docs/README_LEGACY.md#version-history)

## Install on Android (APK)

1. On your Android phone, open the
   [latest release](https://github.com/Nick-ze/volley-lineup/releases/latest) (or this repository on GitHub →
   **Releases** → the newest one, for example `v9.0.0`). No GitHub account needed.
2. Under **Assets**, tap `volley-lineup-<version>.apk` to download it.
3. Open the downloaded file. If Android asks, allow installing from this source (your browser or the Files app), then go
   back.
4. Tap **Install**, then **Open**. Volley Lineup is now on your home screen.

**Updating**: download the newer APK the same way, open it and tap **Update**. Your teams and players stay saved. It's
a good idea to make a backup first (Settings → Export everything).

**If something goes wrong**

- _"App not installed"_: an old version signed with a different key is installed. Export your data, uninstall the old
  app, install the new one and import your data again.
- _Play Protect warning_: it shows because the app isn't from the Play Store. Tap **More details → Install anyway**.
- _Can't find the file_: look in **Files → Downloads**, or download it again.

## Start it with Expo Go (iPhone or Android)

Expo Go runs the app straight from the source code on a computer. No install file needed, and it also works on an
iPhone.

You need:

- a computer with [Node.js](https://nodejs.org) 22 or newer and [Git](https://git-scm.com);
- the **Expo Go** app on your phone (App Store / Play Store), in a version that supports Expo SDK 58;
- phone and computer on the same Wi-Fi.

Steps:

1. Download the code and install what it needs (once):
   ```bash
   git clone https://github.com/Nick-ze/volley-lineup.git
   cd volley-lineup
   npm install
   ```
2. Start it:
   ```bash
   npx expo start
   ```
3. Scan the QR code that appears: with the Camera app on an iPhone, or inside Expo Go on Android. The app opens in
   Expo Go.

If the phone can't connect (for example on a work or school network), start it with `npx expo start --tunnel` instead.

## Use it in the browser

- **On your computer**: after the steps above, press `w` in the terminal (or run `npx expo start --web`), and the app
  opens in your browser.
- **Online**: the web version at **https://nick-ze.github.io/volley-lineup/** works once GitHub Pages is turned on for
  this repository.

In the browser your data is saved in that browser only.

## Back up and move your data

Open **Settings**:

- **Export everything** saves all your profiles, teams, players, matches and photos to a `.json` file (on a phone the
  share menu opens, so you can save it to Files, Drive or send it by mail). You can also export a single team.
- **Import from file** reads such a file back. It shows what's inside first; then choose **Merge** (add to what you
  have) or **Replace** (swap your data for the file's).

To move to a new phone: export on the old one, send yourself the file, import it on the new one.

## For developers

The full version history, the development commands, the release steps and the notes for AI agents working on this app
are in **[docs/README_LEGACY.md](docs/README_LEGACY.md)**. Project rules: [CLAUDE.md](CLAUDE.md).

## Licence

The code is public so you can read it and run the app for yourself, but it is **not open source**: all rights are
reserved. Please don't copy, reuse, change or republish it without permission. See [LICENSE](LICENSE).
