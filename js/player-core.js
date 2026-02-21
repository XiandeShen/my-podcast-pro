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
                this.forceSystemSync("playing");
            }).catch(error => console.error("Playback Error:", error));
        }

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
            // 正常播放期间完全交给系统自己走，不进行任何干预，防止竞争
        };

        // 核心修复：跳转状态的原子化同步
        this.audio.onplay = () => this.forceSystemSync("playing");
        this.audio.onpause = () => this.forceSystemSync("paused");
        
        // 当跳转完成时，采用“先停再播”的欺骗策略来强制校准三星系统
        this.audio.onseeked = () => {
            if ('mediaSession' in navigator) {
                // 1. 瞬间声明暂停，清空系统组件的计时器预测
                navigator.mediaSession.playbackState = "paused";
                
                // 2. 延迟 10 毫秒后再发送正确的位置和状态
                setTimeout(() => {
                    const isPaused = this.audio.paused;
                    this.forceSystemSync(isPaused ? "paused" : "playing");
                }, 10);
            }
        };
    },

    /**
     * 强力同步函数：
     * 针对三星系统，确保每一次 positionState 更新都伴随着明确的速率声明
     */
    forceSystemSync(state = null) {
        if (!('mediaSession' in navigator)) return;

        if (state) {
            navigator.mediaSession.playbackState = state;
        }

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        if (dur && !isNaN(dur) && dur > 0) {
            try {
                // 边界保护：三星在接近结束时同步容易报错归零
                const safePos = Math.max(0, Math.min(cur, dur - 0.2));
                
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: safePos,
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                // 捕获可能由于音频未完全 Ready 导致的调用异常
                console.warn("MediaSession PositionState error:", e);
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

            // 系统回调处理
            navigator.mediaSession.setActionHandler('play', () => {
                this.audio.play();
                if(window.updatePlayIcons) window.updatePlayIcons(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                this.audio.pause();
                if(window.updatePlayIcons) window.updatePlayIcons(false);
            });
            
            // 系统组件内的快进/快退，直接改变 currentTime 触发 onseeked
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
            });
            
            // 系统组件进度条拖动
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                    // 跳转逻辑会由 onseeked 自动接管并同步
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
            const targetTime = (pct / 100) * this.audio.duration;
            this.audio.currentTime = targetTime;
            // 网页端操作同样会触发 onseeked
        }
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
