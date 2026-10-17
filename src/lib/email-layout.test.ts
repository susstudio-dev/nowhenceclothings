import { describe, expect, it } from 'vitest';
import { emailButton, emailLabel, emailLayout, emailNote } from './email-layout';

describe('email layout', () => {
  it('wraps title and body in a full branded document', () => {
    const html = emailLayout('Thank you.', '<p>Body</p>', { preheader: 'Pre' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('NOWHENCE');
    expect(html).toContain('Thank you.');
    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('Pre');
    expect(html).toContain('Reply to this email');
  });
  it('renders button, note and label helpers', () => {
    expect(emailButton('https://x/pay', 'Pay balance')).toContain('href="https://x/pay"');
    expect(emailNote('<b>n</b>')).toContain('<b>n</b>');
    expect(emailLabel('Order')).toContain('text-transform:uppercase');
  });
});
