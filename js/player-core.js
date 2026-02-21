// js/player-core.js

const sysAudio = new Audio();
sysAudio.id = "core-audio-player";
sysAudio.style.display = "none";
document.body.appendChild(sysAudio);

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,

    play(url) {
        if (!url) return;

        const currentRate = this.audio.playbackRate;
        this.audio.src = url;

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.audio.playbackRate = currentRate;
                    this._updateMediaSession();
                })
                .catch(error => console.error("Playback Error:", error));
        }

        this.audio.onloadedmetadata = () => this._updateMediaSession();

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            this._updateMediaSession(); // 每次时间变化都更新系统组件位置
        };

        this.audio.onplay = () => this._updateMediaSession();
        this.audio.onpause = () => this._updateMediaSession();
        this.audio.onseeked = () => this._updateMediaSession();
        this.audio.onratechange = () => this._updateMediaSession();
        this.audio.onended = () => this._updateMediaSession();
    },

    // 更新 MediaSession 位置状态（不设置元数据）
    _updateMediaSession() {
        if (!('mediaSession' in navigator)) return;

        // 更新播放状态
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        if (dur && Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    playbackPosition: Math.max(0, cur),
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (error) {
                console.warn("MediaSession setPositionState error:", error);
            }
        }
    },

    // 不再设置元数据，仅设置动作处理器（可选，但保留方法以便后续需要）
    updateMetadata(title, artist, cover) {
        if (!('mediaSession' in navigator)) return;

        // 只绑定动作处理器，不设置 metadata，让浏览器使用默认信息
        navigator.mediaSession.setActionHandler('play', () => { this.audio.play(); });
        navigator.mediaSession.setActionHandler('pause', () => { this.audio.pause(); });
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            this.audio.currentTime = Math.max(0, this.audio.currentTime - 15);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 15);
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
                this.audio.currentTime = details.seekTime;
            }
        });
    },

    // 手动触发更新（如果需要）
    updateMediaSessionState() {
        this._updateMediaSession();
    },

    onTimeUpdate(cb) {
        this._onTimeUpdate = cb;
    },

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
        if (this.audio.duration && Number.isFinite(this.audio.duration)) {
            this.audio.currentTime = (pct / 100) * this.audio.duration;
        }
    },

    format(s) {
        if (isNaN(s) || !Number.isFinite(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
