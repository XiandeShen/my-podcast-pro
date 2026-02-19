// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,
    _lastSystemSync: 0, 

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        
        // 只有在切换新歌时才重置并加载
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }

        // 核心修复：确保在音频元数据加载后再同步一次总时长，防止 undefined
        this.audio.onloadedmetadata = () => {
            this.syncMediaSession();
        };
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.syncMediaSession();
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            const current = this.audio.currentTime;
            const total = this.audio.duration;
            
            // 将原始秒数传给 UI 层处理
            if (this._onTimeUpdate) {
                this._onTimeUpdate(current, total);
            }
            
            // 每秒向手机锁屏系统汇报一次进度
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

        // 核心修复：只有当 duration 真实存在且有效时，才同步给系统
        if ('mediaSession' in navigator && d && !isNaN(d) && d !== Infinity) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: d,
                    playbackRate: this.audio.playbackRate || 1,
                    position: p
                });
            } catch (e) {
                console.warn("MediaSession 同步失败:", e);
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
                    { src: cover, sizes: '192x192' },
                    { src: cover, sizes: '256x256' },
                    { src: cover, sizes: '384x384' },
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
            navigator.mediaSession.setActionHandler('seekbackward', () => { if(window.seekOffset) window.seekOffset(-15); else this.audio.currentTime -= 15; });
            navigator.mediaSession.setActionHandler('seekforward', () => { if(window.seekOffset) window.seekOffset(15); else this.audio.currentTime += 15; });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                    this.syncMediaSession();
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
        if (this.audio.duration && !isNaN(this.audio.duration)) {
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
