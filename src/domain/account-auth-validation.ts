import { toASCII } from 'punycode/';

import { IANA_TOP_LEVEL_DOMAINS } from './iana-top-level-domains';

export type FieldValidation<T> =
  | { value: T; error: null }
  | { value: undefined; error: string };

export type PasswordRequirement =
  | 'minimumLength'
  | 'lowercaseLetter'
  | 'uppercaseLetter'
  | 'digit'
  | 'specialCharacter';

export interface PasswordValidation {
  isValid: boolean;
  missingRequirements: PasswordRequirement[];
}

const NAME_WHITESPACE = /\p{Zs}+/gu;
const NAME_ALLOWED_CHARACTERS = /^[\p{L}\p{M}\p{Zs}'-]+$/u;
const HAS_LETTER = /\p{L}/u;
const HAS_LOWERCASE_LETTER = /\p{Ll}/u;
const HAS_UPPERCASE_LETTER = /\p{Lu}/u;
const HAS_DIGIT = /\p{Nd}/u;
const HAS_SPECIAL_CHARACTER = /[^\p{L}\p{N}\s]/u;
const LOCAL_PART_ALLOWED_CHARACTERS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeAccountName(value: string): string {
  return value.replace(/^\p{Zs}+|\p{Zs}+$/gu, '').replace(NAME_WHITESPACE, ' ');
}

export function validateAccountName(value: string): FieldValidation<string> {
  const normalized = normalizeAccountName(value);
  const length = Array.from(normalized).length;

  if (length < 2 || length > 80) {
    return {
      value: undefined,
      error: 'Имя должно содержать от 2 до 80 символов.',
    };
  }

  if (!NAME_ALLOWED_CHARACTERS.test(normalized) || !HAS_LETTER.test(normalized)) {
    return {
      value: undefined,
      error: 'В имени допустимы только буквы, пробел, дефис и апостроф.',
    };
  }

  return { value: normalized, error: null };
}

export function validateEmail(value: string): FieldValidation<string> {
  if (!value || /\s/u.test(value)) {
    return invalidEmail();
  }

  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) {
    return invalidEmail();
  }

  const localPart = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (!isValidLocalPart(localPart)) {
    return invalidEmail();
  }

  const canonicalDomain = canonicalizeEmailDomain(domain);
  if (canonicalDomain === null) {
    return invalidEmail();
  }

  return { value: `${localPart}@${canonicalDomain}`, error: null };
}

export function maskEmail(value: string): string {
  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) {
    return '***';
  }

  return `${value.slice(0, 1)}***@${value.slice(atIndex + 1)}`;
}

export function validatePassword(password: string): PasswordValidation {
  const missingRequirements: PasswordRequirement[] = [];

  if (Array.from(password).length < 10) {
    missingRequirements.push('minimumLength');
  }
  if (!HAS_LOWERCASE_LETTER.test(password)) {
    missingRequirements.push('lowercaseLetter');
  }
  if (!HAS_UPPERCASE_LETTER.test(password)) {
    missingRequirements.push('uppercaseLetter');
  }
  if (!HAS_DIGIT.test(password)) {
    missingRequirements.push('digit');
  }
  if (!HAS_SPECIAL_CHARACTER.test(password)) {
    missingRequirements.push('specialCharacter');
  }

  return {
    isValid: missingRequirements.length === 0,
    missingRequirements,
  };
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): FieldValidation<undefined> {
  if (!confirmation) {
    return { value: undefined, error: 'Повторите пароль.' };
  }

  if (password !== confirmation) {
    return { value: undefined, error: 'Пароли не совпадают.' };
  }

  return { value: undefined, error: null };
}

function invalidEmail(): FieldValidation<string> {
  return { value: undefined, error: 'Укажите корректный email.' };
}

function isValidLocalPart(localPart: string): boolean {
  return (
    localPart.length <= 64 &&
    LOCAL_PART_ALLOWED_CHARACTERS.test(localPart) &&
    !localPart.startsWith('.') &&
    !localPart.endsWith('.') &&
    !localPart.includes('..')
  );
}

function canonicalizeEmailDomain(domain: string): string | null {
  if (!domain || /[/:@?#\[\]\\]/u.test(domain) || domain.includes('..')) {
    return null;
  }

  let hostname: string;
  try {
    hostname = toASCII(domain.toLowerCase());
  } catch {
    return null;
  }

  const labels = hostname.split('.');
  const topLevelDomain = labels.at(-1);
  if (
    hostname.length > 253 ||
    labels.length < 2 ||
    !topLevelDomain ||
    !IANA_TOP_LEVEL_DOMAINS.has(topLevelDomain.toUpperCase()) ||
    labels.some((label) => label.length > 63 || !HOST_LABEL.test(label))
  ) {
    return null;
  }

  return hostname;
}
