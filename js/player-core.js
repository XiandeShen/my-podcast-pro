// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,
    _lastSystemSync: 0, 

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        
        // 只有在切换新歌时才重置
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.syncMediaSession(); // 播放开始立即同步
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            const current = this.audio.currentTime;
            const total = this.audio.duration;
            const pct = (current / total) * 100 || 0;
            
            // 执行网页 UI 回调
            if (this._onTimeUpdate) {
                this._onTimeUpdate(current, total);
            }
            
            // --- 核心修复：节流系统同步 (每秒执行一次) ---
            const now = Date.now();
            if (now - this._lastSystemSync > 1000) {
                this.syncMediaSession();
                this._lastSystemSync = now;
            }
        };

        // 监听系统控制器的状态变化
        this.audio.onplay = () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing"; };
        this.audio.onpause = () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused"; };
    },

    // 强制同步时间到锁屏界面
    syncMediaSession() {
        if ('mediaSession' in navigator && this.audio.duration && isFinite(this.audio.duration)) {
            navigator.mediaSession.setPositionState({
                duration: this.audio.duration,
                playbackRate: this.audio.playbackRate,
                position: this.audio.currentTime
            });
        }
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [
                    { src: cover, sizes: '96x96' },
                    { src: cover, sizes: '512x512' }
                ]
            });

            // 锁屏控制逻辑
            navigator.mediaSession.setActionHandler('play', () => this.audio.play());
            navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime) {
                    this.audio.currentTime = details.seekTime;
                    this.syncMediaSession();
                }
            });
            // 选填：快进/快退
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
        if (this.audio.duration) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
            this.syncMediaSession();
        }
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
