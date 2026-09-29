export type Severity = 'critical' | 'medium' | 'low';

export type CatalogEntry = {
  severity: Severity;
  /** Shown when the check fails. */
  title: string;
  /** Shown in "What passed". */
  passTitle: string;
  whatItIs: string;
  whyItMatters: string;
  howToFix: string;
};

export const CATALOG = {
  'tls.no_https': {
    severity: 'critical',
    title: 'Your site doesn’t offer a secure connection',
    passTitle: 'Your site offers a secure (HTTPS) connection',
    whatItIs:
      'Your website can’t be opened with a secure “https://” address. Everything visitors send and receive travels in plain text.',
    whyItMatters:
      'Anyone on the same Wi-Fi, or anywhere along the way, can read or change what your visitors see, including contact forms, logins and payment details. Browsers also label your site “Not secure”, which puts customers off.',
    howToFix:
      'Turn on HTTPS with a free certificate. Most hosts (cPanel, Wix, Squarespace, Shopify, WordPress hosts) have a one-click “SSL” or “Let’s Encrypt” option. Cloudflare’s free plan also adds HTTPS in front of any site.',
  },
  'tls.cert_invalid': {
    severity: 'critical',
    title: 'Your security certificate isn’t valid',
    passTitle: 'Your security certificate is valid and trusted',
    whatItIs:
      'Your site has a security certificate, but browsers don’t accept it. It may have expired, belong to a different domain, or not come from a trusted provider.',
    whyItMatters:
      'Visitors see a full-page “Your connection is not private” warning, and most will leave. It also trains customers to click through warnings, which is exactly what attackers rely on.',
    howToFix:
      'Renew or reissue the certificate for this exact domain from your host’s SSL settings, and turn on auto-renewal. Free Let’s Encrypt certificates renew themselves every 90 days when set up correctly.',
  },
  'tls.cert_expiring_soon': {
    severity: 'medium',
    title: 'Your security certificate expires soon',
    passTitle: 'Your security certificate isn’t close to expiring',
    whatItIs: 'Your certificate is valid now, but it runs out in less than two weeks.',
    whyItMatters:
      'When it expires, every visitor sees a security warning instead of your site until it’s renewed.',
    howToFix:
      'Renew it now in your host’s SSL settings, and switch on auto-renewal so this doesn’t happen again.',
  },
  'tls.legacy_protocol': {
    severity: 'low',
    title: 'Your site still accepts outdated secure connections',
    passTitle: 'Your site only accepts modern secure connections',
    whatItIs:
      'Your site still agrees to connect using TLS 1.0 or 1.1, old versions of the technology behind “https://” that browsers stopped using in 2020.',
    whyItMatters:
      'These old versions have known weaknesses. Up-to-date browsers won’t use them, but visitors on old phones or computers can end up on a weaker connection. Payment card rules (PCI DSS) also forbid them if you take card payments.',
    howToFix:
      'In your host’s or Cloudflare’s SSL/TLS settings, set the minimum TLS version to 1.2. On your own server, allow only TLS 1.2 and 1.3 (for example “ssl_protocols TLSv1.2 TLSv1.3;” in Nginx).',
  },
  'http.no_https_redirect': {
    severity: 'medium',
    title: 'Visitors aren’t moved to the secure version of your site',
    passTitle: 'Visitors are moved to the secure version of your site',
    whatItIs:
      'If someone types your address without “https://”, they stay on the insecure version instead of being sent to the secure one.',
    whyItMatters:
      'Many people type just your domain or follow old links. Those visitors browse unprotected, even though you have HTTPS.',
    howToFix:
      'Turn on “Force HTTPS” or “Always use HTTPS” in your host or Cloudflare settings. On your own server, add a permanent (301) redirect from http:// to https://.',
  },
  'header.hsts_missing': {
    severity: 'medium',
    title: 'Browsers aren’t told to always use a secure connection',
    passTitle: 'Browsers are told to always use a secure connection',
    whatItIs:
      'Your site doesn’t send the “Strict-Transport-Security” setting, which tells browsers to only ever connect to you securely.',
    whyItMatters:
      'Without it, an attacker on public Wi-Fi can quietly downgrade a visitor to the insecure version of your site before the redirect happens.',
    howToFix:
      'Add the header “Strict-Transport-Security: max-age=31536000; includeSubDomains”. Cloudflare has it under SSL/TLS → Edge Certificates → HSTS; WordPress security plugins can add it too.',
  },
  'header.csp_missing': {
    severity: 'medium',
    title: 'Your site doesn’t limit where its content can come from',
    passTitle: 'Your site limits where its content can come from',
    whatItIs:
      'Your site doesn’t send a “Content-Security-Policy”, a list of the places your pages are allowed to load scripts and content from.',
    whyItMatters:
      'If an attacker manages to slip malicious code into a page (for example through a comment form or a hacked plugin), nothing stops it from running and stealing visitor details.',
    howToFix:
      'Ask your developer to add a Content-Security-Policy header. Start in “report-only” mode to see what would break, then switch it on. Many site builders handle this for you.',
  },
  'header.xfo_missing': {
    severity: 'low',
    title: 'Other sites can show your pages inside theirs',
    passTitle: 'Other sites can’t show your pages inside theirs',
    whatItIs:
      'Your site doesn’t say whether other websites may embed it in a frame (the “X-Frame-Options” or “frame-ancestors” setting).',
    whyItMatters:
      'A fake site can load your real page invisibly and trick visitors into clicking buttons they can’t see, like “Buy” or “Delete account”.',
    howToFix:
      "Add the header “X-Frame-Options: SAMEORIGIN”, or “frame-ancestors 'self'” in your Content-Security-Policy.",
  },
  'header.xcto_missing': {
    severity: 'low',
    title: 'Browsers may guess what your files are',
    passTitle: 'Browsers are told not to guess file types',
    whatItIs: 'Your site doesn’t send “X-Content-Type-Options: nosniff”.',
    whyItMatters:
      'Without it, a browser may treat an uploaded file (like an image) as a script and run it, which attackers can abuse.',
    howToFix: 'Add the header “X-Content-Type-Options: nosniff”. It’s one line and never breaks anything.',
  },
  'header.referrer_policy_missing': {
    severity: 'low',
    title: 'Your site may share page addresses with other sites',
    passTitle: 'Your site controls what it shares with other sites',
    whatItIs: 'Your site doesn’t set a “Referrer-Policy”.',
    whyItMatters:
      'When visitors click a link to another site, the full address of the page they were on can be passed along, sometimes including private details in the link.',
    howToFix: 'Add the header “Referrer-Policy: strict-origin-when-cross-origin”.',
  },
  'header.server_version_leak': {
    severity: 'low',
    title: 'Your site reveals what software version it runs',
    passTitle: 'Your site doesn’t reveal its software versions',
    whatItIs:
      'Your server announces its software and exact version number (for example “Apache/2.4.41” or “PHP/7.4”).',
    whyItMatters:
      'Attackers use version numbers to look up known weaknesses and pick targets running old, unpatched software.',
    howToFix:
      'Hide version details in your server settings (for example “ServerTokens Prod” in Apache, “server_tokens off” in Nginx, “expose_php = Off” for PHP) and keep the software up to date.',
  },
  'path.env_exposed': {
    severity: 'critical',
    title: 'Your private settings file is public',
    passTitle: 'Your private settings file (.env) isn’t public',
    whatItIs:
      'A file called “.env” on your site can be downloaded by anyone. It usually holds the passwords and keys that connect your site to its database, email and payment services.',
    whyItMatters:
      'Attackers scan the internet for this file automatically. With it they could log into your database, send email as you or reach your payment account.',
    howToFix:
      'Remove the file from your public web folder (or block it in your server settings) today. Then change every password and key it contained, because you can’t know who already copied them. Ask your host or developer if you’re not sure where it is.',
  },
  'path.git_exposed': {
    severity: 'critical',
    title: 'Your site’s source code can be downloaded',
    passTitle: 'Your site’s source code history isn’t public',
    whatItIs:
      'The hidden “.git” folder, where your developer’s tools keep the full history of your site’s code, can be read by anyone.',
    whyItMatters:
      'Free tools can rebuild your whole codebase from it, including any passwords or keys ever saved in it, and show attackers exactly how your site works.',
    howToFix:
      'Delete the .git folder from the live site or block access to it in your server settings (for example “location ~ /\\.git { deny all; }” in Nginx). Then change any passwords or keys that were ever in the code.',
  },
  'path.htpasswd_exposed': {
    severity: 'critical',
    title: 'Your password file is public',
    passTitle: 'Your password file (.htpasswd) isn’t public',
    whatItIs:
      'The “.htpasswd” file, which stores usernames and scrambled passwords for protected parts of your site, can be downloaded by anyone.',
    whyItMatters:
      'Scrambled passwords can often be cracked, especially short ones. Attackers then get into the areas the file was meant to protect.',
    howToFix:
      'Move the file outside your public web folder, or block access to it. Then set new passwords for every account in it.',
  },
  'path.backup_exposed': {
    severity: 'critical',
    title: 'A backup of your site is public',
    passTitle: 'No site or database backups are public',
    whatItIs:
      'A backup file (such as a database export, a zip of your site or a copy of your WordPress settings) sits in your public web folder where anyone can download it.',
    whyItMatters:
      'Backups often contain everything: customer details, orders, admin accounts and database passwords. It’s like leaving a copy of your filing cabinet on the pavement.',
    howToFix:
      'Delete the backup from the web folder today and keep backups somewhere private (your host’s backup tool or offline storage). If it held passwords or customer data, change the passwords and ask your developer whether anyone downloaded it.',
  },
  'path.debug_page_exposed': {
    severity: 'medium',
    title: 'A technical information page is public',
    passTitle: 'No technical information pages are public',
    whatItIs:
      'A page meant for developers (such as “phpinfo” or Apache’s “server-status”) is open to everyone. It lists your server’s software, versions, settings and sometimes visitor activity.',
    whyItMatters:
      'It hands attackers a detailed map of your server, making it much easier to find a weakness to exploit.',
    howToFix:
      'Delete the page (for phpinfo, the .php file that shows it), or restrict it to your own IP address in your server settings.',
  },
  'path.db_admin_exposed': {
    severity: 'medium',
    title: 'Your database admin login is open to everyone',
    passTitle: 'Your database admin tool isn’t publicly reachable',
    whatItIs: 'The login page for phpMyAdmin, a tool that gives full control of your database, can be reached by anyone on the internet.',
    whyItMatters:
      'Attackers constantly try common passwords on these pages. One weak or reused password gives them every record in your database.',
    howToFix:
      'Remove phpMyAdmin from the public site if you don’t need it, or limit it to your own IP address or put it behind your host’s control panel login.',
  },
  'path.ds_store_exposed': {
    severity: 'low',
    title: 'A Mac folder listing file is public',
    passTitle: 'No Mac folder listing files are public',
    whatItIs:
      'A “.DS_Store” file, created automatically by Macs, was uploaded to your site. It lists the names of the files in that folder.',
    whyItMatters:
      'It can reveal hidden files and folders (like old backups or admin pages) that attackers would otherwise have to guess.',
    howToFix: 'Delete the .DS_Store files from your web folder and tell your upload tool or developer to skip them.',
  },
} satisfies Record<string, CatalogEntry>;

export type CheckId = keyof typeof CATALOG;
