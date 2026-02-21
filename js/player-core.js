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

        // 移除所有 MediaSession 更新调用，只保留必要的 UI 更新
        this.audio.onloadedmetadata = () => {
            // 可以留空或处理其他逻辑，但无需 MediaSession
        };

        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
            // 移除 MediaSession 更新
        };

        // 以下事件无需处理 MediaSession，但保留事件以防未来扩展
        this.audio.onplay = () => {};
        this.audio.onpause = () => {};
        this.audio.onseeked = () => {};
        this.audio.onratechange = () => {};
        this.audio.onended = () => {};
    },

    // 移除所有 MediaSession 相关代码，此方法可保留为空，避免外部调用报错
    updateMetadata(title, artist, cover) {
        // 不再与系统组件交互
    },

    // 移除 MediaSession 更新方法，或保留为空
    updateMediaSessionState() {
        // 不再使用
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
