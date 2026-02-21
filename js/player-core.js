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
                // 初始播放同步
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
            // 此时不再在 ontimeupdate 中同步，让系统组件自己走
        };

        // 监听底层状态
        this.audio.onplay = () => this.forceSystemSync("playing");
        this.audio.onpause = () => this.forceSystemSync("paused");
        
        // 关键：跳转结束后的校准
        this.audio.onseeked = () => {
            this.forceSystemSync(this.audio.paused ? "paused" : "playing");
        };
    },

    /**
     * 核心同步逻辑：解决跳转归零
     * 采用苹果策略：在跳转时，如果系统出现混乱，
     * 我们通过重新声明状态来“强行校准”系统计时器。
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
                // 1. 先进行极其微小的偏移，避免恰好在整数秒导致系统逻辑冲突
                const safePos = Math.max(0, Math.min(cur, dur - 0.1));
                
                // 2. 核心操作：重新设置位置状态
                // 必须带上 playbackRate，否则系统会默认从 0 开始预测
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: safePos,
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

            navigator.mediaSession.setActionHandler('play', () => {
                this.audio.play();
                if(window.updatePlayIcons) window.updatePlayIcons(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                this.audio.pause();
                if(window.updatePlayIcons) window.updatePlayIcons(false);
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                const target = Math.max(0, this.audio.currentTime - 15);
                this.audio.currentTime = target;
                this.forceSystemSync();
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                const target = Math.min(this.audio.duration, this.audio.currentTime + 15);
                this.audio.currentTime = target;
                this.forceSystemSync();
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    // 三星系统关键修复：跳转时必须先更新 audio 时间
                    this.audio.currentTime = details.seekTime;
                    // 然后立即强刷一次系统状态，覆盖掉系统的自动清零行为
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
            const targetTime = (pct / 100) * this.audio.duration;
            this.audio.currentTime = targetTime;
            // 网页端拖动时，同步给系统
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
