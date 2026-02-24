import feedparser
import json
import os

def update_podcast():
    json_path = 'default.json'
    if not os.path.exists(json_path):
        print("错误：找不到 default.json")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        podcasts = json.load(f)

    for pod in podcasts:
        rss_url = pod.get('feedUrl')
        if not rss_url: continue
        
        print(f"正在同步: {pod.get('title')}")
        try:
            feed = feedparser.parse(rss_url)
            
            # 1. 寻找播客大图 (多重备份路径)
            chan = feed.channel
            # 优先级：iTunes标签 > RSS Image标签 > 备份文件原有图片
            pgm_img = chan.get('itunes_image', {}).get('href') or \
                      chan.get('image', {}).get('url') or \
                      pod.get('image', "")

            pod['image'] = pgm_img

            # 2. 处理剧集
            new_episodes = []
            for entry in feed.entries[:20]:
                audio = ""
                if 'enclosures' in entry and entry.enclosures:
                    audio = entry.enclosures[0].href
                
                # 3. 寻找单集图片 (关键修复)
                # 很多播客单集没有图，如果没有，必须强制使用播客大图，不能留空
                ep_img = entry.get('itunes_image', {}).get('href') or \
                         entry.get('image', {}).get('url') or \
                         pgm_img

                new_episodes.append({
                    "title": entry.title,
                    "audioUrl": audio,
                    "image": ep_img,
                    "isFinished": False
                })
            
            if new_episodes:
                pod['episodes'] = new_episodes

        except Exception as e:
            print(f"解析失败: {e}")

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(podcasts, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_podcast()
