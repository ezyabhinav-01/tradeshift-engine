import feedparser
import re
import html

url = "https://www.moneycontrol.com/rss/latestnews.xml"
feed = feedparser.parse(url)

print(f"📄 Feed Title: {feed.feed.get('title')}")
for i, entry in enumerate(feed.entries[:5]):
    print(f"\n[{i+1}] Title: {entry.get('title')}")
    desc = entry.get('description', '')
    print(f"   Desc (raw): {desc[:200]}...")
    
    # Try looking for img in desc
    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc, re.IGNORECASE)
    if img_match:
        print(f"   ✅ Found Image in Desc: {img_match.group(1)}")
    else:
        # Try unescaping it just in case
        unescaped_desc = html.unescape(desc)
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', unescaped_desc, re.IGNORECASE)
        if img_match:
            print(f"   ✅ Found Image in Unescaped Desc: {img_match.group(1)}")
        else:
            print("   ❌ No image found in description.")
