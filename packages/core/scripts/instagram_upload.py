#!/usr/bin/env python3
"""
clip-cli: Upload video to Instagram Reels via Graph API
Requires a Facebook/Instagram Business account and app credentials.
"""

import sys
import json
import os
import requests
import time

CONFIG_PATH = os.path.expanduser("~/.clip-cli/config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def upload_instagram_reel(video_path, caption=""):
    config = load_config()
    ig_config = config.get("instagram", {})
    
    access_token = ig_config.get("access_token")
    ig_user_id = ig_config.get("business_account_id")
    
    if not access_token or not ig_user_id:
        print("ERROR: Instagram credentials not configured. Run: clip auth login --platform instagram")
        sys.exit(1)
    
    # Step 1: Create container
    print("Creating upload container...", file=sys.stderr)
    create_url = f"https://graph.facebook.com/v18.0/{ig_user_id}/media"
    
    # Upload video from local file
    # Instagram requires a public URL, so we need to upload to a temporary host
    # or use the local file upload approach
    
    # For now, we use the local file approach with the reels_upload_spec
    with open(video_path, "rb") as f:
        video_data = f.read()
    
    # Step 1: Initialize upload session
    init_response = requests.post(
        f"https://graph.facebook.com/v18.0/{ig_user_id}/media",
        data={
            "media_type": "REELS",
            "access_token": access_token,
            "caption": caption[:2200],  # Instagram max 2200 chars
        }
    )
    init_data = init_response.json()
    container_id = init_data.get("id")
    
    if not container_id:
        print(f"ERROR: Failed to create container: {init_data}", file=sys.stderr)
        sys.exit(1)
    
    # Step 2: Upload video data
    upload_url = f"https://graph.facebook.com/v18.0/{container_id}"
    requests.post(
        upload_url,
        data={"access_token": access_token, "upload_phase": "start"},
        files={"video_file": (os.path.basename(video_path), video_data, "video/mp4")}
    )
    
    # Step 3: Wait for processing
    print("Processing reel...", file=sys.stderr)
    for _ in range(60):
        status_response = requests.get(
            f"https://graph.facebook.com/v18.0/{container_id}",
            params={"fields": "status_code", "access_token": access_token}
        ).json()
        
        status = status_response.get("status_code")
        if status == "FINISHED":
            break
        elif status == "ERROR":
            print(f"ERROR: {status_response}", file=sys.stderr)
            sys.exit(1)
        time.sleep(5)
    
    # Step 4: Publish
    publish_response = requests.post(
        f"https://graph.facebook.com/v18.0/{ig_user_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": access_token,
        }
    ).json()
    
    media_id = publish_response.get("id", "unknown")
    print(media_id)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: instagram_upload.py <video_path> [caption]", file=sys.stderr)
        sys.exit(1)
    
    upload_instagram_reel(
        video_path=sys.argv[1],
        caption=sys.argv[2] if len(sys.argv) > 2 else "",
    )