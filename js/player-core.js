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
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            const current = this.format(this.audio.currentTime);
            const total = this.format(this.audio.duration);
            const pct = (this.audio.currentTime / this.audio.duration) * 100 || 0;
            if (this._onTimeUpdate) this._onTimeUpdate(pct, current, total);
            
            // 同步进度到系统锁屏控件
            if ('mediaSession' in navigator && this.audio.duration) {
                navigator.mediaSession.setPositionState({
                    duration: this.audio.duration,
                    playbackPosition: this.audio.currentTime,
                    playbackRate: this.audio.playbackRate
                });
            }
        };
    },

    // 新增：向安卓/iOS系统推送媒体信息
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

            // 注册锁屏控制按钮回调
            navigator.mediaSession.setActionHandler('play', () => { 
                this.audio.play(); 
                if(window.updatePlayIcons) window.updatePlayIcons(true); 
            });
            navigator.mediaSession.setActionHandler('pause', () => { 
                this.audio.pause(); 
                if(window.updatePlayIcons) window.updatePlayIcons(false); 
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => { if(window.seekOffset) window.seekOffset(-15); });
            navigator.mediaSession.setActionHandler('seekforward', () => { if(window.seekOffset) window.seekOffset(15); });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime) this.audio.currentTime = details.seekTime;
            });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; }
        else { this.audio.pause(); return false; }
    },

    seek(pct) {
        if (this.audio.duration) this.audio.currentTime = (pct / 100) * this.audio.duration;
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
