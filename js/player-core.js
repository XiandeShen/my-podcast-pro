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
                // 显式告知系统当前正在播放，这对安卓系统组件非常重要
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = "playing";
                }
            }).catch(error => console.error("Playback Error:", error));
        }

        // 监听元数据加载，确保总时长能第一时间传给系统
        this.audio.onloadedmetadata = () => {
            this.updateSystemPositionState();
        };

        this.audio.ontimeupdate = () => {
            const current = this.format(this.audio.currentTime);
            const total = this.format(this.audio.duration);
            const pct = (this.audio.currentTime / this.audio.duration) * 100 || 0;
            if (this._onTimeUpdate) this._onTimeUpdate(pct, current, total);
            
            // 同步进度到系统锁屏控件
            this.updateSystemPositionState();
        };
    },

    // 抽离出的同步方法，增加防御性检查
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
                navigator.mediaSession.playbackState = "playing"; // 同步状态
                if(window.updatePlayIcons) window.updatePlayIcons(true); 
            });
            navigator.mediaSession.setActionHandler('pause', () => { 
                this.audio.pause(); 
                navigator.mediaSession.playbackState = "paused"; // 同步状态
                if(window.updatePlayIcons) window.updatePlayIcons(false); 
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => { if(window.seekOffset) window.seekOffset(-15); });
            navigator.mediaSession.setActionHandler('seekforward', () => { if(window.seekOffset) window.seekOffset(15); });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime) {
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
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
            return true; 
        }
        else { 
            this.audio.pause(); 
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
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
