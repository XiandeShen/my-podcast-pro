import feedparser
import json
import os

def update_podcast():
    json_path = 'default.json'
    if not os.path.exists(json_path): return

    with open(json_path, 'r', encoding='utf-8') as f:
        podcasts = json.load(f)

    for pod in podcasts:
        rss_url = pod.get('feedUrl')
        if not rss_url: continue
        
        try:
            feed = feedparser.parse(rss_url)
            chan = feed.channel
            
            # --- 自动补全标题和作者 ---
            if not pod.get('title'):
                pod['title'] = chan.get('title', "未知节目")
            
            # 新增：抓取作者名 (优先抓取 itunes:author 或 dc:creator)
            pod['author'] = chan.get('author', chan.get('itunes_author', "未知作者"))
            
            print(f"正在同步: {pod['title']} - {pod['author']}")

            # 封面图逻辑
            itunes_img = chan.get('itunes_image', {}).get('href', "")
            std_img = chan.get('image', {}).get('url', "")
            pod['image'] = itunes_img or std_img or pod.get('image', "")

            # 处理剧集 (仅保留最新 15 集，防止 JSON 文件过大导致你看不见后面的节目)
            new_episodes = []
            for entry in feed.entries[:15]:
                audio = entry.enclosures[0].href if 'enclosures' in entry and entry.enclosures else ""
                new_episodes.append({
                    "title": entry.title,
                    "audioUrl": audio,
                    "image": entry.get('itunes_image', {}).get('href', "") or pod['image'],
                    "isFinished": False
                })
            pod['episodes'] = new_episodes

        except Exception as e:
            print(f"同步 {pod.get('title')} 失败: {e}")

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(podcasts, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_podcast()
