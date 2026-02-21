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
        overlay.classList.add('is-active');

        // 统一使用 PlayerCore 的 updateMetadata
        PlayerCore.updateMetadata(episode.title, podcastTitle, finalCover);
        PlayerCore.play(episode.audioUrl);
    },

    // 格式化函数保持一致
    formatTime(seconds) {
        return PlayerCore.format(seconds);
    }
};
