// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,
    _lastReportedTime: -1, 

    play(url) {
        if (!url) return;
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }
        
        this.audio.play().then(() => {
            this.updateMediaSessionState("playing");
        }).catch(e => console.error("播放失败:", e));

        this.audio.ontimeupdate = () => {
            const curr = this.audio.currentTime || 0;
            const dur = this.audio.duration;
            const isDurValid = dur && isFinite(dur);
            
            // 传给 UI 渲染
            if (this._onTimeUpdate) {
                const pct = isDurValid ? (curr / dur) * 100 : 0;
                // 传入当前秒数和总秒数，由 format 统一处理格式
                this._onTimeUpdate(pct, this.format(curr, dur), isDurValid ? this.format(dur, dur) : "--:--");
            }
            
            // 播放时减小同步频率，只有偏差大于 3 秒才纠正系统，防止安卓“跑得太快”
            if (Math.abs(curr - this._lastReportedTime) > 3) {
                this.syncMediaSession();
            }
        };

        this.audio.onplay = () => this.updateMediaSessionState("playing");
        this.audio.onpause = () => this.updateMediaSessionState("paused");
    },

    updateMediaSessionState(state) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = state;
            this.syncMediaSession(); // 状态切换必须立即同步
        }
    },

    syncMediaSession() {
        if (!('mediaSession' in navigator)) return;
        const curr = this.audio.currentTime;
        const dur = this.audio.duration;
        const isPaused = this.audio.paused;

        try {
            const config = {
                position: Math.floor(curr),
                playbackRate: isPaused ? 0 : 1
            };
            if (dur && isFinite(dur)) config.duration = Math.floor(dur);
            
            navigator.mediaSession.setPositionState(config);
            this._lastReportedTime = curr;
        } catch (e) {
            console.warn("MediaSession 同步失败");
        }
    },

    // 改进后的格式化函数：如果总时长超一小时，当前时间也显示小时位
    format(s, totalS) {
        if (isNaN(s) || s === Infinity) return "0:00";
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        
        const showHour = (totalS && totalS >= 3600) || h > 0;
        
        if (showHour) {
            return `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
        }
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title, artist,
                artwork: [{ src: cover, sizes: '512x512', type: 'image/jpeg' }]
            });
            // 绑定系统按键
            navigator.mediaSession.setActionHandler('play', () => this.audio.play());
            navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
            navigator.mediaSession.setActionHandler('seekto', (d) => {
                this.audio.currentTime = d.seekTime;
                this.syncMediaSession();
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => { this.audio.currentTime -= 15; this.syncMediaSession(); });
            navigator.mediaSession.setActionHandler('seekforward', () => { this.audio.currentTime += 15; this.syncMediaSession(); });
        }
    },
    onTimeUpdate(cb) { this._onTimeUpdate = cb; },
    toggle() { return this.audio.paused ? (this.audio.play(), true) : (this.audio.pause(), false); },
    seek(pct) {
        if (this.audio.duration && isFinite(this.audio.duration)) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
            this.syncMediaSession();
        }
    }
};
