const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

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

  // Revert previous responsive classes (Strings)
  content = content.replace('md:max-w-lg md:mx-auto md:border-x md:border-outline-variant md:shadow-2xl relative md:min-h-screen', '');
  content = content.replace(/md:max-w-lg md:left-1\/2 md:-translate-x-1\/2/g, '');

  // Fix JS querySelector for multiple nav links
  content = content.replace(/const (\w+)Link = document\.querySelector\('\[data-path="([^"]+)"\]'\);/g, "const $1Links = document.querySelectorAll('[data-path=\"$2\"]');");
  content = content.replace(/if \((\w+)Link\) \1Link\.style\.display = '([^']+)';/g, "if ($1Links) $1Links.forEach(l => l.style.display = '$2');");

  // Load Cheerio
  const $ = cheerio.load(content, { decodeEntities: false });

  // 1. Bottom Nav - hide on desktop
  $('nav[data-active-classes]').addClass('md:hidden');

  // 2. Inject Desktop Nav into Header
  const bottomNavLinks = $('nav[data-active-classes] a').clone();
  if (bottomNavLinks.length > 0 && $('header .desktop-nav').length === 0) {
    // Style desktop links
    bottomNavLinks.removeClass('flex-col min-w-[64px]').addClass('flex-row gap-xs hover:text-primary transition-colors text-base');
    bottomNavLinks.find('span.text-\\[10px\\]').removeClass('text-[10px]').addClass('text-sm');

    const desktopNavHtml = `<nav class="desktop-nav hidden md:flex items-center gap-lg ml-xl text-on-surface-variant font-label-bold">
      ${bottomNavLinks.map((i, el) => $.html(el)).get().join('')}
    </nav>`;
    
    // Append to left side of header
    $('header > div > div').first().append(desktopNavHtml);
  }

  // 3. Main content wide container
  $('main > div').first().addClass('md:max-w-7xl md:mx-auto md:px-lg');

  // 4. Grid layouts for specific containers
  if (file.includes('village_progress_home')) {
    $('#recent-fixes-container').addClass('md:grid md:grid-cols-2 lg:grid-cols-3');
    // For "How It Works" container
    $('h3:contains("How It Works")').next('div').find('> div').addClass('md:grid md:grid-cols-3 md:gap-lg');
  }
  
  if (file.includes('sarpanch_task_verification')) {
    $('#tasks-container').addClass('md:grid md:grid-cols-2 lg:grid-cols-3');
  }

  if (file.includes('admin_live_user_tracking')) {
    // The stats grid is already grid, but the lists (Recent Logins, Active Reports) can be grid
    $('h3:contains("Recent Logins")').next('div').addClass('md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-md');
    $('h3:contains("Active Reports")').next('div').addClass('md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-md');
  }

  if (file.includes('report_an_issue') || file.includes('contact_support')) {
    // Make forms narrower on desktop so they don't stretch 7xl
    $('main > div').first().removeClass('md:max-w-7xl').addClass('md:max-w-3xl');
  }

  fs.writeFileSync(filePath, $.html(), 'utf8');
});

console.log('Applied desktop UI redesign to all pages');
