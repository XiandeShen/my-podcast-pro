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
                this.syncAll("playing");
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.onloadedmetadata = () => {
            this.syncAll();
        };

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            // 重点：正常播放中，绝不调用 setPositionState，让三星系统自己走
        };

        // 核心修复：当音频因为任何原因（包括手动点击、系统操作）暂停或播放时
        this.audio.onplay = () => this.syncAll("playing");
        this.audio.onpause = () => this.syncAll("paused");
        
        // 跳转完成时
        this.audio.onseeked = () => {
            this.syncAll(this.audio.paused ? "paused" : "playing");
        };
    },

    /**
     * 终极同步方案：syncAll
     * 针对三星系统暂停归零的修复策略：
     * 1. 强制将 playbackState 和 positionState 在同一个执行周期内发出
     * 2. 暂停时，明确告诉系统“停留在这一秒”，不给系统自动归零的机会
     */
    syncAll(state = null) {
        if (!('mediaSession' in navigator)) return;

        // 1. 设置状态
        if (state) {
            navigator.mediaSession.playbackState = state;
        }

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        // 2. 只有在有有效时长时才同步
        if (dur && !isNaN(dur) && dur > 0) {
            try {
                // 苹果式防御：确保不等于总长度，确保不为负数
                const safePos = Math.max(0, Math.min(cur, dur - 0.2));
                
                // 核心：setPositionState 必须在此时刻被调用
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: safePos,
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
                    { src: cover, sizes: '512x512' }
                ]
            });

            // 控制回调：仅处理逻辑，不直接操作 MediaSession 状态，由 audio 事件统一触发 syncAll
            navigator.mediaSession.setActionHandler('play', () => { this.audio.play(); });
            navigator.mediaSession.setActionHandler('pause', () => { this.audio.pause(); });
            
            navigator.mediaSession.setActionHandler('seekbackward', () => {
                this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
            });
            navigator.mediaSession.setActionHandler('seekforward', () => {
                this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
            });
            
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    this.audio.currentTime = details.seekTime;
                }
            });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; }
        else { this.audio.pause(); return false; }
    },

    seek(pct) {
        if (this.audio.duration) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
        }
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
