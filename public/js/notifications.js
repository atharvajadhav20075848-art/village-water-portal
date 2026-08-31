// Global Notification & Emergency Siren System for Village Water Management Portal
// NOTE: auth-persist.js handles the x-user-email fetch interceptor

let isNotifModalOpen = false;
let sirenAudioContext = null;
let sirenOscillator = null;
let sirenGain = null;
let sirenInterval = null;
let isSirenPlaying = false;
let handledEmergencyIds = new Set();
let seenNotificationIds = new Set();
let isFirstFetch = true;

// ── Audio Unlocker for Mobile Chrome & Webviews ────────────────────────
function unlockAudioContext() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!sirenAudioContext && AudioContext) {
      sirenAudioContext = new AudioContext();
    }
    if (sirenAudioContext && sirenAudioContext.state === 'suspended') {
      sirenAudioContext.resume();
    }
  } catch(e) {}
}
window.addEventListener('click', unlockAudioContext, { passive: true });
window.addEventListener('touchstart', unlockAudioContext, { passive: true });
window.addEventListener('pointerdown', unlockAudioContext, { passive: true });

let customSirenAudio = null;

// ── Custom Sound Pack Emergency Siren (Loud & Dual-Layer) ─────────
function startSirenSound() {
  if (isSirenPlaying) return;
  isSirenPlaying = true;

  try {
    if (!customSirenAudio) {
      customSirenAudio = new Audio('/public/sounds/emergency_siren.wav');
      customSirenAudio.loop = true;
    }
    customSirenAudio.currentTime = 0;
    customSirenAudio.play().catch(() => {});
  } catch(e) {}

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!sirenAudioContext) {
      sirenAudioContext = new AudioContext();
    }
    if (sirenAudioContext.state === 'suspended') {
      sirenAudioContext.resume();
    }

    sirenOscillator = sirenAudioContext.createOscillator();
    sirenGain = sirenAudioContext.createGain();

    sirenOscillator.type = 'sawtooth';
    sirenGain.gain.setValueAtTime(0.95, sirenAudioContext.currentTime);

    sirenOscillator.connect(sirenGain);
    sirenGain.connect(sirenAudioContext.destination);

    let isHigh = false;
    sirenOscillator.frequency.setValueAtTime(650, sirenAudioContext.currentTime);
    sirenOscillator.start();

    // Vibrate phone initially
    if ('vibrate' in navigator) {
      navigator.vibrate([1000, 200, 1000, 200, 1000]);
    }

    sirenInterval = setInterval(() => {
      if (!isSirenPlaying || !sirenOscillator) return;
      isHigh = !isHigh;
      const targetFreq = isHigh ? 1350 : 650;
      if (sirenAudioContext && sirenAudioContext.state === 'running') {
        sirenOscillator.frequency.exponentialRampToValueAtTime(targetFreq, sirenAudioContext.currentTime + 0.35);
      }
      if ('vibrate' in navigator && isHigh) {
        navigator.vibrate([500, 100, 500]);
      }
    }, 380);
  } catch (e) {
    console.error('Audio siren init error:', e);
  }
}

function stopSirenSound() {
  isSirenPlaying = false;
  if (customSirenAudio) {
    try {
      customSirenAudio.pause();
      customSirenAudio.currentTime = 0;
    } catch(e) {}
  }
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  try {
    if (sirenOscillator) {
      sirenOscillator.stop();
      sirenOscillator.disconnect();
      sirenOscillator = null;
    }
    if (sirenAudioContext) {
      sirenAudioContext.close();
      sirenAudioContext = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  } catch (e) {}
}

function playGentleChime() {
  try {
    const chime = new Audio('/public/sounds/chime.wav');
    chime.play().catch(() => {});
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
  } catch (e) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    } catch (e2) {}
  }
}

