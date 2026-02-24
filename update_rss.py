import feedparser
import json
import os

def update_podcast():
    json_path = 'default.json'
    if not os.path.exists(json_path):
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        podcasts = json.load(f)

    for pod in podcasts:
        rss_url = pod.get('feedUrl')
        if not rss_url: continue
        
        try:
            feed = feedparser.parse(rss_url)
            
            # 1. 抓取播客大封面
            chan = feed.channel
            itunes_chan_img = chan.get('itunes_image', {}).get('href', "")
            standard_chan_img = chan.get('image', {}).get('url', "")
            channel_img = itunes_chan_img or standard_chan_img or pod.get('image', "")
            
            # 更新播客主封面
            pod['image'] = channel_img

            # 2. 处理剧集
            new_episodes = []
            for entry in feed.entries[:20]:
                # 获取音频
                audio = ""
                if 'enclosures' in entry and entry.enclosures:
                    audio = entry.enclosures[0].href
                
                # --- 核心修复：精准抓取单集封面 ---
                # 优先级：单集iTunes图 > 单集标准图 > 播客大封面
                ep_itunes_img = entry.get('itunes_image', {}).get('href', "")
                ep_std_img = entry.get('image', {}).get('url', "")
                
                # 只有当单集图存在且不等于空时才使用，否则用大图
                episode_cover = ep_itunes_img or ep_std_img or channel_img

                new_episodes.append({
                    "title": entry.title,
                    "audioUrl": audio,
                    "image": episode_cover,
                    "isFinished": False
                })
            
            pod['episodes'] = new_episodes
            print(f"成功同步: {pod.get('title')} (单集封面已独立)")

        except Exception as e:
            print(f"错误: {e}")

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(podcasts, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_podcast()
