import { describe, expect, it } from 'vitest';
import { passwordStrength } from '@/lib/password-strength';

describe('passwordStrength', () => {
  it('starts empty with guidance', () => {
    expect(passwordStrength('')).toMatchObject({ score: 0, label: '' });
  });

  it('counts down to the 12-character minimum', () => {
    expect(passwordStrength('short')).toMatchObject({ score: 1, label: 'Too short', hint: '7 more characters to go.' });
    expect(passwordStrength('elevenchars')).toMatchObject({ hint: '1 more character to go.' });
  });

  it('flags common words and repeated characters, however long', () => {
    expect(passwordStrength('password1234')).toMatchObject({ score: 1, label: 'Easy to guess' });
    expect(passwordStrength('aaaaaaaaaaaaaaaa')).toMatchObject({ score: 1, label: 'Easy to guess' });
  });

  it('rates a 12-character single word as fair', () => {
    expect(passwordStrength('mellowtigers')).toMatchObject({ score: 2, label: 'Fair' });
  });

  it('rewards length', () => {
    expect(passwordStrength('mellowtigersrunfast')).toMatchObject({ score: 3, label: 'Good' });
  });

  it('rewards mixing kinds of characters', () => {
    expect(passwordStrength('Tr0ub4dor&3xy')).toMatchObject({ score: 3, label: 'Good' });
  });

  it('rates a long multi-word phrase as strong', () => {
    expect(passwordStrength('bakery-ovens-at-dawn')).toMatchObject({ score: 4, label: 'Strong' });
  });
});
