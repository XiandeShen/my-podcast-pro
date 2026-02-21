// js/player-core.js

// 核心突破点：直接绑定 DOM 实体元素，解决三星系统组件归零问题
const getAudioElement = () => {
    let el = document.getElementById('main-audio-player');
    if (!el) {
        // 防御性处理：如果 index.html 没写，脚本自动创建一个并挂载
        el = document.createElement('audio');
        el.id = 'main-audio-player';
        el.style.display = 'none';
        document.body.appendChild(el);
    }
    return el;
};

const sysAudio = getAudioElement();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        this.audio.src = url;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.updateMediaSessionState();
            }).catch(error => console.error("Playback Error:", error));
        }

        // 统一交给浏览器原生事件驱动系统组件
        this.audio.onloadedmetadata = () => this.updateMediaSessionState();
        
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                // 确保传递给网页 UI 的数据也是安全的
                const safePct = (cur / dur) * 100 || 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(dur));
            }
        };

        // 监听原生动作进行同步
        this.audio.onplay = () => this.updateMediaSessionState();
        this.audio.onpause = () => this.updateMediaSessionState();
        this.audio.onseeked = () => this.updateMediaSessionState();
        this.audio.onratechange = () => this.updateMediaSessionState();
    },

    // 纯粹的同步函数：强制执行“原子化”同步
    updateMediaSessionState() {
        if (!('mediaSession' in navigator)) return;

        // 1. 同步播放状态
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        // 2. 只有在有明确、有限数值的时长时才上报给系统
        // 使用 Number.isFinite 过滤 Infinity（流媒体常见问题）
        if (dur && Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: Math.max(0, Math.min(cur, dur - 0.1)),
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (error) {
                console.warn("MediaSession API Error:", error);
            }
        }
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [
                    { src: cover, sizes: '96x96' },
                    { src: cover, sizes: '128x128' },
                    { src: cover, sizes: '256x256' },
                    { src: cover, sizes: '384x384' },
                    { src: cover, sizes: '512x512' }
                ]
            });

            // 锁屏控制：直接操作实体 DOM 元素，让上面的事件监听器自动处理同步
            navigator.mediaSession.setActionHandler('play', () => { this.audio.play(); });
            navigator.mediaSession.setActionHandler('pause', () => { this.audio.pause(); });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
                    this.audio.currentTime = details.seekTime;
                }
            });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { 
            this.audio.play(); 
            return true; 
        } else { 
            this.audio.pause(); 
            return false; 
        }
    },

    seek(pct) {
        if (this.audio.duration && Number.isFinite(this.audio.duration)) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
        }
    },

    format(s) {
        if (isNaN(s) || !Number.isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