function injectNotificationUI() {
  const headerRight = document.querySelector('header .flex.items-center.gap-xs, header .flex.items-center.gap-1\\.5, header .flex.items-center.gap-1, header .flex.items-center.gap-sm:last-child');
  
  if (headerRight && !document.getElementById('globalNotifBellBtn')) {
    const bellBtn = document.createElement('button');
    bellBtn.id = 'globalNotifBellBtn';
    bellBtn.type = 'button';
    bellBtn.className = 'relative p-1.5 text-primary hover:bg-surface-container-low rounded-full transition-all focus:outline-none flex items-center justify-center shrink-0';
    bellBtn.title = 'Notifications';
    bellBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleGlobalNotifications();
    };
    bellBtn.innerHTML = `
      <span class="material-symbols-outlined text-[22px]">notifications</span>
      <span id="globalNotifBadge" class="hidden absolute -top-0.5 -right-0.5 h-4 w-4 bg-error text-white text-[10px] font-bold rounded-full items-center justify-center pointer-events-none">0</span>
    `;
    headerRight.insertBefore(bellBtn, headerRight.firstChild);
  }

  // Request browser push notification permission if available
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission();
    }, 2000);
  }

  // Inject Drawer Modal & Emergency Siren Modal & Toast Banner if not present
  if (!document.getElementById('globalNotifModal')) {
    const modalHtml = `
      <!-- Live Dropdown Toast Banner on Screen -->
      <div id="liveToastBanner" style="display: none;" class="fixed top-4 left-1/2 -translate-x-1/2 z-[12000] w-[92%] max-w-md bg-surface-container-lowest border-2 border-primary shadow-2xl rounded-2xl p-4 flex items-start gap-3 cursor-pointer animate-in fade-in slide-in-from-top duration-300" onclick="handleToastClick()">
        <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <span id="toastIcon" class="material-symbols-outlined text-2xl">notifications_active</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-0.5">
            <h4 id="toastTitle" class="font-bold text-xs text-on-surface truncate">New Notification</h4>
            <span class="text-[10px] bg-primary text-white font-bold px-1.5 py-0.2 rounded uppercase">Just Now</span>
          </div>
          <p id="toastMessage" class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed"></p>
        </div>
        <button type="button" onclick="dismissToast(event)" class="text-on-surface-variant hover:text-on-surface p-1">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      <!-- Standard Notifications Drawer -->
      <div id="globalNotifModal" style="display: none;" class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs items-end sm:items-center justify-center p-0 sm:p-4">
        <div id="globalNotifContent" class="w-full max-w-md bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col border border-outline-variant shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
          
          <!-- Header -->
          <div class="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-2xl">notifications_active</span>
              <div>
                <h3 class="font-bold text-sm text-on-surface leading-tight">Notifications &amp; Alerts</h3>
                <span id="notifStatusSummary" class="text-[11px] text-on-surface-variant">Village alerts &amp; reports</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="markAllGlobalNotifsRead(event)" class="text-xs text-primary font-bold hover:underline px-2 py-1 bg-primary/10 rounded">Mark Read</button>
              <button type="button" onclick="closeGlobalNotifications(event)" class="p-1.5 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container">
                <span class="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>

          <!-- Sarpanch / Admin Broadcast Notice Trigger -->
          <div id="globalBroadcastBanner" class="hidden p-3 bg-primary/10 border-b border-outline-variant flex justify-between items-center px-4">
            <div>
              <span class="text-xs font-bold text-primary block">Panchayat Office</span>
              <span class="text-[10px] text-on-surface-variant">Send announcement or Emergency Siren</span>
            </div>
            <button type="button" onclick="openGlobalBroadcastModal(event)" class="px-3 py-1.5 bg-primary text-white text-xs font-bold uppercase rounded hover:bg-primary/90 shadow-xs">+ Send Notice</button>
          </div>

          <!-- Notifications List -->
          <div id="globalNotifList" class="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 min-h-[220px] max-h-[60vh] bg-surface">
            <p class="text-xs text-on-surface-variant italic text-center p-4">Loading notifications...</p>
          </div>
        </div>
      </div>

      <!-- Emergency Siren Auto-Popup Screen -->
      <div id="emergencySirenModal" style="display: none;" class="fixed inset-0 z-[11000] bg-red-950/90 backdrop-blur-md items-center justify-center p-4">
        <div class="w-full max-w-md bg-surface-container-lowest border-4 border-error rounded-2xl p-6 flex flex-col items-center text-center shadow-[0_0_50px_rgba(220,38,38,0.8)] animate-bounce-short">
          
          <!-- Flashing Alarm Icon -->
          <div class="w-20 h-20 rounded-full bg-error text-white flex items-center justify-center mb-3 animate-pulse shadow-lg">
            <span class="material-symbols-outlined text-5xl">warning</span>
          </div>

          <span class="px-3 py-1 bg-error text-white font-bold text-xs uppercase tracking-widest rounded-full mb-2 animate-ping-short">🚨 EMERGENCY SIREN ALERT</span>
          
          <h2 id="emergencyTitle" class="font-headline-lg text-error text-xl font-bold mb-2">Emergency Water Notice</h2>
          <p id="emergencyMessage" class="font-body-lg text-on-surface text-base mb-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant leading-relaxed text-left w-full"></p>
          
          <div class="w-full flex flex-col gap-2">
            <button type="button" onclick="dismissEmergencySiren(event)" class="w-full py-4 bg-error text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2">
              <span class="material-symbols-outlined">volume_off</span>
              Stop Siren &amp; Acknowledge
            </button>
          </div>
        </div>
      </div>

      <!-- Broadcast Modal -->
      <div id="globalBroadcastModal" style="display: none;" class="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs items-center justify-center p-4">
        <div id="globalBroadcastContent" class="w-full max-w-md bg-surface-container-lowest rounded-xl p-5 flex flex-col gap-3 border border-outline-variant shadow-2xl">
          <div class="flex justify-between items-center border-b border-outline-variant pb-2">
            <h3 class="font-bold text-primary text-base">Send Village Announcement</h3>
            <button type="button" onclick="closeGlobalBroadcastModal(event)" class="p-1 text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined">close</span></button>
          </div>
          
          <div class="flex flex-col gap-1">
            <label class="font-bold text-xs text-on-surface uppercase">Notice Title</label>
            <input type="text" id="globalNoticeTitle" placeholder="E.g. Main Pipeline Burst Near Gaothan" class="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded font-body-md text-sm focus:outline-none focus:border-primary">
          </div>
          
          <div class="flex flex-col gap-1">
            <label class="font-bold text-xs text-on-surface uppercase">Message Content</label>
            <textarea id="globalNoticeMessage" rows="3" placeholder="Enter emergency details or information for villagers..." class="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded font-body-md text-sm resize-none focus:outline-none focus:border-primary"></textarea>
          </div>

          <!-- Emergency Siren Toggle -->
          <div class="p-3 bg-error/10 border border-error/30 rounded-lg flex items-center gap-3 cursor-pointer">
            <input type="checkbox" id="emergencySirenToggle" class="w-5 h-5 accent-error cursor-pointer">
            <label for="emergencySirenToggle" class="text-xs font-bold text-error cursor-pointer">
              🚨 Play Loud Siren &amp; Auto-Open on Villagers' Phones
            </label>
          </div>

          <button type="button" onclick="submitGlobalBroadcast(event)" class="w-full py-3 bg-primary text-white font-bold text-xs uppercase rounded flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] transition-transform">
            <span class="material-symbols-outlined text-sm">send</span> Broadcast Notice to Village
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('globalNotifModal').addEventListener('click', (e) => {
      if (e.target.id === 'globalNotifModal') closeGlobalNotifications(e);
    });
    document.getElementById('globalBroadcastModal').addEventListener('click', (e) => {
      if (e.target.id === 'globalBroadcastModal') closeGlobalBroadcastModal(e);
    });
  }
}

async function fetchGlobalNotifications() {
  try {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    const data = await res.json();

    const badge = document.getElementById('globalNotifBadge');
    if (badge) {
      if (data.unreadCount > 0) {
        badge.textContent = data.unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (data.notifications && data.notifications.length > 0) {
      if (isFirstFetch) {
        // Initial fetch on app open: record all existing notifications as known so NO unwanted sound plays on startup
        data.notifications.forEach(n => {
          seenNotificationIds.add(n.id);
          handledEmergencyIds.add(n.id);
        });
        isFirstFetch = false;
      } else {
        // 1. Check for newly arriving Emergency Siren Alerts
        const latestUnreadEmergency = data.notifications.find(n => n.isEmergency && !n.isRead);
        if (latestUnreadEmergency && !handledEmergencyIds.has(latestUnreadEmergency.id)) {
          handledEmergencyIds.add(latestUnreadEmergency.id);
          triggerEmergencyPopup(latestUnreadEmergency);
        }

        // 2. Check for newly arriving general notifications (Show Toast Banner & Chime)
        const newest = data.notifications[0];
        if (newest && !newest.isRead && !seenNotificationIds.has(newest.id)) {
          seenNotificationIds.add(newest.id);
          if (!newest.isEmergency) {
            showToastBanner(newest);
          }
        }
      }
    }

    const container = document.getElementById('globalNotifList');
    if (container) {
      container.innerHTML = '';
      if (!data.notifications || data.notifications.length === 0) {
        container.innerHTML = `
          <div class="py-8 text-center flex flex-col items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined text-4xl mb-2 opacity-50">mark_email_read</span>
            <p class="text-xs italic">No notifications yet. You're all caught up!</p>
          </div>
        `;
        return;
      }

      data.notifications.forEach(n => {
        const timeStr = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
        const isUnread = !n.isRead;
        const iconName = n.isEmergency ? 'warning' : (n.type === 'issue' ? 'report_problem' : 'campaign');

        const itemDiv = document.createElement('div');
        itemDiv.className = `p-3 rounded-xl flex flex-col gap-1 transition-all shadow-xs ${
          n.isEmergency 
            ? 'bg-error-container/40 border-2 border-error text-on-error-container' 
            : (isUnread ? 'bg-surface-container-lowest border-primary/50 bg-primary-fixed/15 border-l-4 border-l-primary' : 'bg-surface-container-lowest border border-outline-variant opacity-85')
        }`;
        itemDiv.innerHTML = `
          <div class="flex justify-between items-start gap-2">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-base ${n.isEmergency ? 'text-error animate-pulse' : (isUnread ? 'text-primary' : 'text-on-surface-variant')}">${iconName}</span>
              <h4 class="font-bold text-xs ${n.isEmergency ? 'text-error font-extrabold' : 'text-on-surface'}">${n.title}</h4>
            </div>
            <span class="text-[10px] text-on-surface-variant shrink-0 font-medium">${timeStr}</span>
          </div>
          <p class="text-xs text-on-surface-variant leading-relaxed pl-5">${n.message}</p>
          <div class="flex justify-between items-center pl-5 mt-1">
            <span class="text-[10px] uppercase font-bold ${n.isEmergency ? 'text-error' : 'text-primary'} tracking-wider">${n.senderName || 'Panchayat'} (${n.senderRole || 'Official'})</span>
            ${n.isEmergency ? '<span class="text-[9px] bg-error text-white px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">🚨 EMERGENCY</span>' : (isUnread ? '<span class="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold uppercase">New</span>' : '')}
          </div>
        `;
        container.appendChild(itemDiv);
      });
    }
  } catch (e) {
    console.error('Error loading notifications:', e);
  }
}

function showToastBanner(notif) {
  const toast = document.getElementById('liveToastBanner');
  if (!toast) return;
  document.getElementById('toastTitle').textContent = notif.title;
  document.getElementById('toastMessage').textContent = notif.message;
  
  toast.style.display = 'flex';
  playGentleChime();

  // Show Native Phone Status Bar Push Notification if supported
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(notif.title, {
        body: notif.message,
        icon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBI2oc_Spp8I6sgWaFMdsSaFj6HCk6B0FcQPjuW5ESxOxg1qEkS2UujcZNWktzJc8s5jwVXxfZcpXC-_nT7qoyZfCico0MZXOysuOfdYGH_BObereTalqbra5mCuW0jZ4k0JiWCqJUizNUxZ0eoHab6alVwGgUk4JVZXPKdivAOY5RPtWQVl8LjrPw0-RknTkFttseIwCfgur0EmzMkWGVWB07KHOChoA5J8VhKNoq1A7a7uu-LpA0X4w',
        vibrate: [200, 100, 200]
      });
    } catch(e) {}
  }

  // Auto-hide toast after 8 seconds
  setTimeout(() => {
    if (toast.style.display !== 'none') {
      toast.style.display = 'none';
    }
  }, 8000);
}

function handleToastClick() {
  const toast = document.getElementById('liveToastBanner');
  if (toast) toast.style.display = 'none';
  openGlobalNotifications();
}

function dismissToast(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const toast = document.getElementById('liveToastBanner');
  if (toast) toast.style.display = 'none';
}

function triggerEmergencyPopup(notif) {
  const modal = document.getElementById('emergencySirenModal');
  if (modal) {
    document.getElementById('emergencyTitle').textContent = notif.title;
    document.getElementById('emergencyMessage').textContent = notif.message;
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    startSirenSound();
  }
}

function dismissEmergencySiren(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  stopSirenSound();
  const modal = document.getElementById('emergencySirenModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
  markAllGlobalNotifsRead();
}

function toggleGlobalNotifications() {
  const m = document.getElementById('globalNotifModal');
  if (!m) return;
  if (m.style.display === 'none' || m.classList.contains('hidden')) {
    openGlobalNotifications();
  } else {
    closeGlobalNotifications();
  }
}

function openGlobalNotifications() {
  const m = document.getElementById('globalNotifModal');
  if (m) {
    m.style.display = 'flex';
    m.classList.remove('hidden');
    isNotifModalOpen = true;
    fetchGlobalNotifications();
  }
}

function closeGlobalNotifications(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const m = document.getElementById('globalNotifModal');
  if (m) {
    m.style.display = 'none';
    m.classList.add('hidden');
    isNotifModalOpen = false;
  }
}

async function markAllGlobalNotifsRead(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  try {
    await fetch('/api/notifications/read-all', { method: 'PUT' });
    await fetchGlobalNotifications();
  } catch(e) { console.error(e); }
}

function openGlobalBroadcastModal(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const bm = document.getElementById('globalBroadcastModal');
  if (bm) {
    bm.style.display = 'flex';
    bm.classList.remove('hidden');
  }
}

function closeGlobalBroadcastModal(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const bm = document.getElementById('globalBroadcastModal');
  if (bm) {
    bm.style.display = 'none';
    bm.classList.add('hidden');
  }
}

async function submitGlobalBroadcast(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const title = document.getElementById('globalNoticeTitle').value.trim();
  const message = document.getElementById('globalNoticeMessage').value.trim();
  const isEmergency = document.getElementById('emergencySirenToggle').checked;

  if (!title || !message) {
    alert("Please enter both a title and message.");
    return;
  }
  try {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, targetRole: 'all', isEmergency })
    });
    if (res.ok) {
      alert(isEmergency ? "🚨 EMERGENCY SIREN ALERT broadcasted to all villagers' phones!" : "Announcement sent to all villagers successfully!");
      closeGlobalBroadcastModal();
      document.getElementById('globalNoticeTitle').value = '';
      document.getElementById('globalNoticeMessage').value = '';
      document.getElementById('emergencySirenToggle').checked = false;
      fetchGlobalNotifications();
    } else {
      alert("Failed to send notice.");
    }
  } catch(e) { console.error(e); }
}

// Check role to enable Sarpanch broadcast banner
async function checkRoleForNotifications() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    if (data.loggedIn && (data.user.role === 'Sarpanch' || data.user.role === 'Admin')) {
      const banner = document.getElementById('globalBroadcastBanner');
      if (banner) banner.classList.remove('hidden');
    }
  } catch(e) {}
}

function startNotificationSystem() {
  injectNotificationUI();
  fetchGlobalNotifications();
  checkRoleForNotifications();
  setInterval(fetchGlobalNotifications, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startNotificationSystem);
} else {
  startNotificationSystem();
}

// Expose globally
window.fetchGlobalNotifications = fetchGlobalNotifications;
window.toggleGlobalNotifications = toggleGlobalNotifications;
window.openGlobalNotifications = openGlobalNotifications;
window.closeGlobalNotifications = closeGlobalNotifications;
window.markAllGlobalNotifsRead = markAllGlobalNotifsRead;
window.openGlobalBroadcastModal = openGlobalBroadcastModal;
window.closeGlobalBroadcastModal = closeGlobalBroadcastModal;
window.submitGlobalBroadcast = submitGlobalBroadcast;
window.dismissEmergencySiren = dismissEmergencySiren;
window.handleToastClick = handleToastClick;
window.dismissToast = dismissToast;
