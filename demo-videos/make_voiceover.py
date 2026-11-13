#!/usr/bin/env python3
"""
Add an AI voice-over to an Energy Twin demo video (run it on your own laptop).

  export OPENAI_API_KEY=sk-...            # your key; never commit it
  python3 make_voiceover.py EnergyTwin-Rachel-story.mp4 EnergyTwin-Rachel-story.narration.json

Writes EnergyTwin-Rachel-story-voiced.mp4 next to the video. Needs Python 3.8+ and ffmpeg/ffprobe
(macOS: `brew install ffmpeg`; Windows: `winget install ffmpeg`). No Python packages to install.

Each line in the .narration.json is spoken at its "start" time (seconds into the video) with OpenAI text-to-speech
(gpt-4o-mini-tts, voice "nova", a warm narrator delivery: the same voice as the app's advisor). If a line runs long, the
next one waits for it; the script prints a warning when a line had to move by more than 1.5 s, so you can shorten it in
the .json and run again. Audio clips are cached in a folder next to the video, so re-runs only re-voice changed lines.
Options: --voice alloy|ash|ballad|coral|echo|fable|nova|onyx|sage|shimmer   --model tts-1   --keep-silent-gap 0.25
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

INSTRUCTIONS = (
    "You are narrating a product demo video for a hackathon booth. Speak like a warm, confident presenter: natural, clear, "
    "upbeat but calm, at a relaxed pace. Read dollar amounts and percentages naturally. Do not add or change any words."
)


def die(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def speak(text, out_path, key, model, voice):
    body = {"model": model, "voice": voice, "input": text, "response_format": "mp3"}
    if model.startswith("gpt-"):
        body["instructions"] = INSTRUCTIONS
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r, open(out_path, "wb") as f:
            f.write(r.read())
    except urllib.error.HTTPError as e:
        die(f"OpenAI returned {e.code}: {e.read().decode(errors='replace')[:300]}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("narration")
    ap.add_argument("--voice", default="nova")
    ap.add_argument("--model", default="gpt-4o-mini-tts")
    ap.add_argument("--keep-silent-gap", type=float, default=0.3)
    ap.add_argument("--volume", type=float, default=1.0)
    ap.add_argument("--no-fit", dest="fit", action="store_false", help="do not hold frames; long lines push the next ones later")
    ap.add_argument("--test-tones", action="store_true", help="no API call: a tone per line (checks timing and ffmpeg only)")
    a = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            die(f"{tool} is not installed (macOS: brew install ffmpeg)")
    key = os.environ.get("OPENAI_API_KEY")
    if not key and not a.test_tones:
        die("set OPENAI_API_KEY first (export OPENAI_API_KEY=sk-...)")
    lines = sorted((x for x in json.load(open(a.narration, encoding="utf-8")) if x.get("text", "").strip()), key=lambda x: float(x["start"]))
    if not lines:
        die("no narration lines in the .json")

    base = os.path.splitext(a.video)[0]
    cache = base + "-voice-cache"
    os.makedirs(cache, exist_ok=True)
    vlen = duration(a.video)

    # 1. Voice every line (cached).
    durs = []
    for i, x in enumerate(lines):
        text = x["text"].strip()
        h = hashlib.sha1(f"{a.model}|{a.voice}|{text}|{a.test_tones}".encode()).hexdigest()[:12]
        mp3 = os.path.join(cache, f"{i:02d}-{h}.mp3")
        if not os.path.exists(mp3):
            if a.test_tones:
                secs = max(1.0, len(text) / 15)
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=frequency=440:duration={secs:.2f}", mp3], check=True)
            else:
                print(f"voicing {i + 1}/{len(lines)}: {text[:70]}{'…' if len(text) > 70 else ''}")
                speak(text, mp3, key, a.model, a.voice)
        durs.append((mp3, duration(mp3)))

    # 2. Fit the video to the voice: each line starts its scene; if the line is longer than the scene, the scene's last frame
    #    is held until the line ends. Nothing is cut or sped up. (--no-fit: lines are pushed later instead.)
    starts = [min(max(0.0, float(x["start"])), vlen) for x in lines]
    bounds = [0.0] + starts + [vlen]
    vparts, clips, t_new, held, prev_end = [], [], 0.0, 0.0, 0.0
    for k in range(len(bounds) - 1):
        seg_a, seg_b = bounds[k], max(bounds[k], bounds[k + 1])
        seg_len, hold = seg_b - seg_a, 0.0
        if k >= 1:
            mp3, d = durs[k - 1]
            if a.fit:
                st = t_new
                hold = max(0.0, d + a.keep_silent_gap - seg_len)
            else:
                st = max(t_new, prev_end + a.keep_silent_gap)
            clips.append((mp3, st))
            prev_end = st + d
        vparts.append((seg_a, seg_b, hold))
        t_new += seg_len + hold
        held += hold
    total = max(t_new, prev_end + 0.3)
    if held:
        print(f"  held frames for {held:.1f} s in total so every line finishes in its scene")

    # 3. Video: each scene cut and held as its own small file (low memory), then joined.
    out = base + "-voiced.mp4"
    segdir = os.path.join(cache, "scenes")
    os.makedirs(segdir, exist_ok=True)
    listfile = os.path.join(segdir, "list.txt")
    tail = max(0.0, total - t_new)
    parts = [(sa, sb, hold) for (sa, sb, hold) in vparts if sb - sa >= 0.05]
    with open(listfile, "w") as lf:
        for k, (sa, sb, hold) in enumerate(parts):
            if k == len(parts) - 1:
                hold += tail
            seg = os.path.join(segdir, f"s{k:03d}.mp4")
            vf = f"tpad=stop_mode=clone:stop_duration={hold:.3f}" if hold > 0 else "null"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{sa:.3f}", "-to", f"{sb:.3f}", "-i", a.video, "-an",
                            "-vf", f"{vf},fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "veryfast", seg], check=True)
            lf.write(f"file '{os.path.abspath(seg)}'\n")
    video_only = os.path.join(segdir, "video.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", video_only], check=True)

    # 4. Audio: every line at its start, mixed, then muxed with the video.
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", video_only]
    for mp3, _ in clips:
        cmd += ["-i", mp3]
    f = [f"[{i + 1}:a]adelay={int(st * 1000)}|{int(st * 1000)},volume={a.volume}[a{i}]" for i, (_, st) in enumerate(clips)]
    f.append("".join(f"[a{i}]" for i in range(len(clips))) + f"amix=inputs={len(clips)}:normalize=0,apad[aout]")
    cmd += ["-filter_complex", ";".join(f), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
            "-t", f"{total:.2f}", "-movflags", "+faststart", out]
    print("mixing…")
    subprocess.run(cmd, check=True)
    print(f"done: {out}  ({total:.0f} s)")


if __name__ == "__main__":
    main()
