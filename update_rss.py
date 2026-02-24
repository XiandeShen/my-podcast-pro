import feedparser
import json
import os

def update_podcast():
    json_path = 'default.json'
    
    # 1. 加载现有的资料库
    if not os.path.exists(json_path):
        print("错误：未找到 default.json 文件")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        podcasts = json.load(f)

    print(f"开始更新 {len(podcasts)} 个播客...")

    for pod in podcasts:
        rss_url = pod.get('feedUrl')
        if not rss_url:
            continue
        
        print(f"正在同步: {pod.get('title', '未知节目')}...")
        
        try:
            # 2. 解析 RSS
            feed = feedparser.parse(rss_url)
            if not feed.entries:
                print(f"  [跳过] RSS 源为空")
                continue

            # 3. 核心修复：独立获取该播客的官方封面（防止数据串台）
            # 逻辑：优先获取频道大图
            current_img = ""
            if 'itunes_image' in feed.channel:
                current_img = feed.channel.itunes_image.get('href', "")
            elif 'image' in feed.channel:
                current_img = feed.channel.image.get('url', "")
            
            # 只有抓取到新图片时才更新，否则保留原图
            if current_img:
                pod['image'] = current_img

            # 4. 填充备份结构中的描述和主页链接
            if not pod.get('description'):
                pod['description'] = feed.channel.get('summary', feed.channel.get('description', ""))
            if not pod.get('link'):
                pod['link'] = feed.channel.get('link', "")

            # 5. 抓取剧集 (限制最新 20 集，保持 JSON 体积轻量)
            new_episodes = []
            for entry in feed.entries[:20]:
                # 提取音频地址
                audio_url = ""
                if 'enclosures' in entry and len(entry.enclosures) > 0:
                    audio_url = entry.enclosures[0].href
                
                # 确定单集图片 (有单集封面用单集的，否则用频道图)
                ep_img = current_img
                if 'itunes_image' in entry:
                    ep_img = entry.itunes_image.get('href', current_img)

                new_episodes.append({
                    "title": entry.title,
                    "audioUrl": audio_url,
                    "image": ep_img,
                    "isFinished": False  # 初始化播放状态
                })
            
            pod['episodes'] = new_episodes
            print(f"  [成功] 已抓取 {len(new_episodes)} 集")

        except Exception as e:
            print(f"  [失败] {pod.get('title')}: {e}")

    # 6. 写回文件，保持格式美观
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(podcasts, f, ensure_ascii=False, indent=2)
    print("\n✅ 同步完成！")

if __name__ == "__main__":
    update_podcast()
