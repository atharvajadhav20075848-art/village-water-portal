const fs = require('fs');
const path = require('path');

const files = [
  'village_progress_home/code.html',
  'report_an_issue/code.html',
  'sarpanch_task_verification/code.html',
  'admin_live_user_tracking/code.html',
  'contact_support/code.html'
];

const langSwitcherHTML = `<select class="lang-switcher bg-surface-container-low text-on-surface font-label-bold text-sm rounded-md border border-outline-variant px-2 py-1 focus:outline-none focus:border-primary mr-2"><option value="en">English</option><option value="mr">मराठी (Marathi)</option><option value="hi">हिंदी (Hindi)</option></select>`;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add script tag if missing
  if (!content.includes('src="/public/js/i18n.js"')) {
    content = content.replace('</body>', '<script src="/public/js/i18n.js"></script>\n</body>');
  }

  // 2. Add language switcher to the header
  if (!content.includes('class="lang-switcher')) {
    if (content.includes('<button onclick="logout()"')) {
      content = content.replace('<button onclick="logout()"', langSwitcherHTML + '<button onclick="logout()"');
    } else {
      const profileImgRegex = /<img alt="Profile"/;
      if (content.match(profileImgRegex)) {
        content = content.replace(profileImgRegex, langSwitcherHTML + '<img alt="Profile"');
      }
    }
  }

  // 3. Add data-i18n attributes for navigation (bottom nav)
  content = content.replace(/>Home<\/span>/g, ' data-i18n="nav_home">Home</span>');
  content = content.replace(/>Report<\/span>/g, ' data-i18n="nav_report_short">Report</span>');
  content = content.replace(/>Tasks<\/span>/g, ' data-i18n="nav_tasks">Tasks</span>');
  content = content.replace(/>Admin<\/span>/g, ' data-i18n="nav_admin_short">Admin</span>');
  content = content.replace(/>Support<\/span>/g, ' data-i18n="nav_support_short">Support</span>');

  // Specific text replacements for Village Progress Home
  if (file.includes('village_progress_home')) {
    content = content.replace(/>Village Success<\/h2>/g, ' data-i18n="home_success">Village Success</h2>');
    content = content.replace(/>Together we keep our water flowing.<\/p>/g, ' data-i18n="home_together">Together we keep our water flowing.</p>');
    content = content.replace(/>How It Works<\/h3>/g, ' data-i18n="home_how_it_works">How It Works</h3>');
    content = content.replace(/Report a New Issue\s*<\/button>/, '<span data-i18n="home_report_btn">Report a New Issue</span></button>');
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

// Update the public/js/i18n.js file with new keys
const i18nFilePath = path.join(__dirname, 'public/js/i18n.js');
let i18nContent = fs.readFileSync(i18nFilePath, 'utf8');

if (!i18nContent.includes('"nav_report_short"')) {
  i18nContent = i18nContent.replace('"nav_report": "Report Issue",', '"nav_report": "Report Issue",\n    "nav_report_short": "Report",\n    "nav_admin_short": "Admin",\n    "nav_support_short": "Support",\n    "home_success": "Village Success",\n    "home_together": "Together we keep our water flowing.",\n    "home_how_it_works": "How It Works",');
  
  i18nContent = i18nContent.replace('"nav_report": "समस्या नोंदवा",', '"nav_report": "समस्या नोंदवा",\n    "nav_report_short": "नोंदवा",\n    "nav_admin_short": "अॅडमिन",\n    "nav_support_short": "मदत",\n    "home_success": "ग्राम यश",\n    "home_together": "एकत्र आपण पाणी प्रवाहित ठेवू.",\n    "home_how_it_works": "हे कसे कार्य करते",');
  
  i18nContent = i18nContent.replace('"nav_report": "समस्या दर्ज करें",', '"nav_report": "समस्या दर्ज करें",\n    "nav_report_short": "दर्ज करें",\n    "nav_admin_short": "एडमिन",\n    "nav_support_short": "सहायता",\n    "home_success": "ग्राम सफलता",\n    "home_together": "हम साथ मिलकर पानी बहते रखते हैं।",\n    "home_how_it_works": "यह कैसे काम करता है",');
  
  fs.writeFileSync(i18nFilePath, i18nContent, 'utf8');
}

console.log('Applied i18n to all pages');
