// js/rss-parser.js
export async function fetchAndParseRSS(url) {
    try {
        // 使用 CORS 代理解决 GitHub Pages 跨域请求被拦截的问题
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error("代理请求失败");
        
        const data = await response.json();
        const xmlText = data.contents; // allorigins 返回的 JSON 对象中 contents 才是原始 XML
        
        const dom = new DOMParser().parseFromString(xmlText, "text/xml");
        const channel = dom.querySelector("channel");

        if (!channel) {
            throw new Error("无效的 RSS 格式");
        }

        // 核心修复：针对李诞 RSS 特殊标签的稳健提取逻辑
        const getImg = (el) => {
            if (!el) return "";
            // 方式 A: 获取 itunes:image 标签的 href 属性 (李诞 RSS 的标准方式)
            const itunesImg = el.getElementsByTagName("itunes:image")[0];
            if (itunesImg) {
                const href = itunesImg.getAttribute("href");
                if (href) return href;
            }
            // 方式 B: 获取标准 XML image 标签
            const standardImg = el.querySelector("image > url");
            if (standardImg) return standardImg.textContent;
            
            return "";
        };

        const podcastImage = getImg(channel);

        return {
            title: channel.querySelector("title")?.textContent || "李诞",
            author: channel.querySelector("itunes\\:author, author")?.textContent || "李诞",
            image: podcastImage,
            episodes: Array.from(dom.querySelectorAll("item")).map(item => {
                const epImg = getImg(item);
                return {
                    title: item.querySelector("title")?.textContent,
                    audioUrl: item.querySelector("enclosure")?.getAttribute("url"),
                    // 如果单集没有封面，就自动回退使用播客大封面
                    image: epImg || podcastImage 
                };
            })
        };
    } catch (error) {
        console.error("RSS 解析失败:", error);
        return null;
    }
}
