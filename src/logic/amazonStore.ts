import { zonePlace } from '../seasons/place';

/**
 * Where the Fire TV app (com.singspree.tv) is in the Amazon Appstore, for the
 * /firetv page. It is live in every country, under one ASIN in every Amazon
 * store (checked 2026-11-10 on .de .co.uk .fr .it .es .co.jp .in .com.br .ca
 * .com.au .com.mx; amazon.com turns AI agents away, so that one is unchecked).
 *
 * The owner's Amazon Associates (PartnerNet) link goes to amazon.de. With
 * Amazon's Global Earning, a shopper from one of the account's Global Earning
 * countries who opens it is sent to their own Amazon store by Amazon itself,
 * and the purchase still counts for the tag. So visitors there get that link,
 * `tagged`, and the page says next to it that it is an affiliate link (as the
 * PartnerNet terms and German advertising law, § 5a UWG, ask). Austria,
 * Switzerland, Liechtenstein and Luxembourg shop at amazon.de itself.
 *
 * Everyone else would stay on amazon.de, which an account of another store
 * can't install from, so they get the plain page of their own store, read
 * from their device's time zone like the seasons (src/seasons/place.ts), and
 * amazon.com where their country has no store with an Appstore.
 */
const ASIN = 'B0HQXFQP12';
const TAGGED_DE = `https://www.amazon.de/dp/${ASIN}?&linkCode=ll2&tag=ch02c-21&linkId=beaee20953dfe0e01616cf6b504ec835&ref_=as_li_ss_tl`;

/**
 * The account's Global Earning countries (PartnerNet's list, 2026-11-10: US,
 * Canada, UK, Germany, France, Italy, Spain, Netherlands, Poland, Sweden) and
 * the amazon.de countries, by time zone. Amazon redirects by country, so only
 * the zones of those countries themselves, not their neighbours or overseas
 * territories (Ireland, Jersey, Monaco, Réunion …), which are listed below.
 * The US and Canada come from place.ts, which knows all their zones.
 */
const GLOBAL_EARNING = /^(Europe\/(Berlin|Busingen|Vienna|Zurich|Vaduz|Luxembourg|London|Belfast|Paris|Rome|Madrid|Amsterdam|Warsaw|Stockholm)|GB|GB-Eire|Poland|Atlantic\/Canary|Africa\/Ceuta)$/;
const GLOBAL_EARNING_PLACES = ['US', 'CA'];

/** Stores with an Appstore for the rest, by time zone (both old and new zone names) */
const STORES: [string, RegExp][] = [
  ['co.uk', /^(Europe\/(Dublin|Guernsey|Jersey|Isle_of_Man|Gibraltar)|Eire)$/],
  ['fr', /^(Europe\/(Monaco|Brussels)|America\/(Guadeloupe|Martinique|Cayenne)|Indian\/(Reunion|Mayotte))$/],
  ['it', /^Europe\/(San_Marino|Vatican)$/],
  ['es', /^Europe\/Andorra$/],
  ['co.jp', /^(Asia\/Tokyo|Japan)$/],
  ['in', /^Asia\/(Kolkata|Calcutta)$/],
  ['com.br', /^(America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Maceio|Belem|Araguaina|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Porto_Acre|Eirunepe|Santarem|Noronha)|Brazil\/.+)$/],
  ['com.mx', /^(America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Mazatlan|Bahia_Banderas|Hermosillo|Tijuana|Ensenada|Santa_Isabel)|Mexico\/.+)$/],
  // New Zealand shops at amazon.com.au
  ['com.au', /^(Australia\/.+|Pacific\/(Auckland|Chatham)|NZ|NZ-CHAT)$/],
];

/** The app's page in one store: its address, and whether it is the affiliate link */
export interface AmazonStore {
  href: string;
  tagged: boolean;
}

/** The app's page on amazon.com, for everywhere else (and for the crawler page) */
export const AMAZON_COM: AmazonStore = { href: `https://www.amazon.com/dp/${ASIN}`, tagged: false };

/** The store for a time zone (exported for the tests) */
export function zoneStore(zone: string): AmazonStore {
  if (GLOBAL_EARNING.test(zone) || GLOBAL_EARNING_PLACES.includes(zonePlace(zone).country ?? '')) return { href: TAGGED_DE, tagged: true };
  const tld = STORES.find(([, re]) => re.test(zone))?.[0];
  return tld ? { href: `https://www.amazon.${tld}/dp/${ASIN}`, tagged: false } : AMAZON_COM;
}

/** The store of this visitor, by their device's time zone */
export function amazonStore(): AmazonStore {
  try {
    return zoneStore(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
  } catch {
    return AMAZON_COM;
  }
}
