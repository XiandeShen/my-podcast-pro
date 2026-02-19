// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,

    // 初始化监听器：确保倍速和状态实时同步给系统
    init() {
        this.audio.addEventListener('ratechange', () => this.syncPosition());
        this.audio.addEventListener('play', () => this.updateMediaStatus('playing'));
        this.audio.addEventListener('pause', () => this.updateMediaStatus('paused'));
        this.audio.addEventListener('ended', () => this.updateMediaStatus('none'));
    },

    play(url) {
        if (!url) return;
        
        // 只有 URL 改变时才重置 src，防止重复加载导致进度跳动
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.updateMediaStatus('playing');
                this.syncPosition();
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            // 这里的 current 和 total 传秒数给 UI，由 UI 统一格式化
            if (this._onTimeUpdate) {
                this._onTimeUpdate(this.audio.currentTime, this.audio.duration);
            }
            this.syncPosition();
        };
    },

    // 核心修复：同步进度、总时长和倍速到系统控件
    syncPosition() {
        if ('mediaSession' in navigator && this.audio.duration && !isNaN(this.audio.duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: this.audio.duration,
                    playbackRate: this.audio.playbackRate || 1.0,
                    position: this.audio.currentTime || 0 // 属性名必须是 position
                });
            } catch (e) {
                console.warn("MediaSession Error:", e);
            }
        }
    },

    updateMediaStatus(state) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = state;
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

            // 注册系统控制回调
            navigator.mediaSession.setActionHandler('play', () => { 
                this.audio.play(); 
                if(window.updatePlayIcons) window.updatePlayIcons(true); 
            });
            navigator.mediaSession.setActionHandler('pause', () => { 
                this.audio.pause(); 
                if(window.updatePlayIcons) window.updatePlayIcons(false); 
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => { this.audio.currentTime -= 15; });
            navigator.mediaSession.setActionHandler('seekforward', () => { this.audio.currentTime += 15; });
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

// 立即初始化
PlayerCore.init();
