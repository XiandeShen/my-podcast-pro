// js/player-core.js

// 核心突破点：创建 audio 元素并必须将其塞入 DOM 树中
// 这是解决安卓/iOS系统组件“时间归零”、“进度不同步”的终极物理方案
const sysAudio = new Audio();
sysAudio.id = "core-audio-player";
sysAudio.style.display = "none";
document.body.appendChild(sysAudio);

export const PlayerCore = {
    // 绑定挂载到 DOM 的实体元素
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

        // 统一交给浏览器原生事件去驱动系统组件
        this.audio.onloadedmetadata = () => this.updateMediaSessionState();
        
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            // 新增：每次时间更新都同步到系统组件
            this.updateMediaSessionState();
        };

        // 监听原生动作进行同步
        this.audio.onplay = () => this.updateMediaSessionState();
        this.audio.onpause = () => this.updateMediaSessionState();
        this.audio.onseeked = () => this.updateMediaSessionState();
        this.audio.onratechange = () => this.updateMediaSessionState();
    },

    // 纯粹的同步函数
    updateMediaSessionState() {
        if (!('mediaSession' in navigator)) return;

        // 同步播放状态
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        // 核心保护：很多播客 RSS 返回的时长最初可能是 Infinity 或 NaN
        // 如果把这些非法值传给三星系统，系统组件就会崩溃并归零。
        // 所以必须用 Number.isFinite 确保是正常的数字
        if (dur && Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: cur,
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
                    { src: cover, sizes: '512x512' }
                ]
            });

            // 所有的控制均只操作 DOM 元素，由 DOM 元素的 onplay/onpause 事件自动回调去同步系统
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
        if (this.audio.paused) { this.audio.play(); return true; }
        else { this.audio.pause(); return false; }
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
