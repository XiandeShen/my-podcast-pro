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
                this.setSystemState("playing"); // 苹果策略：播放后立即强制声明状态
            }).catch(error => console.error("Playback Error:", error));
        }

        // 核心修复：监听元数据加载，三星手机需要第一时间知道总时长
        this.audio.onloadedmetadata = () => {
            this.updateSystemPositionState();
        };

        // 核心修复：原生事件监听，确保系统组件操作后不丢状态
        this.audio.onplay = () => this.setSystemState("playing");
        this.audio.onpause = () => this.setSystemState("paused");
        this.audio.onseeking = () => this.updateSystemPositionState();
        this.audio.onseeked = () => this.updateSystemPositionState();

        this.audio.ontimeupdate = () => {
            const current = this.format(this.audio.currentTime);
            const total = this.format(this.audio.duration);
            const pct = (this.audio.currentTime / this.audio.duration) * 100 || 0;
            if (this._onTimeUpdate) this._onTimeUpdate(pct, current, total);
            
            // 苹果策略：正常播放时降低同步频率，但确保在整数秒时强刷一次
            if ('mediaSession' in navigator && Math.floor(this.audio.currentTime) % 2 === 0) {
                this.updateSystemPositionState();
            }
        };
    },

    // 封装状态设置，确保 playbackState 和 positionState 同时更新
    setSystemState(state) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = state;
            this.updateSystemPositionState();
        }
    },

    updateSystemPositionState() {
        if ('mediaSession' in navigator && this.audio.duration && !isNaN(this.audio.duration)) {
            try {
                // 必须严格校验 position 不超过 duration，否则三星系统会重置为 0
                const pos = Math.min(this.audio.currentTime, this.audio.duration);
                navigator.mediaSession.setPositionState({
                    duration: this.audio.duration,
                    playbackPosition: pos,
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                console.warn("MediaSession Sync Failed:", e);
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

            // 系统回调处理
            navigator.mediaSession.setActionHandler('play', () => { 
                this.audio.play(); 
                this.setSystemState("playing");
                if(window.updatePlayIcons) window.updatePlayIcons(true); 
            });
            navigator.mediaSession.setActionHandler('pause', () => { 
                this.audio.pause(); 
                this.setSystemState("paused");
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
            
            // 重点修复：三星系统的 seekto 指令必须带上完整的 position 汇报
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
