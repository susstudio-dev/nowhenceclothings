import { describe, expect, it } from 'vitest';
import {
  EMPTY_DETAILS,
  detailsPayload,
  formatPhone,
  normalisePhone,
  parseRemembered,
  serialiseRemembered,
  validateDetails,
  type CheckoutDetails,
} from './checkout-details';

const ship = { name: 'Asha Rao', line1: '12 MG Road', line2: '', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' };
const good: CheckoutDetails = { ...EMPTY_DETAILS, email: 'Asha@Example.com ', phone: '+91 98765 43210', ship };

describe('checkout details', () => {
  it('normalises Indian mobile numbers', () => {
    expect(normalisePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalisePhone('09876543210')).toBe('9876543210');
    expect(normalisePhone('919876543210')).toBe('9876543210');
    expect(normalisePhone('5876543210')).toBeNull();
    expect(normalisePhone('98765')).toBeNull();
    expect(formatPhone('9876543210')).toBe('98765 43210');
  });

  it('validates contact, address, billing and GSTIN', () => {
    expect(validateDetails(good)).toEqual({});
    const bad = validateDetails({ ...EMPTY_DETAILS, billingSame: false, wantGst: true, gstin: '12' });
    expect(Object.keys(bad)).toEqual(
      expect.arrayContaining(['email', 'phone', 'ship.name', 'ship.pincode', 'bill.line1', 'gstin']),
    );
    expect(validateDetails({ ...good, ship: { ...ship, pincode: '012345' } })['ship.pincode']).toBeTruthy();
  });

  it('makes the address optional when asked (deposit bookings)', () => {
    expect(validateDetails({ ...good, ship: { ...EMPTY_DETAILS.ship, name: 'Asha' } }, { requireAddress: false })).toEqual({});
    expect(validateDetails({ ...good, ship: { ...EMPTY_DETAILS.ship } }, { requireAddress: false })).toEqual({ 'ship.name': 'Enter your full name.' });
    expect(validateDetails({ ...good, ship: { ...EMPTY_DETAILS.ship, city: 'Pune' } }, { requireAddress: false })['ship.line1']).toBeTruthy();
  });

  it('builds the request payload', () => {
    const p = detailsPayload({ ...good, billingSame: false, bill: { ...ship, name: 'Studio LLP' }, wantGst: true, gstin: '27aapfu0939f1zv' });
    expect(p).toMatchObject({ email: 'asha@example.com', phone: '9876543210', gstin: '27AAPFU0939F1ZV' });
    expect(p.address).toMatchObject({ country: 'IN', city: 'Bengaluru' });
    expect(p.billingAddress!.name).toBe('Studio LLP');
    expect(detailsPayload(good).billingAddress).toBeUndefined();
    expect(detailsPayload({ ...good, ship: { ...EMPTY_DETAILS.ship } }).address).toBeUndefined();
  });

  it('round-trips remembered details and tolerates junk', () => {
    const back = parseRemembered(serialiseRemembered(good));
    expect(back).toMatchObject({ email: good.email, ship });
    expect(parseRemembered('{bad')).toBeNull();
    expect(parseRemembered(JSON.stringify({ ship: { name: 5 } }))!.ship.name).toBe('');
  });
});
