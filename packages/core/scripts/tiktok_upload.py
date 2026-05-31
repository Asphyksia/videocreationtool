#!/usr/bin/env python3
"""
clip-cli: Upload video to TikTok via browser automation (Playwright)
TikTok's API is very restrictive — browser automation is the practical approach.
"""

import sys
import os
import asyncio
from playwright.async_api import async_playwright

CONFIG_PATH = os.path.expanduser("~/.clip-cli/config.json")

async def upload_tiktok(video_path, title="", tags=""):
    from playwright.async_api import async_playwright
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Needs visible browser for auth
        context = await browser.new_context()
        
        # Check for saved auth state
        state_path = os.path.expanduser("~/.clip-cli/tiktok_state.json")
        if os.path.exists(state_path):
            await context.add_cookies(eval(open(state_path).read()))
        
        page = await context.new_page()
        await page.goto("https://www.tiktok.com/creator")
        
        # Wait for user to log in if needed
        await page.wait_for_url("**/creator*", timeout=300000)  # 5 min timeout for manual login
        
        # Save auth state for future use
        cookies = await context.cookies()
        with open(state_path, "w") as f:
            f.write(str(cookies))
        
        # Navigate to upload
        await page.goto("https://www.tiktok.com/creator#/upload")
        await page.wait_for_selector("input[type='file']", timeout=10000)
        
        # Upload video
        file_input = await page.query_selector("input[type='file']")
        await file_input.set_input_files(video_path)
        
        # Wait for upload to process
        await page.wait_for_selector("div.progress-bar", state="hidden", timeout=300000)
        
        # Set caption
        caption_input = await page.query_selector('[data-e2e="upload-caption-input"]')
        if caption_input:
            caption = title
            if tags:
                caption += " " + " ".join(f"#{t.strip()}" for t in tags.split(","))
            await caption_input.fill(caption[:150])  # TikTok max 150 chars (includes hashtags)
            # Note: for longer captions, we'd need to use the desktop creator portal
        
        # Click post
        post_btn = await page.query_selector('[data-e2e="upload-post-btn"]')
        if post_btn:
            await post_btn.click()
        
        # Wait for confirmation
        await page.wait_for_selector('[data-e2e="upload-success-modal"]', timeout=60000)
        
        # Extract video URL from success screen
        video_link = await page.query_selector('[data-e2e="upload-success-modal"] a')
        video_url = await video_link.get_attribute("href") if video_link else ""
        
        await browser.close()
        
        # Extract video ID from URL
        video_id = video_url.split("/video/")[-1].split("?")[0] if video_url else "unknown"
        print(video_id)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: tiktok_upload.py <video_path> [title] [tags]", file=sys.stderr)
        sys.exit(1)
    
    asyncio.run(upload_tiktok(
        video_path=sys.argv[1],
        title=sys.argv[2] if len(sys.argv) > 2 else "",
        tags=sys.argv[3] if len(sys.argv) > 3 else "",
    ))