// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        this.audio.src = url;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                // 仅在成功播放后，明确通知系统：开始计时
                this.forceSystemSync("playing");
            }).catch(error => console.error("Playback Error:", error));
        }

        // 关键：元数据加载后，只同步一次总时长，不频繁同步当前位置
        this.audio.onloadedmetadata = () => {
            this.forceSystemSync();
        };

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            const currentStr = this.format(cur);
            const totalStr = this.format(dur);
            const pct = (cur / dur) * 100 || 0;
            
            if (this._onTimeUpdate) this._onTimeUpdate(pct, currentStr, totalStr);
            
            // 注意：这里删除了 navigator.mediaSession.setPositionState
            // 绝不在定时器里频繁调用它，这会和三星系统的内部计时器冲突导致归零
        };

        // 监听原生状态改变，这是同步的最佳时机
        this.audio.onplay = () => this.forceSystemSync("playing");
        this.audio.onpause = () => this.forceSystemSync("paused");
        
        // 当用户在网页进度条拖动完成后，同步一次
        this.audio.onseeked = () => this.forceSystemSync();
    },

    // 核心修复函数：强制同步状态
    forceSystemSync(state = null) {
        if (!('mediaSession' in navigator)) return;

        // 1. 先更新播放状态（playing/paused）
        if (state) {
            navigator.mediaSession.playbackState = state;
        }

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        // 2. 只有在有明确时长且非 0 时才上报
        if (dur && !isNaN(dur) && dur > 0) {
            try {
                // 必须确保 cur 永远小于 dur，哪怕差 0.1 秒
                const safePos = Math.min(cur, dur - 0.1);
                
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: Math.max(0, safePos),
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                console.warn("MediaSession Sync Error:", e);
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
                    { src: cover, sizes: '512x512' }
                ]
            });

            // 注册系统回调
            navigator.mediaSession.setActionHandler('play', () => {
                this.audio.play();
                // 这里的状态由 onplay 监听器统一处理
                if(window.updatePlayIcons) window.updatePlayIcons(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                this.audio.pause();
                // 这里的状态由 onpause 监听器统一处理
                if(window.updatePlayIcons) window.updatePlayIcons(false);
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                if(window.seekOffset) window.seekOffset(-15);
                this.forceSystemSync();
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                if(window.seekOffset) window.seekOffset(15);
                this.forceSystemSync();
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                    // 跳转瞬间同步一次位置
                    this.forceSystemSync();
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
        if (this.audio.duration) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
            this.forceSystemSync();
        }
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
