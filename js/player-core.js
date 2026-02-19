export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,

    play(url) {
        if (!url) return;
        // 记录当前倍速
        const currentRate = this.audio.playbackRate;
        this.audio.src = url;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // 确保 play 后倍速依然生效
                this.audio.playbackRate = currentRate;
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            const current = this.format(this.audio.currentTime);
            const total = this.format(this.audio.duration);
            const pct = (this.audio.currentTime / this.audio.duration) * 100 || 0;
            if (this._onTimeUpdate) this._onTimeUpdate(pct, current, total);
        };
    },

    onTimeUpdate(cb) { this._onTimeUpdate = cb; },

    toggle() {
        if (this.audio.paused) { this.audio.play(); return true; }
        else { this.audio.pause(); return false; }
    },

    seek(pct) {
        if (this.audio.duration) this.audio.currentTime = (pct / 100) * this.audio.duration;
    },

    format(s) {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    }
};
