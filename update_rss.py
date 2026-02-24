import feedparser
import json
import os

def update_podcast():
    json_path = 'default.json'
    if not os.path.exists(json_path): return

    with open(json_path, 'r', encoding='utf-8') as f:
        podcasts = json.load(f)

    print(f"开始全量同步，共有 {len(podcasts)} 个节目...")

    for pod in podcasts:
        rss_url = pod.get('feedUrl')
        if not rss_url: continue
        
        try:
            feed = feedparser.parse(rss_url)
            chan = feed.channel
            
            # 自动补全基础信息
            pod['title'] = pod.get('title') or chan.get('title', "未知节目")
            pod['author'] = chan.get('itunes_author') or chan.get('author') or "未知作者"
            
            print(f"正在抓取全量剧集: {pod['title']}")

            # 封面图逻辑
            itunes_img = chan.get('itunes_image', {}).get('href', "")
            std_img = chan.get('image', {}).get('url', "")
            pod['image'] = itunes_img or std_img or pod.get('image', "")

            # --- 核心修改：去掉 [:15]，抓取所有 entries ---
            new_episodes = []
            for entry in feed.entries:
                audio = ""
                if 'enclosures' in entry and entry.enclosures:
                    audio = entry.enclosures[0].href
                
                # 单集封面逻辑
                ep_img = entry.get('itunes_image', {}).get('href', "") or \
                         entry.get('image', {}).get('url', "") or \
                         pod['image']

                new_episodes.append({
                    "title": entry.title,
                    "audioUrl": audio,
                    "image": ep_img,
                    "isFinished": False
                })
            
            pod['episodes'] = new_episodes
            print(f"  ✅ 成功同步 {len(new_episodes)} 集")

        except Exception as e:
            print(f"  ❌ 同步 {pod.get('title', '未知')} 失败: {e}")
            continue

    # 保存结果
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(podcasts, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_podcast()
