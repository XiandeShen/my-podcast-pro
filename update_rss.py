import feedparser
import json
import os

def update_podcast():
    json_path = 'default.json'
    if not os.path.exists(json_path):
        print("Error: default.json not found")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        podcasts = json.load(f)

    for pod in podcasts:
        rss_url = pod.get('feedUrl')
        if not rss_url: continue
        
        print(f"Syncing: {pod['title']}")
        try:
            feed = feedparser.parse(rss_url)
            
            # 更新播客元数据
            if 'title' in feed.channel: pod['title'] = feed.channel.title
            if 'itunes_author' in feed.channel: pod['author'] = feed.channel.itunes_author
            
            # 提取剧集
            new_episodes = []
            for entry in feed.entries:
                audio_url = ""
                if 'enclosures' in entry and len(entry.enclosures) > 0:
                    audio_url = entry.enclosures[0].href
                
                # 封面逻辑：单集封面 > 播客封面
                img = pod['image']
                if 'itunes_image' in entry:
                    img = entry.itunes_image.get('href', img)

                new_episodes.append({
                    "title": entry.title,
                    "audioUrl": audio_url,
                    "image": img,
                    "isFinished": False
                })
            
            pod['episodes'] = new_episodes
        except Exception as e:
            print(f"Failed to update {pod['title']}: {e}")

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(podcasts, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_podcast()
