// Global Notification & Emergency Siren System for Village Water Management Portal

let isNotifModalOpen = false;
let sirenAudioContext = null;
let sirenOscillator = null;
let sirenGain = null;
let sirenInterval = null;
let isSirenPlaying = false;
let handledEmergencyIds = new Set();

// ── Web Audio API Siren Generator (Loud & Universal) ──────────────────
function startSirenSound() {
  if (isSirenPlaying) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    sirenAudioContext = new AudioContext();
    if (sirenAudioContext.state === 'suspended') {
      sirenAudioContext.resume();
    }

    sirenOscillator = sirenAudioContext.createOscillator();
    sirenGain = sirenAudioContext.createGain();

    sirenOscillator.type = 'sawtooth';
    sirenGain.gain.setValueAtTime(0.8, sirenAudioContext.currentTime);

    sirenOscillator.connect(sirenGain);
    sirenGain.connect(sirenAudioContext.destination);

    let isHigh = false;
    sirenOscillator.frequency.setValueAtTime(650, sirenAudioContext.currentTime);
    sirenOscillator.start();
    isSirenPlaying = true;

    sirenInterval = setInterval(() => {
      if (!isSirenPlaying || !sirenOscillator) return;
      isHigh = !isHigh;
      const targetFreq = isHigh ? 980 : 620;
      sirenOscillator.frequency.exponentialRampToValueAtTime(targetFreq, sirenAudioContext.currentTime + 0.35);
    }, 400);

    // Vibration on mobile phones
    if ('vibrate' in navigator) {
      navigator.vibrate([600, 200, 600, 200, 600, 200, 1000]);
    }
  } catch (e) {
    console.error('Audio siren init error:', e);
  }
}

function stopSirenSound() {
  if (!isSirenPlaying) return;
  isSirenPlaying = false;
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

function injectNotificationUI() {
  const headerRight = document.querySelector('header .flex.items-center.gap-xs, header .flex.items-center.gap-sm:last-child');
  
  if (headerRight && !document.getElementById('globalNotifBellBtn')) {
    const bellBtn = document.createElement('button');
    bellBtn.id = 'globalNotifBellBtn';
    bellBtn.type = 'button';
    bellBtn.className = 'relative p-2 text-primary hover:bg-surface-container-low rounded-full transition-all focus:outline-none flex items-center justify-center';
    bellBtn.title = 'Notifications';
    bellBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleGlobalNotifications();
    };
    bellBtn.innerHTML = `
      <span class="material-symbols-outlined text-[24px]">notifications</span>
      <span id="globalNotifBadge" class="hidden absolute top-1 right-1 h-4 w-4 bg-error text-white text-[10px] font-bold rounded-full items-center justify-center pointer-events-none">0</span>
    `;
    headerRight.insertBefore(bellBtn, headerRight.firstChild);
  }

  // Inject Drawer Modal & Emergency Siren Modal if not present
  if (!document.getElementById('globalNotifModal')) {
    const modalHtml = `
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

    // Check for incoming Emergency Siren alerts!
    if (data.notifications && data.notifications.length > 0) {
      const latestUnreadEmergency = data.notifications.find(n => n.isEmergency && !n.isRead);
      if (latestUnreadEmergency && !handledEmergencyIds.has(latestUnreadEmergency.id)) {
        handledEmergencyIds.add(latestUnreadEmergency.id);
        triggerEmergencyPopup(latestUnreadEmergency);
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

document.addEventListener('DOMContentLoaded', () => {
  injectNotificationUI();
  fetchGlobalNotifications();
  checkRoleForNotifications();
  setInterval(fetchGlobalNotifications, 10000);
});

// Expose globally
window.toggleGlobalNotifications = toggleGlobalNotifications;
window.openGlobalNotifications = openGlobalNotifications;
window.closeGlobalNotifications = closeGlobalNotifications;
window.markAllGlobalNotifsRead = markAllGlobalNotifsRead;
window.openGlobalBroadcastModal = openGlobalBroadcastModal;
window.closeGlobalBroadcastModal = closeGlobalBroadcastModal;
window.submitGlobalBroadcast = submitGlobalBroadcast;
window.dismissEmergencySiren = dismissEmergencySiren;
