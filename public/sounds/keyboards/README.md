# Mechanical Keyboard Sound Profiles

This directory contains audio assets for the keyboard sound feature in Miku editor.

## Quick Start

1. Download a MechVibes soundpack (a folder with `config.json` + `sound.ogg`)
2. Copy the folder here: `/public/sounds/keyboards/your-soundpack-name/`
3. Add the folder name to `manifest.json`:
   ```json
   {
     "profiles": ["your-soundpack-name"]
   }
   ```
4. Restart the app and enable keyboard sounds in Settings

That's it! The folder name can be anything you want.

## MechVibes-Compatible Format

Each soundpack folder contains:

```
your-soundpack-name/
  config.json       # Key definitions with timing offsets
  sound.ogg         # Single audio file containing all key sounds
```

### config.json Structure

```json
{
  "id": "custom-sound-pack-1234567890",
  "name": "CherryMX Blue - ABS keycaps",
  "key_define_type": "single",
  "includes_numpad": false,
  "sound": "sound.ogg",
  "defines": {
    "30": [1754, 184],
    "31": [10135, 199],
    ...
  }
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (can be anything) |
| `name` | Display name shown in Settings |
| `key_define_type` | Always "single" (one audio file) |
| `includes_numpad` | Whether numpad keys are included |
| `sound` | Filename of the audio file |
| `defines` | Map of scancode -> [startMs, durationMs] |

## manifest.json

The `manifest.json` file lists which soundpacks to load:

```json
{
  "profiles": [
    "cherry-mx-blue",
    "my-custom-keyboard",
    "thocky-topre"
  ]
}
```

Each entry is a folder name in this directory. Add or remove entries to enable/disable profiles.

## Getting MechVibes Soundpacks

1. **Official MechVibes packs**: Download from [MechVibes releases](https://github.com/hainguyents13/mechvibes/releases)
2. **Community packs**: Search "MechVibes soundpack" online
3. **Extract and copy**: Unzip and copy the folder containing `config.json` and `sound.ogg` here

## Scancode Reference

Common scancodes used in the `defines` map:

| Key | Scancode |
|-----|----------|
| A-Z | 30-44 (varies by row) |
| 0-9 | 2-11 |
| Space | 57 |
| Enter | 28 |
| Backspace | 14 |
| Tab | 15 |
| Shift | 42 (left), 54 (right) |

The engine will fall back to a random key sound if a scancode isn't defined.

## Audio File Specifications

| Property | Requirement |
|----------|-------------|
| Format | OGG Vorbis (preferred) or WAV |
| Sample Rate | 44100 Hz or 48000 Hz |
| Channels | Mono or Stereo |
| Typical Size | 500KB - 2MB |

## Troubleshooting

**No profiles showing in Settings:**
- Check that `manifest.json` lists your folder name
- Verify the folder contains both `config.json` and the sound file
- Check browser console for loading errors

**Sounds not playing:**
- Check browser console for 404 errors
- Verify the `sound` field in config.json matches the actual filename
- Make sure keyboard sounds are enabled in Settings

**Wrong sounds for keys:**
- The engine maps browser key codes to scancodes
- If a key isn't defined, a random key sound plays instead
