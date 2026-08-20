const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const files = [
  'village_progress_home/code.html',
  'report_an_issue/code.html',
  'sarpanch_task_verification/code.html',
  'admin_live_user_tracking/code.html',
  'contact_support/code.html',
  'login_demo_role_detection/code.html'
];

let counter = 1;
const extractedStrings = {};

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(content, { decodeEntities: false });

  // Elements that typically contain text
  const selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'p', 'button', 'label', 'a', 'span', 'th', 'td'];

  selectors.forEach(sel => {
    $(sel).each((i, el) => {
      const $el = $(el);
      
      // Skip if already has data-i18n
      if ($el.attr('data-i18n')) return;
      
      // Check if it has direct text nodes with actual content (not just whitespace)
      const textNodes = $el.contents().filter(function() {
        return this.type === 'text' && this.data.trim().length > 0;
      });

      if (textNodes.length === 1 && $el.children().length === 0) {
        const text = textNodes[0].data.trim();
        // Ignore material icons or very short symbols
        if (text.length > 1 && !$el.hasClass('material-symbols-outlined') && text !== 'Home' && text !== 'Report' && text !== 'Tasks' && text !== 'Admin' && text !== 'Support') {
          const key = `auto_key_${counter++}`;
          extractedStrings[key] = text;
          $el.attr('data-i18n', key);
        }
      }
    });
  });

  // Save modified HTML
  fs.writeFileSync(filePath, $.html(), 'utf8');
});

fs.writeFileSync(path.join(__dirname, 'extracted.json'), JSON.stringify(extractedStrings, null, 2), 'utf8');
console.log(`Extracted ${Object.keys(extractedStrings).length} strings.`);
