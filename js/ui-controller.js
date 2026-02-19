// js/ui-controller.js
import { PlayerCore } from './player-core.js';

export const UI = {
    openPlayer(episode, podcastTitle, podcastCover) {
        const overlay = document.getElementById('playerOverlay');
        const playerCover = document.getElementById('playerCover');
        
        const finalCover = episode.image || podcastCover;

        document.getElementById('playerTitle').innerText = episode.title;
        document.getElementById('playerAuthor').innerText = podcastTitle;
        
        if (playerCover) playerCover.src = finalCover;
        if (overlay) overlay.classList.add('is-active');

        // 设置系统锁屏媒体信息
        PlayerCore.updateMetadata(episode.title, podcastTitle, finalCover);

        // 绑定进度条更新事件
        PlayerCore.onTimeUpdate((current, total) => {
            this.updateProgress(current, total);
        });

        PlayerCore.play(episode.audioUrl);
    },

    updateProgress(current, total) {
        const progressRange = document.getElementById('progressRange');
        const currentTimeEl = document.getElementById('currentTime');
        const durationTimeEl = document.getElementById('durationTime');

        // 核心修复：检查 total 是否是有效的数字
        const isTotalValid = total && !isNaN(total) && total !== Infinity;

        if (progressRange && isTotalValid) {
            progressRange.value = (current / total) * 100;
        }

        // 核心修复：强制对时间进行 formatTime 格式化
        if (currentTimeEl) {
            currentTimeEl.innerText = this.formatTime(current);
        }

        if (durationTimeEl) {
            // 如果总时长还未加载完成，显示 --:--
            durationTimeEl.innerText = isTotalValid ? this.formatTime(total) : "--:--";
        }
    },

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
};
