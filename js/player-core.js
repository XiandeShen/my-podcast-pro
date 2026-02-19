// js/player-core.js
export const PlayerCore = {
    audio: new Audio(),
    _onTimeUpdate: null,

    play(url, callback) { // 修复：增加 callback 参数
        if (!url) return;
        
        // 如果有传入回调，则更新内部监听器
        if (callback) this._onTimeUpdate = callback;

        const currentRate = this.audio.playbackRate;
        this.audio.src = url;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.audio.playbackRate = currentRate;
            }).catch(error => console.error("Playback Error:", error));
        }

        this.audio.ontimeupdate = () => {
            // 计算进度百分比和时间
            const current = this.audio.currentTime;
            const total = this.audio.duration;
            const pct = (current / total) * 100 || 0;
            
            // 触发 UI 更新回调
            if (this._onTimeUpdate) {
                // 注意：这里传回的是原始秒数，供 UI 层的 updateProgress 处理
                this._onTimeUpdate(current, total); 
            }
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
