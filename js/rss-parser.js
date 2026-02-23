// js/rss-parser.js
export async function fetchAndParseRSS(url) {
    try {
        // 使用 allorigins 代理服务绕过 GitHub Pages 的跨域限制 (CORS)
        // 它会代替浏览器去抓取内容，然后以 JSON 格式返回给我们
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("网络请求失败");
        
        const data = await response.json();
        // data.contents 里面才是真正的 XML 文本内容
        const xmlText = data.contents;
        
        const dom = new DOMParser().parseFromString(xmlText, "text/xml");
        const channel = dom.querySelector("channel");

        if (!channel) {
            throw new Error("解析失败：未能找到 RSS 频道信息");
        }

        // 提取图片的逻辑 (保持你原有的逻辑，兼容 itunes 标签)
        const getImg = (el) => {
            if (!el) return "";
            const itunesImg = el.getElementsByTagName("itunes:image")[0];
            if (itunesImg) {
                const href = itunesImg.getAttribute("href");
                if (href) return href;
            }
            const standardImg = el.querySelector("image > url");
            if (standardImg) return standardImg.textContent;
            return "";
        };

        const podcastImage = getImg(channel);

        return {
            title: channel.querySelector("title")?.textContent || "未知播客",
            author: channel.querySelector("itunes\\:author, author")?.textContent || "未知作者",
            image: podcastImage,
            episodes: Array.from(dom.querySelectorAll("item")).map(item => {
                const epImg = getImg(item);
                return {
                    title: item.querySelector("title")?.textContent,
                    audioUrl: item.querySelector("enclosure")?.getAttribute("url"),
                    image: epImg || podcastImage 
                };
            })
        };
    } catch (error) {
        console.error("RSS 解析失败:", error);
        alert("导入失败：可能是 RSS 链接无效或服务器响应慢。");
        return null;
    }
}
