import React from 'react';
import { COUNTRIES } from '../lib/address.js';
import { SITE_CONFIG } from '../data/siteConfig.js';

// Countries the store ships to that have address rules (see src/lib/address.js).
export const SHIP_COUNTRIES = SITE_CONFIG.shipsTo.map((region) => region.code).filter((code) => COUNTRIES[code]);

export const emptyShippingAddress = () => ({ name: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: SHIP_COUNTRIES[0] || 'IN' });

// Shared by checkout and saved addresses. `idPrefix` keeps label/input ids
// unique when two forms are on one page; `errors` maps field → message.
export default function AddressFields({ value, onChange, errors = {}, idPrefix = 'address', inputClassName, labelClassName, errorClassName = 'mt-1 text-xs text-red-600' }) {
  const country = COUNTRIES[value.country] || COUNTRIES.IN;
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const id = (key) => `${idPrefix}-${key}`;
  const field = (key) => ({
    id: id(key),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${id(key)}-error` : undefined,
  });
  const error = (key) => errors[key] && <p id={`${id(key)}-error`} className={errorClassName}>{errors[key]}</p>;
  const invalid = (key) => (errors[key] ? ' border-red-500' : '');

  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4">
    {SHIP_COUNTRIES.length > 1 && <div className="sm:col-span-2">
      <label htmlFor={id('country')} className={labelClassName}>Country</label>
      <select {...field('country')} value={value.country} onChange={(event) => onChange({ ...value, country: event.target.value, state: '', postalCode: '' })} autoComplete="country" className={inputClassName + invalid('country')}>
        {SHIP_COUNTRIES.map((code) => <option key={code} value={code}>{COUNTRIES[code].name}</option>)}
      </select>
      {error('country')}
    </div>}
    <div>
      <label htmlFor={id('name')} className={labelClassName}>Full name</label>
      <input {...field('name')} required value={value.name} onChange={set('name')} autoComplete="name" className={inputClassName + invalid('name')} />
      {error('name')}
    </div>
    <div>
      <label htmlFor={id('phone')} className={labelClassName}>Mobile number</label>
      <div className="flex">
        <span className="inline-flex items-center px-3 border border-r-0 border-current/20 text-sm opacity-70" aria-hidden="true">+{country.dialCode}</span>
        <input {...field('phone')} required type="tel" inputMode="numeric" value={value.phone} onChange={set('phone')} autoComplete="tel-national" placeholder={country.phoneHint} className={`${inputClassName} min-w-0 flex-1${invalid('phone')}`} />
      </div>
      {error('phone')}
    </div>
    <div className="sm:col-span-2">
      <label htmlFor={id('line1')} className={labelClassName}>Flat, house no., building and street</label>
      <input {...field('line1')} required value={value.line1} onChange={set('line1')} autoComplete="address-line1" className={inputClassName + invalid('line1')} />
      {error('line1')}
    </div>
    <div className="sm:col-span-2">
      <label htmlFor={id('line2')} className={labelClassName}>Area, locality or landmark <span className="font-normal normal-case opacity-70">(optional)</span></label>
      <input {...field('line2')} value={value.line2} onChange={set('line2')} autoComplete="address-line2" className={inputClassName} />
    </div>
    <div>
      <label htmlFor={id('city')} className={labelClassName}>City or town</label>
      <input {...field('city')} required value={value.city} onChange={set('city')} autoComplete="address-level2" className={inputClassName + invalid('city')} />
      {error('city')}
    </div>
    {country.states && <div>
      <label htmlFor={id('state')} className={labelClassName}>State</label>
      <select {...field('state')} required value={value.state} onChange={set('state')} autoComplete="address-level1" className={inputClassName + invalid('state')}>
        <option value="">Choose a state</option>
        {country.states.map((state) => <option key={state} value={state}>{state}</option>)}
      </select>
      {error('state')}
    </div>}
    <div>
      <label htmlFor={id('postalCode')} className={labelClassName}>{country.postalLabel}</label>
      <input {...field('postalCode')} required inputMode="numeric" maxLength={7} value={value.postalCode} onChange={set('postalCode')} autoComplete="postal-code" placeholder={country.postalHint} className={inputClassName + invalid('postalCode')} />
      {error('postalCode')}
    </div>
  </div>;
}
