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
                this.syncMediaSession();
            }).catch(e => console.error("播放报错:", e));
        }

        this.audio.ontimeupdate = () => {
            const rawCurrent = this.audio.currentTime || 0;
            const rawDuration = this.audio.duration;
            
            // 核心修复：直接在核心层做好所有防错和格式化
            const isDurationValid = rawDuration && !isNaN(rawDuration) && rawDuration !== Infinity;
            const pct = isDurationValid ? (rawCurrent / rawDuration) * 100 : 0;
            const currentStr = this.format(rawCurrent);
            const durationStr = isDurationValid ? this.format(rawDuration) : "--:--";

            // 直接传计算好的结果给 UI
            if (this._onTimeUpdate) {
                this._onTimeUpdate(pct, currentStr, durationStr);
            }
            
            // 节流同步系统锁屏
            const now = Date.now();
            if (now - this._lastSystemSync > 1000) {
                this.syncMediaSession();
                this._lastSystemSync = now;
            }
        };

        this.audio.onplay = () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing"; };
        this.audio.onpause = () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused"; };
    },

    syncMediaSession() {
        const d = this.audio.duration;
        const p = this.audio.currentTime;
        const isValid = d && !isNaN(d) && d !== Infinity;

        if ('mediaSession' in navigator) {
            try {
                // 核心修复：如果音频没给出总时长（Infinity），就不传 duration，防止锁屏进度条暴走
                const state = {
                    playbackRate: this.audio.playbackRate || 1,
                    position: p || 0
                };
                if (isValid) state.duration = d; 
                
                navigator.mediaSession.setPositionState(state);
            } catch (e) {
                console.warn("系统锁屏同步失败:", e);
            }
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
