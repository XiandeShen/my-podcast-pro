// js/player-core.js 

const sysAudio = document.getElementById('main-audio-player') || new Audio();

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _shadowTime: 0, 

    play(url) {
        if (!url) return;
        
        if (this.audio.src !== url) {
            this._shadowTime = 0;
            this.audio.src = url;
            this.audio.load();
        }
        
        const currentRate = this.audio.playbackRate;
        const playPromise = this.audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
                // 延迟 500ms 推送状态，等系统反应过来
                setTimeout(() => this.forceSyncState(), 500);
            }).catch(e => console.error("Playback Error:", e));
        }

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;

            if (isFinite(cur) && cur > 0) {
                this._shadowTime = cur;
            }

            if (this._onTimeUpdate) {
                const safeDur = (isFinite(dur) && dur > 0) ? dur : 0;
                const safePct = safeDur > 0 ? (cur / safeDur) * 100 : 0;
                this._onTimeUpdate(safePct, this.format(cur), this.format(safeDur));
            }
        };

        // 关键：监听 playing 事件（真正开始出声的时候）
        this.audio.onplaying = () => {
            this.forceSyncState();
        };

        this.audio.onpause = () => {
            this.forceSyncState();
        };

        this.audio.onseeked = () => {
            this.forceSyncState();
        };
    },

    forceSyncState() {
        if (!('mediaSession' in navigator)) return;

        const dur = this.audio.duration;
        let cur = this.audio.currentTime;

        // 状态声明
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        if (isFinite(dur) && dur > 0) {
            try {
                // 这里的补丁：如果当前是 0，给一个极小值，欺骗系统引擎开始计时
                const position = (cur <= 0) ? 0.001 : Math.min(cur, dur);
                
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: position,
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (e) {
                console.warn("MediaSession Position Error:", e);
            }
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

            Object.entries(actions).forEach(([action, handler]) => {
                try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) {}
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
