/**
 * Where the visitor is, for the seasons of one country (the Fourth of July in
 * the US) or one half of the world (winter): read from the time zone their
 * device is set to. No request and no prompt, it is there before the first
 * paint, and a VPN doesn't move it.
 *
 * Only the countries a season asks for are listed. A season for another one:
 * its zones here (both spellings where browsers differ: Chrome keeps ICU's
 * old names like America/Indianapolis, Firefox has America/Indiana/Indianapolis).
 */
const COUNTRY_ZONES: Record<string, string[]> = {
  US: [
    'America/New_York', 'America/Detroit', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
    'America/Boise', 'America/Menominee', 'America/Anchorage', 'America/Juneau', 'America/Sitka', 'America/Metlakatla',
    'America/Yakutat', 'America/Nome', 'America/Adak', 'Pacific/Honolulu',
    'America/Indiana/Indianapolis', 'America/Indianapolis', 'America/Fort_Wayne', 'America/Indiana/Vincennes',
    'America/Indiana/Winamac', 'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Vevay',
    'America/Indiana/Tell_City', 'America/Indiana/Knox', 'America/Knox_IN',
    'America/Kentucky/Louisville', 'America/Louisville', 'America/Kentucky/Monticello',
    'America/North_Dakota/Center', 'America/North_Dakota/New_Salem', 'America/North_Dakota/Beulah',
    'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific', 'US/Arizona', 'US/Alaska', 'US/Hawaii', 'US/Michigan',
  ],
  CA: [
    'America/Toronto', 'America/Montreal', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Regina',
    'America/Halifax', 'America/St_Johns', 'America/Moncton', 'America/Glace_Bay', 'America/Goose_Bay',
    'America/Swift_Current', 'America/Whitehorse', 'America/Dawson', 'America/Dawson_Creek', 'America/Fort_Nelson',
    'America/Creston', 'America/Atikokan', 'America/Blanc-Sablon', 'America/Nipigon', 'America/Thunder_Bay',
    'America/Rainy_River', 'America/Iqaluit', 'America/Pangnirtung', 'America/Rankin_Inlet', 'America/Resolute',
    'America/Cambridge_Bay', 'America/Yellowknife', 'America/Inuvik',
    'Canada/Eastern', 'Canada/Central', 'Canada/Mountain', 'Canada/Pacific', 'Canada/Atlantic', 'Canada/Newfoundland',
  ],
  FR: [
    'Europe/Paris',
    // the overseas departments keep 14 July too
    'America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Indian/Reunion', 'Indian/Mayotte',
  ],
  DE: ['Europe/Berlin', 'Europe/Busingen'],
};

/** Zones in the southern half of the world where it gets cold enough to call it winter in July (and summer at Christmas) */
const SOUTH = /^(Australia|Antarctica)\/|^(Pacific\/(Auckland|Chatham)|NZ|America\/(Argentina\/.*|Buenos_Aires|Cordoba|Mendoza|Catamarca|Jujuy|Santiago|Punta_Arenas|Montevideo|Asuncion|Sao_Paulo|Campo_Grande|Cuiaba)|Chile\/.*|Brazil\/East|Africa\/(Johannesburg|Maseru|Mbabane|Windhoek|Gaborone)|Atlantic\/Stanley)$/;

export interface Place {
  /** ISO 3166 code, or null where none of the listed countries is */
  country: string | null;
  south: boolean;
}

/** The place of a time zone (exported for the tests) */
export function zonePlace(zone: string): Place {
  const country = Object.keys(COUNTRY_ZONES).find(c => COUNTRY_ZONES[c].includes(zone)) ?? null;
  return { country, south: SOUTH.test(zone) };
}

/** Where this visitor is, by their device's time zone */
export function visitorPlace(): Place {
  try {
    return zonePlace(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
  } catch {
    return { country: null, south: false };
  }
}
