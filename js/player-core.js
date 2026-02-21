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

        this.audio.onloadedmetadata = () => {
            this._updateMediaSession();
        };

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            // 使用从事件中获取的精确值更新 MediaSession
            this._updateMediaSession(dur, cur);
        };

        this.audio.onplay = () => this._updateMediaSession();
        this.audio.onpause = () => this._updateMediaSession();
        this.audio.onseeked = () => this._updateMediaSession();
        this.audio.onratechange = () => this._updateMediaSession();
        this.audio.onended = () => this._updateMediaSession();
    },

    // 统一的 MediaSession 更新方法，可接收外部传入的 duration 和 currentTime
    _updateMediaSession(dur, cur) {
        if (!('mediaSession' in navigator)) return;

        // 更新播放状态
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        // 如果传入了 dur 和 cur 则使用，否则从 audio 读取
        const duration = (dur !== undefined) ? dur : this.audio.duration;
        const current = (cur !== undefined) ? cur : this.audio.currentTime;

        // 必须保证 duration 是有效的正数，current 是有效数字
        if (duration && Number.isFinite(duration) && duration > 0 && Number.isFinite(current)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackPosition: Math.max(0, current), // 确保非负
                    playbackRate: this.audio.playbackRate || 1.0
                });
            } catch (error) {
                console.warn("MediaSession setPositionState error:", error);
            }
        }
    },

    updateMetadata(title, artist, cover) {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: artist,
            artwork: [
                { src: cover, sizes: '96x96' },
                { src: cover, sizes: '128x128' },
                { src: cover, sizes: '256x256' },
                { src: cover, sizes: '512x512' }
            ]
        });

        // 设置控制动作
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

    // 手动触发 MediaSession 更新（供外部调用）
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
