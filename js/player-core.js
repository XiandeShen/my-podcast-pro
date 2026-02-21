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
                    this._updateMediaSession(); // 播放后立即更新
                })
                .catch(error => console.error("Playback Error:", error));
        }

        // 元数据加载完成后更新 MediaSession
        this.audio.onloadedmetadata = () => this._updateMediaSession();

        // 时间更新时同步给 UI 和 MediaSession
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            this._updateMediaSession(); // 每次时间变化都更新系统组件
        };

        // 其他关键事件更新 MediaSession
        this.audio.onplay = () => this._updateMediaSession();
        this.audio.onpause = () => this._updateMediaSession();
        this.audio.onseeked = () => this._updateMediaSession();
        this.audio.onratechange = () => this._updateMediaSession();
        this.audio.onended = () => this._updateMediaSession();
    },

    // 更新 MediaSession 状态和位置
    _updateMediaSession() {
        if (!('mediaSession' in navigator)) return;

        // 更新播放状态
        navigator.mediaSession.playbackState = this.audio.paused ? "paused" : "playing";

        const dur = this.audio.duration;
        const cur = this.audio.currentTime;

        // 确保 duration 是有效的正数，currentTime 是有效数字
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

    // 设置 Metadata 和事件处理器（每次播放新节目时调用）
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

        // 设置控制动作（只需绑定一次，但重复绑定无害）
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

    // 手动触发 MediaSession 更新（供外部调用，但内部已自动处理，此方法可留空或保留）
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
