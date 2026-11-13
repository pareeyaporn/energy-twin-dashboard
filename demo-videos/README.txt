ENERGY TWIN DEMO VIDEOS: ADD THE AI VOICE-OVER (about 2 minutes)
================================================================

What is in this folder
- EnergyTwin-Rachel-story.mp4          video 1, Rachel's story (about 3 min)
- EnergyTwin-booth-loop.mp4            video 2, booth loop (about 3 min)
- EnergyTwin-full-walkthrough.mp4      video 3, full walkthrough (about 6 min)
- *.narration.json                     the spoken lines and when each starts (edit the "text" freely)
- *.srt                                the same lines as subtitles (for CapCut, YouTube, or a player)
- make_voiceover.py                    the script that voices and merges

One-time setup (macOS)
1. Install ffmpeg:        brew install ffmpeg        (Windows: winget install ffmpeg)
2. Open Terminal in this folder (Finder: right-click the folder > New Terminal at Folder).
3. Set your OpenAI key for this Terminal window (it is not saved anywhere):
       export OPENAI_API_KEY=sk-...your key...

Make the voiced videos
       python3 make_voiceover.py EnergyTwin-Rachel-story.mp4 EnergyTwin-Rachel-story.narration.json
       python3 make_voiceover.py EnergyTwin-booth-loop.mp4 EnergyTwin-booth-loop.narration.json
       python3 make_voiceover.py EnergyTwin-full-walkthrough.mp4 EnergyTwin-full-walkthrough.narration.json

Each writes a "-voiced.mp4" next to the original. It costs a few cents in total.

Tips
- Different voice:  add  --voice coral   (or alloy, ash, ballad, echo, fable, onyx, sage, shimmer)
- Too fast or a line overlaps: shorten that line's "text" in the .json and run again (only changed lines are re-voiced).
- If it prints "line N moved X s later", the line before it is too long for its scene.
- Check without spending anything:  add  --test-tones   (beeps instead of speech, to check timing and ffmpeg)
- The figures in the lines are the engine's for the synthetic demo hotels (November 2026). If the app's numbers change,
  update the lines so they match the screen.
