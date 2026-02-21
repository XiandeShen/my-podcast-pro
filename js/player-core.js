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
                })
                .catch(error => console.error("Playback Error:", error));
        }

        // 元数据加载后立即同步一次位置
        this.audio.onloadedmetadata = () => {
            this._syncMediaPosition();
        };

        // 时间更新时同步 UI 和系统组件位置
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            this._syncMediaPosition();
        };
    },

    // 仅同步 MediaSession 位置，不设置元数据
    _syncMediaPosition() {
        if (!('mediaSession' in navigator)) return;

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
                // 忽略错误，避免干扰
            }
        }
    },

    // 空方法，避免外部调用报错
    updateMetadata(title, artist, cover) {},

    updateMediaSessionState() {
        this._syncMediaPosition();
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
