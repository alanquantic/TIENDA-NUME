import Script from 'next/script'

import { GA_MEASUREMENT_ID } from '@/lib/analytics'

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        id="ga4-consent-default"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
gtag('set', 'ads_data_redaction', true);
gtag('set', 'url_passthrough', true);
(function () {
  var allowed = /^(utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid)$/;
  var u = new URL(window.location.href);
  Array.from(u.searchParams.keys()).forEach(function (k) {
    if (!allowed.test(k)) u.searchParams.delete(k);
  });
  u.hash = '';
  gtag('set', { page_location: u.toString() });
})();
`
        }}
      />
      <Script
        id="ga4-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', {
  send_page_view: false,
  anonymize_ip: true
});
`
        }}
      />
    </>
  )
}
