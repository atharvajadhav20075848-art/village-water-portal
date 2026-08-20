const fs = require('fs');
const path = require('path');

const files = [
  'login_demo_role_detection/code.html',
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

  // Fix body
  if (content.includes('<body class="bg-surface text-on-surface font-body-md">')) {
    content = content.replace('<body class="bg-surface text-on-surface font-body-md">', '<body class="bg-surface text-on-surface font-body-md md:max-w-lg md:mx-auto md:border-x md:border-outline-variant md:shadow-2xl relative md:min-h-screen">');
  }

  // Fix headers
  content = content.replace(/class="fixed top-0 w-full/g, 'class="fixed top-0 w-full md:max-w-lg md:left-1/2 md:-translate-x-1/2');
  content = content.replace(/class="fixed bottom-0 w-full/g, 'class="fixed bottom-0 w-full md:max-w-lg md:left-1/2 md:-translate-x-1/2');

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Applied responsive PC layout to all pages');
