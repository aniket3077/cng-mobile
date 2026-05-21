import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateSensitiveAction(reason: string) {
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (supportedTypes.length === 0) {
    return {
      success: false,
      message: 'Secure device authentication is required before continuing.',
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
    requireConfirmation: true,
  });

  if (!result.success) {
    return {
      success: false,
      message: 'Device authentication was not completed.',
    };
  }

  return {
    success: true,
    message: '',
  };
}
