const fs = require('fs');
const path = require('path');

const files = [
  'village_progress_home/code.html',
  'report_an_issue/code.html',
  'sarpanch_task_verification/code.html',
  'admin_live_user_tracking/code.html',
  'contact_support/code.html'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add logout button to header next to profile pic
  const profileImgRegex = /<img alt="Profile"[^>]+>/;
  if (content.match(profileImgRegex) && !content.includes('onclick="logout()"')) {
    content = content.replace(profileImgRegex, match => {
      return `<div class="flex items-center gap-xs"><button onclick="logout()" class="text-[11px] text-error font-label-bold uppercase hover:underline mr-2 py-1 px-2 border border-error rounded-full">Logout</button>${match}</div>`;
    });
  }

  // 2. Add logout script
  if (!content.includes('async function logout()')) {
    const logoutScript = `
async function logout() {
  if (!confirm("Are you sure you want to logout?")) return;
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) window.location.href = '/login';
  } catch(e) { console.error(e); }
}
`;
    // Add before the last closing script tag
    const scriptTags = [...content.matchAll(/<\/script>/g)];
    if (scriptTags.length > 0) {
      // Find the last one that is not inside the tailwind config
      const lastScriptTag = scriptTags[scriptTags.length - 1].index;
      content = content.substring(0, lastScriptTag) + logoutScript + content.substring(lastScriptTag);
    }
  }

  // 3. Fix nav logic for Sarpanch to show Report
  content = content.replace(
    /} else if \(role === 'Sarpanch'\) {\s*if \(homeLink\) homeLink.style.display = 'flex';\s*if \(reportLink\) reportLink.style.display = 'none';/g, 
    `} else if (role === 'Sarpanch') {
      if (homeLink) homeLink.style.display = 'flex';
      if (reportLink) reportLink.style.display = 'flex';`
  );

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('UI updated successfully');
