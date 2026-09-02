import { Language } from '../store/languageStore';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & Top Navbar
    search_placeholder: "Search problems, skills, locations...",
    nav_home: "Home Feed",
    nav_explore: "Explore Problems",
    nav_nearby: "Nearby Issues",
    nav_saved: "Saved Problems",
    nav_notifications: "Notifications",
    nav_profile: "My Community Profile",
    nav_sign_in: "Sign In",
    nav_sign_up: "Sign Up",
    nav_sign_out: "Sign Out",
    nav_your_profile: "Your Profile",
    nav_account_settings: "Account Settings",
    nav_admin_portal: "Admin Portal",

    // Feed Filter Tabs
    tab_for_you: "For You",
    tab_trending: "Trending",
    tab_nearby: "Nearby",
    tab_latest: "Latest",
    tab_all: "All",

    // Problem Categories
    cat_water: "Water & Sanitation",
    cat_energy: "Clean Energy & Solar",
    cat_waste: "Waste Management",
    cat_agri: "Agriculture & Rural Tech",
    cat_health: "Healthcare & Medical Devices",
    cat_infra: "Smart Infrastructure & Roads",

    // Feed & Create Post
    report_issue: "Report Issue",
    report_challenge: "Report Community Challenge",
    what_problem: "What societal problem or challenge are you seeing in your community?",
    problem_title: "Problem Title (e.g. Waterlogging in Ward 4)",
    problem_description: "Describe the issue, who is affected, and what solution is needed...",
    photo: "Photo",
    video: "Video",
    location: "Location",
    publish_challenge: "Publish Challenge",

    // Status Badges
    status_submitted: "Reported",
    status_under_review: "Under Review",
    status_verified: "Verified",
    status_in_progress: "Solution Active",
    status_pilot: "Field Pilot",
    status_solution_submitted: "Solution Submitted",
    status_solved: "Solved",
    status_rejected: "Rejected",

    // Actions & Buttons
    view_details: "View Details",
    join_pod: "Join Pod",
    share: "Share",
    save: "Save",
    endorse: "Endorse",
    comments: "Comments",
    cancel: "Cancel",
    save_profile: "Save Profile",
    edit_profile: "Edit Profile",

    // Sidebar & Labels
    recent_problems: "Recent Community Problems",
    network_title: "SamadhanX Network",
    network_tagline: "Real Problems. Right People. Real Solutions.",
    network_desc: "Connect with innovators, faculty mentors, and community leaders to turn societal challenges into scalable solutions.",
    community_impact: "Community Reporter Impact",
    community_impact_desc: "Report verified societal challenges in your district to connect with university research teams and municipal partners.",

    // Profile Page
    my_problems: "My Submitted Problems",
    badges_recognition: "Badges & Recognition",
    stat_submitted: "Submitted",
    stat_pending: "Pending",
    stat_approved: "Approved",
    stat_solved: "Solved",
    followers: "Followers",
    following: "Following",

    // Badges
    badge_verified_reporter: "Verified Reporter",
    badge_verified_reporter_desc: "Verified citizen account active on SamadhanX.",
    badge_community_contributor: "Community Contributor",
    badge_community_contributor_desc: "Submitted societal issues for university & municipal action.",
    badge_impact_maker: "Impact Maker",
    badge_impact_maker_desc: "Community problems successfully solved by solution pods.",
    badge_civic_member: "Civic Member",
    badge_civic_member_desc: "Active civic participant crowdsourcing solutions for Ward & District development.",

    // Account Settings
    settings_title: "Account Settings & Privacy",
    email_notifications: "Email Notifications",
    email_notifications_desc: "Receive email updates on status changes and community responses.",
    push_notifications: "Real-time Notifications",
    push_notifications_desc: "Receive instant notifications for problem endorsements and comments.",
    public_profile: "Public Profile Visibility",
    public_profile_desc: "Allow verified innovators and municipal partners to view your profile.",
    show_contact: "Contact Details Sharing",
    show_contact_desc: "Show contact phone/email to assigned university innovation pods.",
    danger_zone: "Danger Zone",
    delete_account: "Delete My Account",
    delete_account_warning: "Permanently delete your account, reported issues, and profile data from SamadhanX.",
    delete_confirm_title: "Are you absolutely sure?",
    delete_confirm_desc: "This action cannot be undone. All your reported problems, comments, and profile information will be permanently deleted.",
    confirm_delete: "Permanently Delete My Account",
  },
  hi: {
    // Navigation & Top Navbar
    search_placeholder: "समस्याएं, कौशल, स्थान खोजें...",
    nav_home: "होम फीड",
    nav_explore: "समस्याएं खोजें",
    nav_nearby: "आस-पास के मुद्दे",
    nav_saved: "सहेजी गई समस्याएं",
    nav_notifications: "सूचनाएं",
    nav_profile: "मेरी प्रोफ़ाइल",
    nav_sign_in: "साइन इन",
    nav_sign_up: "साइन अप",
    nav_sign_out: "साइन आउट",
    nav_your_profile: "आपकी प्रोफ़ाइल",
    nav_account_settings: "खाता सेटिंग्स",
    nav_admin_portal: "एडमिन पोर्टल",

    // Feed Filter Tabs
    tab_for_you: "आपके लिए",
    tab_trending: "ट्रेंडिंग",
    tab_nearby: "आस-पास",
    tab_latest: "नवीनतम",
    tab_all: "सभी",

    // Problem Categories
    cat_water: "जल एवं स्वच्छता",
    cat_energy: "स्वच्छ ऊर्जा एवं सौर",
    cat_waste: "अपशिष्ट प्रबंधन",
    cat_agri: "कृषि एवं ग्रामीण तकनीक",
    cat_health: "स्वास्थ्य सेवा एवं चिकित्सा उपकरण",
    cat_infra: "स्मार्ट इंफ्रास्ट्रक्चर एवं सड़कें",

    // Feed & Create Post
    report_issue: "समस्या दर्ज करें",
    report_challenge: "सामुदायिक समस्या दर्ज करें",
    what_problem: "आप अपने समुदाय में कौन सी सामाजिक समस्या देख रहे हैं?",
    problem_title: "समस्या का शीर्षक (जैसे वार्ड 4 में जलभराव)",
    problem_description: "समस्या का विवरण दें, कौन प्रभावित है, और क्या समाधान चाहिए...",
    photo: "फोटो",
    video: "वीडियो",
    location: "स्थान",
    publish_challenge: "समस्या प्रकाशित करें",

    // Status Badges
    status_submitted: "दर्ज की गई",
    status_under_review: "समीक्षाधीन",
    status_verified: "सत्यापित",
    status_in_progress: "समाधान सक्रिय",
    status_pilot: "फील्ड पायलट",
    status_solution_submitted: "समाधान प्रस्तुत",
    status_solved: "हल किया गया",
    status_rejected: "अस्वीकृत",

    // Actions & Buttons
    view_details: "विवरण देखें",
    join_pod: "टीम से जुड़ें",
    share: "शेयर करें",
    save: "सहेजें",
    endorse: "समर्थन करें",
    comments: "टिप्पणियां",
    cancel: "रद्द करें",
    save_profile: "प्रोफ़ाइल सहेजें",
    edit_profile: "प्रोफ़ाइल संपादित करें",

    // Sidebar & Labels
    recent_problems: "हाल की सामुदायिक समस्याएं",
    network_title: "समाधानX नेटवर्क",
    network_tagline: "वास्तविक समस्याएं। सही लोग। वास्तविक समाधान।",
    network_desc: "सामाजिक चुनौतियों को स्केलेबल समाधानों में बदलने के लिए नवप्रवर्तकों, संकाय सलाहकारों और समुदाय के नेताओं से जुड़ें।",
    community_impact: "समुदाय रिपोर्टर प्रभाव",
    community_impact_desc: "विश्वविद्यालय अनुसंधान टीमों और नगर निगम भागीदारों से जुड़ने के लिए अपने जिले में सत्यापित सामाजिक चुनौतियों की रिपोर्ट करें।",

    // Profile Page
    my_problems: "मेरी दर्ज की गई समस्याएं",
    badges_recognition: "बैज और पहचान",
    stat_submitted: "दर्ज की गई",
    stat_pending: "लंबित",
    stat_approved: "स्वीकृत",
    stat_solved: "हल की गई",
    followers: "फ़ॉलोअर्स",
    following: "फ़ॉलो कर रहे हैं",

    // Badges
    badge_verified_reporter: "सत्यापित रिपोर्टर",
    badge_verified_reporter_desc: "समाधानX पर सक्रिय सत्यापित नागरिक खाता।",
    badge_community_contributor: "समुदाय योगदानकर्ता",
    badge_community_contributor_desc: "विश्वविद्यालय और नगर निगम कार्रवाई के लिए सामाजिक मुद्दे प्रस्तुत किए।",
    badge_impact_maker: "प्रभाव निर्माता",
    badge_impact_maker_desc: "समाधान पॉड्स द्वारा सफलतापूर्वक हल की गई सामुदायिक समस्याएं।",
    badge_civic_member: "नागरिक सदस्य",
    badge_civic_member_desc: "वार्ड और जिला विकास के लिए समाधान क्राउडसोर्सिंग करने वाला सक्रिय नागरिक सदस्य।",

    // Account Settings
    settings_title: "खाता सेटिंग्स और गोपनीयता",
    email_notifications: "ईमेल सूचनाएं",
    email_notifications_desc: "स्थिति में परिवर्तन और सामुदायिक प्रतिक्रियाओं पर ईमेल अपडेट प्राप्त करें।",
    push_notifications: "वास्तविक समय की सूचनाएं",
    push_notifications_desc: "समस्या के समर्थन और टिप्पणियों के लिए तत्काल सूचनाएं प्राप्त करें।",
    public_profile: "सार्वजनिक प्रोफ़ाइल दृश्यता",
    public_profile_desc: "सत्यापित नवप्रवर्तकों और नगर निगम भागीदारों को आपकी प्रोफ़ाइल देखने की अनुमति दें।",
    show_contact: "संपर्क विवरण साझा करना",
    show_contact_desc: "आवंटित विश्वविद्यालय नवाचार पॉड्स को संपर्क फोन/ईमेल दिखाएं।",
    danger_zone: "खतरा क्षेत्र",
    delete_account: "मेरा खाता हटाएं",
    delete_account_warning: "समाधानX से अपना खाता, दर्ज समस्याएं और प्रोफ़ाइल डेटा स्थायी रूप से हटा दें।",
    delete_confirm_title: "क्या आप पूरी तरह से आश्वस्त हैं?",
    delete_confirm_desc: "यह कार्रवाई पूर्ववत नहीं की जा सकती। आपकी सभी दर्ज की गई समस्याएं, टिप्पणियां और प्रोफ़ाइल जानकारी स्थायी रूप से हटा दी जाएगी।",
    confirm_delete: "मेरा खाता स्थायी रूप से हटाएं",
  },
};

export const getTranslation = (lang: Language, key: string): string => {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
};
