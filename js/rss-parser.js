// js/rss-parser.js
export async function fetchAndParseRSS(url) {
    try {
        const response = await fetch(url);
        const xmlText = await response.text();
        const dom = new DOMParser().parseFromString(xmlText, "text/xml");
        const channel = dom.querySelector("channel");

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
            title: channel.querySelector("title")?.textContent || "播客",
            author: channel.querySelector("itunes\\:author, author")?.textContent || "李诞",
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
        return null;
    }
}
