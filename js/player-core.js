// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,
    _lastSyncTime: 0, 

    play(url) {
        if (!url) return;
        
        // 1. 切换音源时，彻底重置旧状态
        if (this.audio.src !== url) {
            this.audio.pause();
            this.audio.src = url;
            this.audio.load();
            this.resetMediaSession(); // 关键：清除旧进度残留
        }
        
        this.audio.play().then(() => {
            this.syncMediaSession("playing");
        }).catch(e => console.error("播放失败:", e));

        this.audio.ontimeupdate = () => {
            const curr = this.audio.currentTime || 0;
            const dur = this.audio.duration;
            const isDurValid = !!(dur && isFinite(dur));
            
            // 更新网页 UI 渲染
            if (this._onTimeUpdate) {
                const pct = isDurValid ? (curr / dur) * 100 : 0;
                // 强制格式化，确保不出现 4114.4 这种原始秒数
                this._onTimeUpdate(pct, this.format(curr, dur), isDurValid ? this.format(dur, dur) : "--:--");
            }
            
            // --- 核心修复：心跳同步 ---
            // 为了防止系统“预测”跑偏（产生那1分钟误差），每 5 秒强制校准一次
            const now = Date.now();
            if (now - this._lastSyncTime > 5000) {
                this.syncMediaSession();
                this._lastSyncTime = now;
            }
        };

        this.audio.onplay = () => this.syncMediaSession("playing");
        this.audio.onpause = () => this.syncMediaSession("paused");
        // 当元数据加载完（拿到时长），立即同步一次，防止系统显示 undefined
        this.audio.onloadedmetadata = () => this.syncMediaSession();
    },

    // 彻底重置系统的媒体状态
    resetMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            if (navigator.mediaSession.setPositionState) {
                navigator.mediaSession.setPositionState(null);
            }
        }
    },

    syncMediaSession(stateOverride) {
        if (!('mediaSession' in navigator)) return;
        
        const state = stateOverride || (this.audio.paused ? "paused" : "playing");
        navigator.mediaSession.playbackState = state;

        const curr = this.audio.currentTime;
        const dur = this.audio.duration;

        // 只有当时长有效时才同步进度条
        if (dur && isFinite(dur)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackRate: this.audio.playbackRate || 1,
                    position: curr // 不再用 Math.floor，提高精度
                });
            } catch (e) {
                console.warn("MediaSession Position 同步失败", e);
            }
        }
    },

    // 强化版格式化：支持 H:MM:SS，且即便没有 totalS 也会根据当前秒数自动进位
    format(s, totalS) {
        if (isNaN(s) || s === Infinity) return "0:00";
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        
        // 逻辑：如果总时长超过1小时，或者当前播放已经超过1小时，就显示小时位
        const showHour = (totalS && totalS >= 3600) || h > 0;
        
        const mm = m < 10 ? '0' + m : m;
        const ss = sec < 10 ? '0' + sec : sec;
        
        if (showHour) {
            return `${h}:${mm}:${ss}`;
        }
        return `${m}:${ss}`;
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
            navigator.mediaSession.setActionHandler('seekbackward', () => { 
                this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
                this.syncMediaSession();
            });
            navigator.mediaSession.setActionHandler('seekforward', () => { 
                this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
                this.syncMediaSession();
            });
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
