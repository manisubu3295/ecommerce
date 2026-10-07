// Shipping-address rules shared by checkout, saved addresses and the server,
// so the browser and the API accept and reject exactly the same input.

// States and union territories with their GST state codes (used for
// "place of supply" and the CGST/SGST vs IGST split on invoices).
export const INDIAN_STATES = [
  ['35', 'Andaman and Nicobar Islands'], ['37', 'Andhra Pradesh'], ['12', 'Arunachal Pradesh'], ['18', 'Assam'],
  ['10', 'Bihar'], ['04', 'Chandigarh'], ['22', 'Chhattisgarh'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['07', 'Delhi'], ['30', 'Goa'], ['24', 'Gujarat'], ['06', 'Haryana'], ['02', 'Himachal Pradesh'],
  ['01', 'Jammu and Kashmir'], ['20', 'Jharkhand'], ['29', 'Karnataka'], ['32', 'Kerala'], ['38', 'Ladakh'],
  ['31', 'Lakshadweep'], ['23', 'Madhya Pradesh'], ['27', 'Maharashtra'], ['14', 'Manipur'], ['17', 'Meghalaya'],
  ['15', 'Mizoram'], ['13', 'Nagaland'], ['21', 'Odisha'], ['34', 'Puducherry'], ['03', 'Punjab'],
  ['08', 'Rajasthan'], ['11', 'Sikkim'], ['33', 'Tamil Nadu'], ['36', 'Telangana'], ['16', 'Tripura'],
  ['09', 'Uttar Pradesh'], ['05', 'Uttarakhand'], ['19', 'West Bengal'],
].map(([code, name]) => ({ code, name }));

const MALAYSIAN_STATES = ['Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu'];

export const COUNTRIES = {
  IN: { name: 'India', dialCode: '91', states: INDIAN_STATES.map((s) => s.name), postalLabel: 'PIN code', postalPattern: /^[1-9]\d{5}$/, postalHint: '6 digits, e.g. 600004', phonePattern: /^[6-9]\d{9}$/, phoneHint: '10-digit mobile number' },
  SG: { name: 'Singapore', dialCode: '65', states: null, postalLabel: 'Postal code', postalPattern: /^\d{6}$/, postalHint: '6 digits', phonePattern: /^[689]\d{7}$/, phoneHint: '8-digit number' },
  MY: { name: 'Malaysia', dialCode: '60', states: MALAYSIAN_STATES, postalLabel: 'Postcode', postalPattern: /^\d{5}$/, postalHint: '5 digits', phonePattern: /^1\d{8,9}$/, phoneHint: 'mobile number without the leading 0' },
};

export const stateCode = (stateName) => INDIAN_STATES.find((s) => s.name === stateName)?.code || null;

// GSTIN: 2-digit state code, 10-character PAN, entity number, 'Z', checksum.
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Store settings that end up on invoices and the shop. Returns the cleaned
// values to save and field → message errors (empty when valid).
export function validateBusinessSettings(input = {}) {
  const text = (value, max) => String(value ?? '').trim().slice(0, max);
  const business = {
    legalName: text(input.legalName, 120),
    gstin: text(input.gstin, 15).toUpperCase().replace(/\s/g, ''),
    state: text(input.state, 60),
    address: String(input.address ?? '').trim().slice(0, 400),
    phone: text(input.phone, 20),
    email: text(input.email, 120).toLowerCase(),
    invoicePrefix: text(input.invoicePrefix, 10).toUpperCase().replace(/[^A-Z0-9-]/g, ''),
  };
  const errors = {};
  if (business.gstin && !GSTIN_PATTERN.test(business.gstin)) errors.gstin = 'That isn’t a valid GSTIN. It has 15 characters, like 33ABCDE1234F1Z5.';
  if (business.state && !stateCode(business.state)) errors.state = 'Choose a state from the list.';
  if (business.gstin && business.state && !errors.gstin && !errors.state && business.gstin.slice(0, 2) !== stateCode(business.state)) {
    errors.gstin = `This GSTIN is registered in state code ${business.gstin.slice(0, 2)}, but ${business.state} is ${stateCode(business.state)}. Check both.`;
  }
  if (business.email && !EMAIL_PATTERN.test(business.email)) errors.email = 'Enter a valid email address.';
  if (business.phone && business.phone.replace(/\D/g, '').length < 10) errors.phone = 'Enter a phone number with at least 10 digits.';
  if (input.invoicePrefix && !business.invoicePrefix) errors.invoicePrefix = 'Use letters, numbers or a dash.';
  return { business, errors };
}

// What's still missing for a complete invoice (shown as a reminder in the admin).
export function missingBusinessDetails(business = {}) {
  return [
    !business.legalName && 'business name',
    !business.address && 'address',
    !business.state && 'state',
    !business.email && 'email',
  ].filter(Boolean);
}

// Accepts "+91 98765 43210", "098765 43210", "9876543210" → "9876543210".
export function normalizePhone(raw, countryCode = 'IN') {
  const country = COUNTRIES[countryCode] || COUNTRIES.IN;
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith(country.dialCode) && digits.length > country.dialCode.length + 7) digits = digits.slice(country.dialCode.length);
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return digits;
}

// Every national number a typed phone could mean, for order lookup.
export function phoneCandidates(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return [...new Set([digits, ...Object.keys(COUNTRIES).map((code) => normalizePhone(digits, code))].filter(Boolean))];
}

const clean = (value, max = 120) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Returns { address, errors }. `errors` maps field → message and is empty when
// the address is usable; `address` is the normalized version to store.
export function validateAddress(input = {}, allowedCountries = Object.keys(COUNTRIES)) {
  const countryCode = allowedCountries.includes(input.country) ? input.country : null;
  const country = COUNTRIES[countryCode];
  const address = {
    name: clean(input.name, 80),
    phone: country ? normalizePhone(input.phone, countryCode) : String(input.phone || '').replace(/\D/g, ''),
    line1: clean(input.line1),
    line2: clean(input.line2),
    city: clean(input.city, 60),
    state: clean(input.state, 60),
    postalCode: String(input.postalCode ?? '').replace(/\s/g, '').toUpperCase(),
    country: countryCode,
  };
  const errors = {};
  if (!country) errors.country = 'Choose a country we ship to.';
  if (address.name.length < 2) errors.name = 'Enter the full name of the person receiving the order.';
  if (country && !country.phonePattern.test(address.phone)) errors.phone = `Enter a valid ${country.phoneHint}.`;
  if (address.line1.length < 3) errors.line1 = 'Enter the flat or house number and street.';
  if (address.city.length < 2) errors.city = 'Enter the city or town.';
  if (country?.states && !country.states.includes(address.state)) errors.state = 'Choose a state.';
  if (country && !country.states) address.state = '';
  if (country && !country.postalPattern.test(address.postalCode)) errors.postalCode = `Enter a valid ${country.postalLabel} (${country.postalHint}).`;
  return { address, errors };
}

// Multi-line text used on invoices, admin screens and courier labels.
export function formatAddress(address) {
  if (!address) return '';
  const country = COUNTRIES[address.country];
  const cityLine = [address.city, [address.state, address.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [address.line1, address.line2, cityLine, country?.name].filter(Boolean).join('\n');
}

export function formatPhone(phone, countryCode = 'IN') {
  const country = COUNTRIES[countryCode];
  if (!phone) return '';
  if (countryCode === 'IN' && phone.length === 10) return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
  return country ? `+${country.dialCode} ${phone}` : phone;
}
