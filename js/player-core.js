// js/player-core.js

const sysAudio = new Audio();
sysAudio.id = "core-audio-player";
sysAudio.style.display = "none";
sysAudio.preload = "auto";
document.body.appendChild(sysAudio);

export const PlayerCore = {
    audio: sysAudio,
    _onTimeUpdate: null,
    _onStatusChange: null,

    play(url) {
        if (!url) return;

        const savedRate = this.audio.playbackRate;
        
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
        }

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.audio.playbackRate = savedRate;
                })
                .catch(error => console.error("Playback Error:", error));
        }

        // 时间更新监听
        this.audio.ontimeupdate = () => {
            const cur = this.audio.currentTime;
            const dur = this.audio.duration;
            if (this._onTimeUpdate) {
                this._onTimeUpdate((cur / dur) * 100 || 0, this.format(cur), this.format(dur));
            }
        };

        // 核心修复：监听系统级/底层音频状态变化，实现UI联动
        this.audio.onplay = () => {
            if (this._onStatusChange) this._onStatusChange(true);
        };
        this.audio.onpause = () => {
            if (this._onStatusChange) this._onStatusChange(false);
        };

        this.audio.oncanplay = () => {
            this.audio.playbackRate = savedRate;
        };

        // 清理/重置其他不必要的事件
        this.audio.onloadedmetadata = null;
        this.audio.onseeked = null;
    },

    // 注册 UI 状态同步回调
    onStatusChange(cb) {
        this._onStatusChange = cb;
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
    },

    // 占位接口
    updateMetadata(title, artist, cover) {},
    updateMediaSessionState() {}
};
