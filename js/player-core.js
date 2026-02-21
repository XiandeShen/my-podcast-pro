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
                    this.updateSystemPositionState(); // 播放开始时立即同步
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
            
            // 正常播放时同步，但不再频繁调用 updateSystemPositionState
            // 减少某些手机浏览器的处理压力
            if ('mediaSession' in navigator && Math.floor(this.audio.currentTime) % 2 === 0) {
                this.updateSystemPositionState();
            }
        };

        // 监听音频原生事件，防止系统状态脱节
        this.audio.onpause = () => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
                this.updateSystemPositionState(); // 暂停时必须同步一次，防止时间清零
            }
        };
        this.audio.onplay = () => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
                this.updateSystemPositionState(); // 开始时必须同步一次
            }
        };
    },

    updateSystemPositionState() {
        if ('mediaSession' in navigator && this.audio.duration && !isNaN(this.audio.duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: this.audio.duration,
                    playbackPosition: this.audio.currentTime,
                    playbackRate: this.audio.playbackRate
                });
            } catch (e) {
                console.warn("PositionState Update Failed:", e);
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

            // 注册系统回调：这些是修复三星组件显示的关键
            navigator.mediaSession.setActionHandler('play', () => { 
                this.audio.play(); 
                // 不要只管播放，要立刻更新系统状态
                navigator.mediaSession.playbackState = "playing";
                this.updateSystemPositionState();
                if(window.updatePlayIcons) window.updatePlayIcons(true); 
            });

            navigator.mediaSession.setActionHandler('pause', () => { 
                this.audio.pause(); 
                navigator.mediaSession.playbackState = "paused";
                this.updateSystemPositionState();
                if(window.updatePlayIcons) window.updatePlayIcons(false); 
            });

            navigator.mediaSession.setActionHandler('seekbackward', () => { 
                if(window.seekOffset) window.seekOffset(-15); 
                this.updateSystemPositionState();
            });

            navigator.mediaSession.setActionHandler('seekforward', () => { 
                if(window.seekOffset) window.seekOffset(15); 
                this.updateSystemPositionState();
            });

            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                    this.updateSystemPositionState();
                }
            });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { 
            this.audio.play(); 
            return true; 
        } else { 
            this.audio.pause(); 
            return false; 
        }
    },

    seek(pct) {
        if (this.audio.duration) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
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
