// js/ui-controller.js
import { PlayerCore } from './player-core.js';

export const UI = {
    openPlayer(episode, podcastTitle, podcastCover) {
        const overlay = document.getElementById('playerOverlay');
        const playerCover = document.getElementById('playerCover');
        const finalCover = episode.image || podcastCover;

        // 1. 更新 UI 静态内容
        document.getElementById('playerTitle').innerText = episode.title;
        document.getElementById('playerAuthor').innerText = podcastTitle;
        if (playerCover) playerCover.src = finalCover;
        if (overlay) overlay.classList.add('is-active');

        // 2. 设置系统媒体信息
        PlayerCore.updateMetadata(episode.title, podcastTitle, finalCover);

        // 3. 注册进度回调并开始播放
        PlayerCore.onTimeUpdate((current, total) => {
            this.updateProgress(current, total);
        });

        PlayerCore.play(episode.audioUrl);
    },

    updateProgress(current, total) {
        const progressRange = document.getElementById('progressRange');
        const currentTimeEl = document.getElementById('currentTime');
        const durationTimeEl = document.getElementById('durationTime');

        if (total > 0) {
            const percent = (current / total) * 100;
            // 更新进度条 (假定它是 range 类型的 input)
            if (progressRange) progressRange.value = percent;
            // 更新时间文字
            if (currentTimeEl) currentTimeEl.innerText = this.formatTime(current);
            if (durationTimeEl) durationTimeEl.innerText = this.formatTime(total);
        }
    },

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
};
