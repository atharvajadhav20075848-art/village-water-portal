const translations = {
  en: {
    // Shared
    "nav_home": "Home",
    "nav_login": "Login",
    "nav_report": "Report Issue",
    "nav_report_short": "Report",
    "nav_admin_short": "Admin",
    "nav_support_short": "Support",
    "home_success": "Village Success",
    "home_together": "Together we keep our water flowing.",
    "home_how_it_works": "How It Works",
    "nav_admin": "Admin Dashboard",
    "nav_tasks": "Verify Tasks",
    "nav_support": "Contact Support",

    // Login Page
    "login_title": "Village Water Portal",
    "login_subtitle": "Sign in to manage reports and tasks.",
    "login_email": "Email",
    "login_email_placeholder": "Enter your email",
    "login_password": "Password",
    "login_password_placeholder": "Enter your password",
    "login_btn": "Login",
    "login_or": "OR",
    "login_contact": "Need access? Contact your village administrator.",

    // Home Page
    "home_title": "Gram Panchayat Water Progress",
    "home_subtitle": "Track and manage water infrastructure development.",
    "home_report_btn": "Report Issue",
    "home_support_btn": "Contact Support",
    
    // Add more strings dynamically as we update each page
  },
  mr: {
    // Shared
    "nav_home": "मुख्यपृष्ठ",
    "nav_login": "लॉगिन",
    "nav_report": "समस्या नोंदवा",
    "nav_report_short": "नोंदवा",
    "nav_admin_short": "अॅडमिन",
    "nav_support_short": "मदत",
    "home_success": "ग्राम यश",
    "home_together": "एकत्र आपण पाणी प्रवाहित ठेवू.",
    "home_how_it_works": "हे कसे कार्य करते",
    "nav_admin": "अॅडमिन डॅशबोर्ड",
    "nav_tasks": "कामे तपासा",
    "nav_support": "मदत संपर्क",

    // Login Page
    "login_title": "ग्राम पाणी पोर्टल",
    "login_subtitle": "अहवाल आणि कामे व्यवस्थापित करण्यासाठी साइन इन करा.",
    "login_email": "ईमेल",
    "login_email_placeholder": "तुमचा ईमेल टाका",
    "login_password": "पासवर्ड",
    "login_password_placeholder": "तुमचा पासवर्ड टाका",
    "login_btn": "लॉगिन",
    "login_or": "किंवा",
    "login_contact": "प्रवेश हवा आहे? तुमच्या ग्रामप्रशासनाशी संपर्क साधा.",

    // Home Page
    "home_title": "ग्रामपंचायत पाणी प्रगती",
    "home_subtitle": "पाणी पायाभूत सुविधांचा विकास मागोवा आणि व्यवस्थापित करा.",
    "home_report_btn": "समस्या नोंदवा",
    "home_support_btn": "मदत संपर्क",
  },
  hi: {
    // Shared
    "nav_home": "होम",
    "nav_login": "लॉगिन",
    "nav_report": "समस्या दर्ज करें",
    "nav_report_short": "दर्ज करें",
    "nav_admin_short": "एडमिन",
    "nav_support_short": "सहायता",
    "home_success": "ग्राम सफलता",
    "home_together": "हम साथ मिलकर पानी बहते रखते हैं।",
    "home_how_it_works": "यह कैसे काम करता है",
    "nav_admin": "व्यवस्थापक डैशबोर्ड",
    "nav_tasks": "कार्य सत्यापित करें",
    "nav_support": "सहायता संपर्क",

    // Login Page
    "login_title": "ग्राम जल पोर्टल",
    "login_subtitle": "रिपोर्ट और कार्यों को प्रबंधित करने के लिए साइन इन करें।",
    "login_email": "ईमेल",
    "login_email_placeholder": "अपना ईमेल दर्ज करें",
    "login_password": "पासवर्ड",
    "login_password_placeholder": "अपना पासवर्ड दर्ज करें",
    "login_btn": "लॉगिन",
    "login_or": "या",
    "login_contact": "पहुंच चाहिए? अपने ग्राम प्रशासक से संपर्क करें।",

    // Home Page
    "home_title": "ग्राम पंचायत जल प्रगति",
    "home_subtitle": "जल अवसंरचना विकास को ट्रैक और प्रबंधित करें।",
    "home_report_btn": "समस्या दर्ज करें",
    "home_support_btn": "सहायता संपर्क",
  }
};

function setLanguage(lang) {
  if (!translations[lang]) lang = 'en';
  localStorage.setItem('preferredLanguage', lang);
  
  // Update dropdown value if it exists
  const langSelects = document.querySelectorAll('.lang-switcher');
  langSelects.forEach(select => {
    select.value = lang;
  });

  // Update elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      // If it's an input with placeholder
      if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
        el.setAttribute('placeholder', translations[lang][key]);
      } else {
        el.textContent = translations[lang][key];
      }
    }
  });
}

function initLanguage() {
  const savedLang = localStorage.getItem('preferredLanguage') || 'en';
  setLanguage(savedLang);
  
  // Attach event listeners to all dropdowns
  document.querySelectorAll('.lang-switcher').forEach(select => {
    select.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanguage);
} else {
  initLanguage();
}
