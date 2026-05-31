#!/usr/bin/env python3
"""
clip-cli: Upload video to YouTube Shorts via YouTube Data API v3
Requires OAuth2 credentials configured via `clip auth login`
"""

import sys
import json
import os
import google.oauth2.credentials
import google_auth_oauthlib.flow
import googleapiclient.discovery
from googleapiclient.http import MediaFileUpload

CONFIG_PATH = os.path.expanduser("~/.clip-cli/config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def upload_video(video_path, title, description="", tags="", category_id="22"):
    config = load_config()
    yt_config = config.get("youtube", {})
    client_secrets = yt_config.get("client_secrets_file")
    
    if not client_secrets or not os.path.exists(client_secrets):
        print("ERROR: YouTube client secrets file not configured. Run: clip auth login --platform youtube")
        sys.exit(1)
    
    # OAuth2 flow
    scopes = ["https://www.googleapis.com/auth/youtube.upload"]
    flow = google_auth_oauthlib.flow.InstalledAppFlow.from_client_secrets_file(
        client_secrets, scopes
    )
    credentials = flow.run_local_server(port=0)
    
    youtube = googleapiclient.discovery.build("youtube", "v3", credentials=credentials)
    
    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    
    request = youtube.videos().insert(
        part="snippet,status",
        body={
            "snippet": {
                "title": title[:100],  # YouTube max 100 chars
                "description": description[:5000],
                "tags": tags_list,
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": "public",
                "madeForKids": False,
                "selfDeclaredMadeForKids": False,
            },
        },
        media_body=MediaFileUpload(video_path, chunksize=-1, resumable=True),
    )
    
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"Upload progress: {int(status.progress() * 100)}%", file=sys.stderr)
    
    video_id = response["id"]
    print(video_id)  # stdout for CLI consumption

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: youtube_upload.py <video_path> [title] [description] [tags]", file=sys.stderr)
        sys.exit(1)
    
    upload_video(
        video_path=sys.argv[1],
        title=sys.argv[2] if len(sys.argv) > 2 else "Clip",
        description=sys.argv[3] if len(sys.argv) > 3 else "",
        tags=sys.argv[4] if len(sys.argv) > 4 else "",
    )