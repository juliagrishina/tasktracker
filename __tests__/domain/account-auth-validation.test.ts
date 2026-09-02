import {
  maskEmail,
  normalizeAccountName,
  validateAccountName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../../src/domain/account-auth-validation';

describe('account Auth validation', () => {
  test('normalizes a Unicode name by trimming and collapsing spaces', () => {
    expect(normalizeAccountName("  Анна   Мария-О'Нил  ")).toBe("Анна Мария-О'Нил");
    expect(validateAccountName("  Анна   Мария-О'Нил  ")).toEqual({
      value: "Анна Мария-О'Нил",
      error: null,
    });
  });

  test.each(['A', 'Анна2', 'Анна🙂', 'Анна\nМария', ' '.repeat(81)])(
    'rejects an invalid account name: %p',
    (value) => {
      expect(validateAccountName(value).error).not.toBeNull();
    },
  );

  test('canonicalizes only the domain portion of an IDN email', () => {
    expect(validateEmail('User+plan@ПРИМЕР.РФ')).toEqual({
      value: 'User+plan@xn--e1afmkfd.xn--p1ai',
      error: null,
    });
  });

  test.each([
    'user@example.invalid',
    'user@example',
    'user@@example.com',
    'user name@example.com',
    ' user@example.com',
    'user@example.com ',
  ])('rejects an invalid email: %s', (value) => {
    expect(validateEmail(value).error).not.toBeNull();
  });

  test('masks an email without exposing its full local part', () => {
    expect(maskEmail('anna.maria@example.com')).toBe('a***@example.com');
  });

  test.each([
    'short1!A',
    'onlylowercase1!',
    'ONLYUPPERCASE1!',
    'NoDigitsHere!',
    'NoSpecial123',
  ])('reports an unmet password requirement: %s', (password) => {
    expect(validatePassword(password).isValid).toBe(false);
  });

  test('accepts a password meeting every required class', () => {
    expect(validatePassword('StrongPass1!')).toEqual({
      isValid: true,
      missingRequirements: [],
    });
  });

  test('requires an exact password confirmation', () => {
    expect(validatePasswordConfirmation('StrongPass1!', 'StrongPass2!').error).not.toBeNull();
    expect(validatePasswordConfirmation('StrongPass1!', 'StrongPass1!')).toEqual({
      value: undefined,
      error: null,
    });
  });
});
