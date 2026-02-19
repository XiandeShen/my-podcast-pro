// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,
    _lastSyncTime: 0, 

    play(url) {
        if (!url) return;
        
        // 1. 切换音源时，彻底重置
        if (this.audio.src !== url) {
            this.audio.pause();
            this.audio.src = url;
            this.audio.load();
            this.resetMediaSession(); 
        }
        
        this.audio.play().then(() => {
            // 播放瞬间立即同步一次状态
            this.syncMediaSession("playing");
        }).catch(e => console.error("播放失败:", e));

        this.audio.ontimeupdate = () => {
            const curr = this.audio.currentTime || 0;
            const dur = this.audio.duration;
            const isDurValid = !!(dur && isFinite(dur));
            
            // 更新网页 UI
            if (this._onTimeUpdate) {
                const pct = isDurValid ? (curr / dur) * 100 : 0;
                this._onTimeUpdate(pct, this.format(curr, dur), isDurValid ? this.format(dur, dur) : "--:--");
            }
            
            // --- 核心优化：高频校准 ---
            // 增加同步频率（每 2 秒），并确保在播放状态下持续校准偏移
            const now = Date.now();
            if (now - this._lastSyncTime > 2000) { 
                this.syncMediaSession();
                this._lastSyncTime = now;
            }
        };

        this.audio.onplay = () => this.syncMediaSession("playing");
        this.audio.onpause = () => this.syncMediaSession("paused");
        this.audio.onratechange = () => this.syncMediaSession(); // 监听倍速变化并同步
        this.audio.onloadedmetadata = () => this.syncMediaSession();
    },

    resetMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            if (navigator.mediaSession.setPositionState) {
                navigator.mediaSession.setPositionState(null);
            }
        }
    },

    syncMediaSession(stateOverride) {
        if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
        
        const state = stateOverride || (this.audio.paused ? "paused" : "playing");
        navigator.mediaSession.playbackState = state;

        const curr = this.audio.currentTime;
        const dur = this.audio.duration;

        // 关键：必须同时提供 position, duration 和 playbackRate 
        // 否则系统会默认按 1.0x 速度预测，导致进度条跑快或跑慢
        if (dur && isFinite(dur) && curr >= 0) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: Math.max(0, dur),
                    playbackRate: this.audio.playbackRate || 1.0,
                    position: Math.min(curr, dur) 
                });
            } catch (e) {
                console.warn("MediaSession 同步失败:", e);
            }
        }
    },

    format(s, totalS) {
        if (isNaN(s) || s === Infinity) return "0:00";
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        
        const showHour = (totalS && totalS >= 3600) || h > 0;
        const mm = m < 10 ? (showHour ? '0' + m : m) : m;
        const ss = sec < 10 ? '0' + sec : sec;
        
        return showHour ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title, artist,
                artwork: [
                    { src: cover, sizes: '96x96',   type: 'image/jpeg' },
                    { src: cover, sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            // 绑定系统控件交互
            const actions = {
                play: () => { this.audio.play(); this.syncMediaSession("playing"); },
                pause: () => { this.audio.pause(); this.syncMediaSession("paused"); },
                seekto: (details) => { 
                    this.audio.currentTime = details.seekTime;
                    this.syncMediaSession();
                },
                seekbackward: () => { 
                    this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
                    this.syncMediaSession();
                },
                seekforward: () => { 
                    this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
                    this.syncMediaSession();
                }
            };

            for (const [action, handler] of Object.entries(actions)) {
                try { navigator.mediaSession.setActionHandler(action, handler); } catch(e) {}
            }
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },
    
    toggle() { 
        const isPaused = this.audio.paused;
        if (isPaused) {
            this.audio.play();
        } else {
            this.audio.pause();
        }
        return isPaused; 
    },

    seek(pct) {
        if (this.audio.duration && isFinite(this.audio.duration)) {
            const targetTime = (pct / 100) * this.audio.duration;
            this.audio.currentTime = targetTime;
            // 拖动进度条后立即强制同步，防止系统 UI 跳回
            this.syncMediaSession();
        }
    }
};
