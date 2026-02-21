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
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "playing";
                }
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.onloadedmetadata = () => {
            this.updateSystemPositionState();
        };

        this.audio.ontimeupdate = () => {
            const current = this.format(this.audio.currentTime);
            const total = this.format(this.audio.duration);
            const pct = (this.audio.currentTime / this.audio.duration) * 100 || 0;
            if (this._onTimeUpdate) this._onTimeUpdate(pct, current, total);
            
            // 正常播放时持续同步位置
            this.updateSystemPositionState();
        };
    },

    // 核心修复函数：向系统汇报精准的播放位置
    updateSystemPositionState() {
        if ('mediaSession' in navigator && this.audio.duration && !isNaN(this.audio.duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: this.audio.duration,
                    playbackPosition: this.audio.currentTime,
                    playbackRate: this.audio.playbackRate
                });
            } catch (e) {
                // 某些浏览器在时长无效时会抛错，增加防御
                console.warn("MediaSession Position Error:", e);
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
                navigator.mediaSession.playbackState = "playing";
                if(window.updatePlayIcons) window.updatePlayIcons(true); 
            });
            navigator.mediaSession.setActionHandler('pause', () => { 
                this.audio.pause(); 
                navigator.mediaSession.playbackState = "paused";
                if(window.updatePlayIcons) window.updatePlayIcons(false); 
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => { if(window.seekOffset) window.seekOffset(-15); });
            navigator.mediaSession.setActionHandler('seekforward', () => { if(window.seekOffset) window.seekOffset(15); });
            
            // 重点修复：系统组件拖动或点击进度条的处理
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined && details.seekTime !== null) {
                    this.audio.currentTime = details.seekTime;
                    // 跳转后立刻强制同步状态，否则系统组件会卡在总时长
                    this.updateSystemPositionState();
                }
            });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { 
            this.audio.play(); 
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
            return true; 
        } else { 
            this.audio.pause(); 
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            return false; 
        }
    },

    seek(pct) {
        if (this.audio.duration) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
            // 网页端拖动进度条后，也要同步给系统组件
            this.updateSystemPositionState();
        }
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
