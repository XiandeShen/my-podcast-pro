// js/rss-parser.js
export async function fetchAndParseRSS(url) {
    try {
        const response = await fetch(url);
        const xmlText = await response.text();
        const dom = new DOMParser().parseFromString(xmlText, "text/xml");
        const channel = dom.querySelector("channel");

        const getImg = (el) => {
            if (!el) return "";
            const itunesImg = el.getElementsByTagName("itunes:image")[0] || el.querySelector("image");
            if (itunesImg) {
                return itunesImg.getAttribute("href") || itunesImg.querySelector("url")?.textContent || "";
            }
            return "";
        };

        const podcastImage = getImg(channel);

        return {
            title: channel.querySelector("title")?.textContent || "未知播客",
            author: channel.querySelector("itunes\\:author, author")?.textContent || "未知作者",
            image: podcastImage,
            episodes: Array.from(dom.querySelectorAll("item")).map(item => {
                return {
                    title: item.querySelector("title")?.textContent,
                    audioUrl: item.querySelector("enclosure")?.getAttribute("url"),
                    image: getImg(item) || podcastImage 
                };
            })
        };
    } catch (error) {
        console.error("RSS 解析失败:", error);
        return null;
    }
}
