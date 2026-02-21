// js/player-core.js

const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _lastSyncRealTime: 0,

    play(url) {
        if (!url) return;
        
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }
        
        const currentRate = this.audio.playbackRate;
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                // 关键：播放成功后延迟触发“双跳唤醒”
                setTimeout(() => this.wakeupSystemTimer(), 300);
            }).catch(e => console.error("Playback Error:", e));
        }

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;

            if (this._onTimeUpdate) {
                const safeDur = (isFinite(dur) && dur > 0) ? dur : 0;
                const safePct = safeDur > 0 ? (cur / safeDur) * 100 : 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(safeDur));
            }

            // 每隔 10 秒强制同步一次，防止系统计时器漂移或睡眠
            if (Math.abs(cur - this._lastSyncRealTime) > 10) {
                this.forceSyncState();
                this._lastSyncRealTime = cur;
            }
        };

        this.audio.onplaying = () => this.forceSyncState();
        this.audio.onpause = () => this.forceSyncState();
        this.audio.onseeked = () => this.forceSyncState();
    },

    // 唤醒补丁：通过极小的位移强制系统通知栏刷新计时引擎
    wakeupSystemTimer() {
        if (!('mediaSession' in navigator) || !isFinite(this.audio.duration)) return;
        
        const actual = this.audio.currentTime;
        // 第一跳：推一个微小的偏离值
        this.doSync(actual + 0.001);
        
        // 第二跳：100ms 后推回真实值，形成“动态”信号
        setTimeout(() => {
            this.doSync(this.audio.currentTime);
            this._lastSyncRealTime = this.audio.currentTime;
        }, 100);
    },

    forceSyncState() {
        this.doSync(this.audio.currentTime);
    },

    doSync(timeValue) {
        if (!('mediaSession' in navigator)) return;
        const dur = this.audio.duration;
        if (!isFinite(dur) || dur <= 0) return;

        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";
        
        try {
            // 必须严格限制范围，防止越界导致安卓 MediaSession 崩溃
            const safePos = Math.min(Math.max(0, timeValue), dur);
            
            navigator.mediaSession.setPositionState({
                duration: dur,
                playbackPosition: safePos,
                playbackRate: this.audio.playbackRate || 1.0
            });
        } catch (e) {
            console.warn("Sync error:", e);
        }
    },

    updateMetadata(title, artist, cover) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                artwork: [{ src: cover, sizes: '512x512', type: 'image/png' }]
            });

            const actions = {
                play: () => this.audio.play(),
                pause: () => this.audio.pause(),
                seekbackward: () => this.seekOffset(-15),
                seekforward: () => this.seekOffset(15),
                seekto: (details) => {
                    if (details.seekTime !== undefined) {
                        this.audio.currentTime = details.seekTime;
                        this.forceSyncState();
                    }
                }
            };
            Object.entries(actions).forEach(([act, hdl]) => {
                try { navigator.mediaSession.setActionHandler(act, hdl); } catch (e) {}
            });
        }
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },
    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; } 
        else { this.audio.pause(); return false; }
    },
    seek(pct) {
        const dur = this.audio.duration;
        if (isFinite(dur) && dur > 0) {
            this.audio.currentTime = (pct / 100) * dur;
            this.forceSyncState();
        }
    },
    seekOffset(s) {
        const dur = this.audio.duration;
        if (!isFinite(dur) || dur <= 0) return;
        this.audio.currentTime = Math.max(0, Math.min(this.audio.currentTime + s, dur));
        this.forceSyncState();
    },
    format(s) {
        if (!isFinite(s) || s <= 0) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
