// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,
    _lastSyncTime: 0, // 记录上次同步给系统的时间戳

    play(url) {
        if (!url) return;
        const currentRate = this.audio.playbackRate;
        this.audio.src = url;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                this.syncMediaSession("playing");
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.onloadedmetadata = () => {
            this.syncMediaSession();
        };

        // 核心优化：减少同步频率，防止三星系统时间轴抖动
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            const currentStr = this.format(cur);
            const totalStr = this.format(dur);
            const pct = (cur / dur) * 100 || 0;
            
            if (this._onTimeUpdate) this._onTimeUpdate(pct, currentStr, totalStr);
            
            // 策略：每 5 秒或进度发生大幅度跳变时才强制同步一次
            // 平时让系统组件根据 playbackRate 自己走进度
            if (Math.abs(cur - this._lastSyncTime) > 5) {
                this.syncMediaSession();
            }
        };

        // 监听底层事件，确保状态转换瞬间同步
        this.audio.onplay = () => this.syncMediaSession("playing");
        this.audio.onpause = () => this.syncMediaSession("paused");
        this.audio.onseeked = () => this.syncMediaSession();
    },

    // 核心同步函数：增加数值保护和频率限制
    syncMediaSession(state = null) {
        if (!('mediaSession' in navigator)) return;

        // 如果传入了状态，先更新状态
        if (state) {
            navigator.mediaSession.playbackState = state;
        }

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        if (dur && !isNaN(dur) && dur > 0) {
            try {
                // 确保数据是干净的浮点数/整数
                const safePos = Math.max(0, Math.min(cur, dur));
                
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: safePos,
                    playbackRate: this.audio.playbackRate || 1.0
                });
                
                this._lastSyncTime = safePos;
            } catch (e) {
                console.warn("MediaSession sync error:", e);
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
                    { src: cover, sizes: '512x512' }
                ]
            });

            // 系统回调：操作后立即执行同步
            navigator.mediaSession.setActionHandler('play', () => {
                this.audio.play();
                if(window.updatePlayIcons) window.updatePlayIcons(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                this.audio.pause();
                if(window.updatePlayIcons) window.updatePlayIcons(false);
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                if(window.seekOffset) window.seekOffset(-15);
                this.syncMediaSession();
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                if(window.seekOffset) window.seekOffset(15);
                this.syncMediaSession();
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                    // 跳转后必须立刻同步，且设置一个短暂的“冷却”防止系统回弹
                    this.syncMediaSession();
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
            this.syncMediaSession();
        }
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
