// js/rss-parser.js
export async function fetchAndParseRSS(url) {
    try {
        const response = await fetch(url);
        const xmlText = await response.text();
        const dom = new DOMParser().parseFromString(xmlText, "text/xml");
        const channel = dom.querySelector("channel");

        if (!channel) return null;

        // 处理命名空间，兼容更多平台的 XML 结构
        const getImg = (el) => {
            if (!el) return "";
            // 1. iTunes 命名空间 (大部分播客使用的标准)
            let itunesImg = el.getElementsByTagNameNS("http://www.itunes.com/dtds/podcast-1.0.dtd", "image")[0];
            if (itunesImg) return itunesImg.getAttribute("href") || "";

            // 2. 直接获取 itunes:image
            const itImg = el.getElementsByTagName("itunes:image")[0];
            if (itImg) return itImg.getAttribute("href") || "";

            // 3. 标准 XML image 标签
            const standardImg = el.querySelector("image > url");
            if (standardImg) return standardImg.textContent;
            
            return "";
        };

        const podcastImage = getImg(channel);

        return {
            title: channel.querySelector("title")?.textContent || "未知节目",
            author: channel.querySelector("itunes\\:author, author")?.textContent || "未知作者",
            image: podcastImage,
            episodes: Array.from(dom.querySelectorAll("item")).map(item => {
                const epImg = getImg(item);
                return {
                    title: item.querySelector("title")?.textContent || "无标题",
                    audioUrl: item.querySelector("enclosure")?.getAttribute("url"),
                    image: epImg || podcastImage, // 单集无封面则回退到节目封面
                    isFinished: false,
                    currentTime: 0,
                    duration: 0
                };
            })
        };
    } catch (error) {
        console.error("RSS 解析失败:", error);
        return null;
    }
}
