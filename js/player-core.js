// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,
    _lastSystemSync: 0, 

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }

        this.audio.onloadedmetadata = () => { this.syncMediaSession(); };
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.syncMediaSession(); // 播放开始立即同步
            }).catch(e => console.error("播放报错:", e));
        }

        this.audio.ontimeupdate = () => {
            const rawCurrent = this.audio.currentTime || 0;
            const rawDuration = this.audio.duration;
            
            const isDurationValid = rawDuration && !isNaN(rawDuration) && rawDuration !== Infinity;
            const pct = isDurationValid ? (rawCurrent / rawDuration) * 100 : 0;
            const currentStr = this.format(rawCurrent);
            const durationStr = isDurationValid ? this.format(rawDuration) : "--:--";

            if (this._onTimeUpdate) {
                this._onTimeUpdate(pct, currentStr, durationStr);
            }
            
            // 正常播放时每秒同步一次
            const now = Date.now();
            if (now - this._lastSystemSync > 1000) {
                this.syncMediaSession();
                this._lastSystemSync = now;
            }
        };

        // --- 核心修复：监听暂停和播放，立即强制同步系统状态 ---
        this.audio.onplay = () => { 
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
                this.syncMediaSession(); 
            }
        };
        this.audio.onpause = () => { 
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
                this.syncMediaSession(); // 暂停时立即上报 rate: 0
            }
        };
    },

    syncMediaSession() {
        if (!('mediaSession' in navigator)) return;

        const d = this.audio.duration;
        const p = this.audio.currentTime;
        const isPaused = this.audio.paused; // 获取当前播放器是否暂停
        const isValid = d && !isNaN(d) && d !== Infinity;

        try {
            const state = {
                // 核心修复：如果暂停，速率传0；如果播放，传实际速率（通常是1）
                // 这样手机系统就会停止锁屏进度条的“自增预测”
                playbackRate: isPaused ? 0 : (this.audio.playbackRate || 1),
                // 核心修复：使用 Math.floor 去除小数，防止系统进位错误
                position: Math.floor(p) || 0
            };
            
            if (isValid) {
                state.duration = Math.floor(d);
            }
            
            navigator.mediaSession.setPositionState(state);
        } catch (e) {
            console.warn("MediaSession 同步失败:", e);
        }
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [ { src: cover, sizes: '512x512' } ]
            });

            navigator.mediaSession.setActionHandler('play', () => this.audio.play());
            navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                    this.syncMediaSession();
                }
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => { this.audio.currentTime -= 15; });
            navigator.mediaSession.setActionHandler('seekforward', () => { this.audio.currentTime += 15; });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; }
        else { this.audio.pause(); return false; }
    },

    seek(pct) {
        if (this.audio.duration && !isNaN(this.audio.duration) && this.audio.duration !== Infinity) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
            this.syncMediaSession();
        }
    },

    format(s) {
        if (isNaN(s) || s === Infinity) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
