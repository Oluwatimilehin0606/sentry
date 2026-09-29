export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string };

const COMMON = /(password|passw0rd|qwerty|letmein|welcome|admin|sentry|123456|abcdef|iloveyou)/i;

/**
 * A simple, honest guide to password strength. Length matters most, so it leads; mixing kinds of
 * characters (or using several words) adds a step. Obvious choices are flagged whatever their length.
 */
export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: '', hint: 'At least 12 characters. A short phrase is easy to remember.' };

  if (password.length < 12) {
    const left = 12 - password.length;
    return { score: 1, label: 'Too short', hint: `${left} more character${left === 1 ? '' : 's'} to go.` };
  }

  if (COMMON.test(password) || /^(.)\1+$/.test(password)) {
    return { score: 1, label: 'Easy to guess', hint: 'This contains a very common word or pattern. Try a phrase only you would use.' };
  }

  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const words = password.split(/[\s\-_.]+/).filter((w) => w.length >= 3).length;

  let score = 2;
  if (password.length >= 16) score++;
  if (kinds >= 3 || words >= 3) score++;
  const capped = Math.min(4, score) as 2 | 3 | 4;

  const byScore = {
    2: { label: 'Fair', hint: 'Longer is stronger: try a phrase of three or more words.' },
    3: { label: 'Good', hint: 'Nearly there. A few more characters make it strong.' },
    4: { label: 'Strong', hint: 'Great. A phrase like this is easy for you and hard to guess.' },
  } as const;
  return { score: capped, ...byScore[capped] };
}
