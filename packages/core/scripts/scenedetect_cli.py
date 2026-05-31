#!/usr/bin/env python3
"""
clip-cli: Scene detection using PySceneDetect
Called from the TypeScript core as a subprocess.

Usage: python3 scenedetect_cli.py <input_video> [threshold] [output_json]
"""

import sys
import json
import subprocess

def detect_scenes(input_path, threshold=27, output_json=None):
    """Run PySceneDetect and return scene boundaries as JSON."""
    result = subprocess.run(
        [
            "scenedetect",
            "-i", input_path,
            "detect-content",
            "-t", str(threshold),
            "list-scenes",
            "-f", output_json or "/tmp/scenes.json",
        ],
        capture_output=True,
        text=True,
    )
    
    json_path = output_json or "/tmp/scenes.json"
    try:
        with open(json_path, "r") as f:
            data = json.load(f)
        
        scenes = []
        for scene in data.get("scenes", []):
            scenes.append({
                "start_time": scene.get("start_time", scene.get("start_seconds", 0)),
                "end_time": scene.get("end_time", scene.get("end_seconds", 0)),
                "confidence": scene.get("score", None),
            })
        return scenes
    except (FileNotFoundError, json.JSONDecodeError):
        # Fallback: parse CSV output
        scenes = []
        lines = result.stdout.split("\n")
        for line in lines:
            # Parse scene list CSV output
            parts = line.strip().split(",")
            if len(parts) >= 3:
                try:
                    start = float(parts[1].strip())
                    end = float(parts[2].strip())
                    scenes.append({"start_time": start, "end_time": end})
                except ValueError:
                    continue
        return scenes

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: scenedetect_cli.py <input_video> [threshold] [output_json]", file=sys.stderr)
        sys.exit(1)
    
    input_video = sys.argv[1]
    threshold = int(sys.argv[2]) if len(sys.argv) > 2 else 27
    output_json = sys.argv[3] if len(sys.argv) > 3 else None
    
    scenes = detect_scenes(input_video, threshold, output_json)
    print(json.dumps(scenes, indent=2))