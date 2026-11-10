import { zonePlace } from '../seasons/place';

/**
 * Where the Fire TV app (com.singspree.tv) is in the Amazon Appstore, for the
 * /firetv page. It is live in every country, under one ASIN in every Amazon
 * store (checked 2026-11-10 on .de .co.uk .fr .it .es .co.jp .in .com.br .ca
 * .com.au .com.mx; amazon.com turns AI agents away, so that one is unchecked).
 * Each visitor gets the store of their own country, read from their device's
 * time zone like the seasons (src/seasons/place.ts): an Amazon account belongs
 * to one store, and the app page of another store can't install it.
 *
 * amazon.de is the owner's Amazon Associates (PartnerNet) link, which is why
 * `tagged` is set there: the page then says next to it that it is an affiliate
 * link, as the PartnerNet terms and German advertising law (§ 5a UWG) ask.
 * The tag only counts on amazon.de, so the other stores get the plain page.
 */
const ASIN = 'B0HQXFQP12';
const TAGGED_DE = `https://www.amazon.de/dp/${ASIN}?&linkCode=ll2&tag=ch02c-21&linkId=beaee20953dfe0e01616cf6b504ec835&ref_=as_li_ss_tl`;

/** Amazon's stores with an Appstore, by the time zones of the countries they serve (both old and new zone names) */
const STORES: [string, RegExp][] = [
  // amazon.de also serves Austria, Switzerland, Liechtenstein and Luxembourg
  ['de', /^Europe\/(Berlin|Busingen|Vienna|Zurich|Vaduz|Luxembourg)$/],
  ['co.uk', /^(Europe\/(London|Belfast|Dublin|Guernsey|Jersey|Isle_of_Man|Gibraltar)|GB|GB-Eire|Eire)$/],
  ['fr', /^(Europe\/(Paris|Monaco|Brussels)|America\/(Guadeloupe|Martinique|Cayenne)|Indian\/(Reunion|Mayotte))$/],
  ['it', /^Europe\/(Rome|San_Marino|Vatican)$/],
  ['es', /^(Europe\/(Madrid|Andorra)|Atlantic\/Canary|Africa\/Ceuta)$/],
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
  const tld = STORES.find(([, re]) => re.test(zone))?.[0] ?? (zonePlace(zone).country === 'CA' ? 'ca' : null);
  if (tld === 'de') return { href: TAGGED_DE, tagged: true };
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
